'use strict';
const { app, BrowserWindow, ipcMain, safeStorage, shell, Menu, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const dns = require('dns');
const { spawn } = require('child_process');

// ---------- single instance (avoid the app fighting its own session) ----------
if (!app.requestSingleInstanceLock()) { app.quit(); }

// ---------- paths & state ----------
const DATA = app.getPath('userData');
const SETTINGS = path.join(DATA, 'settings.json');
const CRED = path.join(DATA, 'cred.bin');
const RUNCONF = path.join(DATA, 'runtime.toml');
const LOG = path.join(DATA, 'engine.log');
const CHROME_PROFILE = path.join(DATA, 'campus-chrome');

const DEFAULTS = { server: 'remote.hkust-gz.edu.cn', port: 1080, username: '' };
const CAMPUS_HOME = 'https://www.hkust-gz.edu.cn';

let win = null;
let engine = null;
let state = { connected: false, connecting: false, clientIp: null, lastError: null, pacUrl: '' };

// ---------- settings & credentials ----------
function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS, 'utf8')) }; }
  catch { return { ...DEFAULTS }; }
}
function saveSettings(s) { fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2), { mode: 0o600 }); }
function savePassword(pw) {
  if (!pw) return;
  const buf = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(pw)
    : Buffer.concat([Buffer.from('PLAIN:'), Buffer.from(pw, 'utf8')]);
  fs.writeFileSync(CRED, buf, { mode: 0o600 });
}
function loadPassword() {
  try {
    const buf = fs.readFileSync(CRED);
    if (buf.slice(0, 6).toString() === 'PLAIN:') return buf.slice(6).toString('utf8');
    return safeStorage.decryptString(buf);
  } catch { return ''; }
}
function hasPassword() { return fs.existsSync(CRED); }
function socksPort() { return Number(loadSettings().port) || 1080; }

// ---------- engine ----------
function enginePath() {
  const plat = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'darwin' : 'linux';
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const ext = plat === 'windows' ? '.exe' : '';
  const named = `zju-connect-${plat}-${arch}${ext}`;
  const dir = app.isPackaged ? path.join(process.resourcesPath, 'engine') : path.join(__dirname, 'engine');
  const candidates = [
    path.join(dir, named),
    path.join(dir, plat === 'windows' ? 'zju-connect.exe' : 'zju-connect'),
    path.join(__dirname, '..', plat === 'windows' ? 'zju-connect.exe' : 'zju-connect'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || candidates[0];
}

// Resolve the gateway via reliable public DNS so a broken/asleep system resolver
// (e.g. 114.114.114.114 going unreachable after lid-sleep) can't break connecting.
// Returns an IP to use directly as server_address; falls back to the hostname.
async function resolveHost(host) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host;
  for (const servers of [['223.5.5.5'], ['119.29.29.29'], ['180.76.76.76'], ['8.8.8.8']]) {
    try {
      const r = new dns.Resolver({ tries: 1, timeout: 3000 });
      r.setServers(servers);
      const ips = await new Promise((res, rej) => r.resolve4(host, (e, a) => (e ? rej(e) : res(a))));
      if (ips && ips.length) return ips[0];
    } catch {}
  }
  try { return (await dns.promises.lookup(host, { family: 4 })).address; } catch {}
  return host;
}

function writeRunConf(s, pw, serverAddr) {
  const esc = (v) => String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  fs.writeFileSync(RUNCONF, [
    'protocol = "easyconnect"',
    `server_address = "${esc(serverAddr || s.server)}"`,
    'server_port = 443',
    `username = "${esc(s.username)}"`,
    `password = "${esc(pw)}"`,
    `socks_bind = "127.0.0.1:${Number(s.port)}"`,
    `http_bind = "127.0.0.1:${Number(s.port) + 1}"`,
    'disable_zju_config = true',
    'disable_zju_dns = true',
    'skip_domain_resource = true',
    'secondary_dns_server = "223.5.5.5"',
    '',
  ].join('\n'), { mode: 0o600 });
}

function emit() {
  state.pacUrl = pacUrl();
  if (win && !win.isDestroyed()) win.webContents.send('status', state);
}

async function connect() {
  if (engine) return;
  const s = loadSettings();
  const pw = loadPassword();
  if (!s.username || !pw) { state.lastError = '请先填写账号和密码'; emit(); return; }
  state.connecting = true; state.connected = false; state.lastError = null; state.clientIp = null;
  emit();
  const serverAddr = await resolveHost(s.server);
  writeRunConf(s, pw, serverAddr);
  try { fs.writeFileSync(LOG, ''); } catch {}
  const bin = enginePath();
  if (!fs.existsSync(bin)) { state.connecting = false; state.lastError = '引擎缺失:' + bin; emit(); return; }

  engine = spawn(bin, ['-config', RUNCONF], { stdio: ['ignore', 'pipe', 'pipe'] });
  const onData = (d) => {
    const t = d.toString();
    try { fs.appendFileSync(LOG, t); } catch {}
    if (/SOCKS5 server listening/.test(t)) { state.connecting = false; state.connected = true; emit(); }
    const m = t.match(/Client IP:\s*([0-9.]+)/);
    if (m) { state.clientIp = m[1]; emit(); }
    if (/Login failed|Invalid username/.test(t)) state.lastError = '登录失败:账号或密码错误';
    else if (/Not implemented auth/.test(t)) state.lastError = '网关鉴权方式不受支持(可能已改 SSO/MFA)';
    else if (/address already in use|bind:/.test(t)) state.lastError = `端口 ${s.port} 被占用,请在高级设置换一个`;
  };
  engine.stdout.on('data', onData);
  engine.stderr.on('data', onData);
  engine.on('error', (err) => { state.connecting = false; state.lastError = '无法启动引擎:' + err.message; emit(); });
  engine.on('exit', (code) => {
    const wasConnected = state.connected;
    engine = null;
    state.connected = false; state.connecting = false; state.clientIp = null;
    if (!wasConnected && !state.lastError && code) state.lastError = '连接失败(退出码 ' + code + '),请查看日志';
    try { fs.unlinkSync(RUNCONF); } catch {}
    emit();
  });
}
function disconnect() { if (engine) engine.kill(); }

// ---------- PAC server (campus -> SOCKS, everything else direct) ----------
let pacServer = null, pacPort = 0;
function pacBody() {
  const p = socksPort();
  return `function FindProxyForURL(url, host) {
  if (dnsDomainIs(host, ".hkust-gz.edu.cn") || dnsDomainIs(host, ".hkust.edu.hk") ||
      shExpMatch(host, "10.120.*") || isInNet(host, "10.0.0.0", "255.0.0.0") ||
      isInNet(dnsResolve(host) || "0.0.0.0", "10.0.0.0", "255.0.0.0"))
    return "SOCKS5 127.0.0.1:${p}; SOCKS 127.0.0.1:${p}";
  return "DIRECT";
}
`;
}
function startPac() {
  pacServer = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/x-ns-proxy-autoconfig');
    res.end(pacBody());
  });
  pacServer.on('error', () => {});
  pacServer.listen(0, '127.0.0.1', () => { pacPort = pacServer.address().port; emit(); });
}
function pacUrl() { return pacPort ? `http://127.0.0.1:${pacPort}/proxy.pac` : ''; }

