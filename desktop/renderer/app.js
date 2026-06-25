'use strict';
const $ = (id) => document.getElementById(id);
let st = { connected: false, connecting: false, clientIp: null, lastError: null };
let settings = {};

function show(view) {
  $('login').hidden = view !== 'login';
  $('dash').hidden = view !== 'dash';
}
function setPage(page) {
  document.querySelectorAll('.nav').forEach((n) => n.classList.toggle('active', n.dataset.page === page));
  document.querySelectorAll('.page').forEach((p) => {
    const on = p.dataset.page === page;
    p.classList.toggle('active', on);
    p.hidden = !on;
  });
  if (page === 'notif') loadLogs();
}
function dnsModeSel() {
  const r = document.querySelector('input[name="dns"]:checked');
  return r ? r.value : 'auto';
}

function renderConnect(s) {
  st = s;
  const sw = $('switch'), status = $('connStatus');
  sw.classList.toggle('on', s.connected);
  sw.classList.toggle('busy', s.connecting);
  status.classList.toggle('on', s.connected);
  status.classList.toggle('busy', s.connecting);
  status.textContent = s.connecting ? '连接中…' : s.connected ? '已连接' : '未连接';
  $('connIp').textContent = s.connected && s.clientIp ? s.clientIp : '—';
  $('lock').textContent = s.connected ? '🔒' : '🔓';
  $('connErr').textContent = (!s.connected && !s.connecting && s.lastError) ? s.lastError : '';
}

async function refreshState() {
  const s = await window.api.getState();
  settings = s.settings || {};
  renderConnect(s);
  const mode = settings.dnsMode || 'auto';
  document.querySelectorAll('input[name="dns"]').forEach((r) => { r.checked = r.value === mode; });
  $('customDns').value = settings.customDns || '';
  $('customDns').disabled = mode !== 'manual';
  $('towerPort').value = settings.port || 1080;
  $('acct').textContent = settings.username || '—';
  $('setServer').value = settings.server || 'remote.hkust-gz.edu.cn';
  return s;
}

async function loadLogs() {
  const t = await window.api.getLogs();
  const box = $('logs');
  box.textContent = t && t.trim() ? t : '(暂无日志,连接后这里显示运行/错误信息)';
  box.scrollTop = box.scrollHeight;
}

async function init() {
  const s = await refreshState();
  $('lgUser').value = settings.username || '';
  show(s.loggedIn ? 'dash' : 'login');
}

// ---- login ----
$('lgBtn').addEventListener('click', async () => {
  const u = $('lgUser').value.trim(), p = $('lgPass').value;
  if (!u) { $('lgErr').textContent = '请填写账号'; return; }
  if (!p) { $('lgErr').textContent = '请填写密码'; return; }
  await window.api.save({ username: u, password: p, server: settings.server, port: settings.port,
    dnsMode: settings.dnsMode, customDns: settings.customDns });
  $('lgPass').value = ''; $('lgErr').textContent = '';
  await refreshState();
  show('dash'); setPage('connect');
});
$('lgPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('lgBtn').click(); });

// ---- nav ----
document.querySelectorAll('.nav').forEach((n) => n.addEventListener('click', () => setPage(n.dataset.page)));

// ---- connect toggle ----
$('switch').addEventListener('click', async () => {
  if (st.connecting) return;
  if (st.connected) await window.api.disconnect();
  else await window.api.connect();
});

// ---- tower ----
document.querySelectorAll('input[name="dns"]').forEach((r) =>
  r.addEventListener('change', () => { $('customDns').disabled = dnsModeSel() !== 'manual'; }));
$('towerSave').addEventListener('click', async () => {
  await window.api.save({
    username: settings.username,
    server: ($('setServer').value.trim() || settings.server),
    port: $('towerPort').value,
    dnsMode: dnsModeSel(),
    customDns: $('customDns').value.trim(),
  });
  await refreshState();
  $('towerSaved').textContent = '已保存 ✓';
  setTimeout(() => { $('towerSaved').textContent = ''; }, 1500);
});

// ---- notifications ----
$('logRefresh').addEventListener('click', loadLogs);

// ---- settings ----
$('logoutBtn').addEventListener('click', async () => {
  await window.api.logout();
  await refreshState();
  $('lgPass').value = '';
  show('login');
});
$('openLogLink').addEventListener('click', (e) => { e.preventDefault(); window.api.openLog(); });

window.api.onStatus((s) => { renderConnect(s); });
init();