function openCampusBrowser() {
  const pac = pacUrl();
  if (!pac) { state.lastError = 'PAC 未就绪'; emit(); return; }
  const args = [
    `--proxy-pac-url=${pac}`,
    `--user-data-dir=${CHROME_PROFILE}`,
    '--no-first-run', '--no-default-browser-check', CAMPUS_HOME,
  ];
  let child;
  if (process.platform === 'darwin') child = spawn('open', ['-na', 'Google Chrome', '--args', ...args]);
  else if (process.platform === 'win32') child = spawn('cmd', ['/c', 'start', 'chrome', ...args], { shell: true });
  else child = spawn('google-chrome', args);
  child.on('error', () => { state.lastError = '未找到 Chrome,请手动用 PAC 地址'; emit(); });
}

// ---------- IPC ----------
ipcMain.handle('get-state', () => ({ ...state, settings: loadSettings(), hasPassword: hasPassword(), pacUrl: pacUrl() }));
ipcMain.handle('save', (_e, p) => {
  saveSettings({
    server: (p && p.server) || DEFAULTS.server,
    port: Number(p && p.port) || 1080,
    username: (p && p.username) || '',
  });
  if (p && typeof p.password === 'string' && p.password.length) savePassword(p.password);
  return { ok: true };
});
ipcMain.handle('connect', async () => { await connect(); return { ok: true }; });
ipcMain.handle('disconnect', () => { disconnect(); return { ok: true }; });
ipcMain.handle('open-log', () => shell.openPath(LOG));
ipcMain.handle('copy', (_e, text) => { clipboard.writeText(String(text || '')); return { ok: true }; });
ipcMain.handle('open-campus-browser', () => { openCampusBrowser(); return { ok: true }; });
ipcMain.handle('resize', (_e, h) => {
  if (win && !win.isDestroyed()) {
    const [w] = win.getContentSize();
    win.setContentSize(w, Math.max(360, Math.min(980, Math.ceil(h))));
  }
});

// ---------- window ----------
function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 600,
    resizable: false,
    fullscreenable: false,
    maximizable: false,
    title: 'HKUST(GZ) Connect',
    backgroundColor: '#ffffff',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 14, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('closed', () => { win = null; });
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => {
  if (process.platform === 'darwin') Menu.setApplicationMenu(null);
  startPac();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { disconnect(); app.quit(); });
app.on('before-quit', () => disconnect());
