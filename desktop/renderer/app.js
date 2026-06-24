'use strict';
const $ = (id) => document.getElementById(id);
const el = {
  dot: $('dot'), statusText: $('statusText'), statusIp: $('statusIp'), status: $('status'),
  username: $('username'), password: $('password'), server: $('server'), port: $('port'),
  advanced: $('advanced'), advancedToggle: $('advancedToggle'),
  connectBtn: $('connectBtn'), error: $('error'),
  proxy: $('proxy'), socksVal: $('socksVal'), pacVal: $('pacVal'),
  openBrowser: $('openBrowser'), logLink: $('logLink'),
};
let connected = false, connecting = false, hasPassword = false;
let pacUrl = '';

function render(s) {
  connected = !!s.connected; connecting = !!s.connecting;
  if (s.pacUrl) pacUrl = s.pacUrl;

  el.dot.className = 'dot' + (connected ? ' connected' : connecting ? ' connecting' : '');
  el.status.classList.toggle('on', connected);
  el.statusText.textContent = connecting ? '连接中…' : connected ? '已连接' : '未连接';
  el.statusIp.textContent = connected && s.clientIp ? '· ' + s.clientIp : '';

  el.connectBtn.textContent = connecting ? '连接中…' : connected ? '断开' : '连接';
  el.connectBtn.classList.toggle('connected', connected);
  el.connectBtn.classList.toggle('busy', connecting);
  el.error.textContent = s.lastError || '';

  const lock = connected || connecting;
  [el.username, el.password, el.server, el.port].forEach((i) => { i.disabled = lock; });

  // proxy / browser helper only when connected
  if (connected) {
    el.socksVal.textContent = `127.0.0.1:${el.port.value || 1080}`;
    el.pacVal.textContent = pacUrl || '—';
    el.proxy.removeAttribute('hidden');
  } else {
    el.proxy.setAttribute('hidden', '');
  }
}

async function persist() {
  await window.api.save({
    username: el.username.value.trim(),
    password: el.password.value,
    server: el.server.value.trim(),
    port: el.port.value,
  });
}

async function init() {
  const s = await window.api.getState();
  el.username.value = s.settings.username || '';
  el.server.value = s.settings.server || 'remote.hkust-gz.edu.cn';
  el.port.value = s.settings.port || 1080;
  hasPassword = !!s.hasPassword;
  pacUrl = s.pacUrl || '';
  if (hasPassword) el.password.placeholder = '已保存(留空则不变)';
  render(s);
}

el.advancedToggle.addEventListener('click', () => {
  const open = el.advanced.hasAttribute('hidden');
  if (open) el.advanced.removeAttribute('hidden'); else el.advanced.setAttribute('hidden', '');
  el.advancedToggle.classList.toggle('open', open);
});

el.connectBtn.addEventListener('click', async () => {
  if (connecting) return;
  if (connected) { await window.api.disconnect(); return; }
  if (!el.username.value.trim()) { el.error.textContent = '请填写账号'; return; }
  if (!el.password.value && !hasPassword) { el.error.textContent = '请填写密码'; return; }
  await persist();
  hasPassword = hasPassword || !!el.password.value;
  el.password.value = '';
  if (hasPassword) el.password.placeholder = '已保存(留空则不变)';
  await window.api.connect();
});

[el.username, el.server, el.port].forEach((i) => i.addEventListener('change', persist));

document.querySelectorAll('.mini[data-copy]').forEach((b) => {
  b.addEventListener('click', async () => {
    const which = b.getAttribute('data-copy');
    await window.api.copy(which === 'pac' ? pacUrl : `socks5://127.0.0.1:${el.port.value || 1080}`);
    const old = b.textContent; b.textContent = '已复制'; b.classList.add('done');
    setTimeout(() => { b.textContent = old; b.classList.remove('done'); }, 1200);
  });
});

el.openBrowser.addEventListener('click', () => window.api.openCampusBrowser());
el.logLink.addEventListener('click', (e) => { e.preventDefault(); window.api.openLog(); });

window.api.onStatus(render);
init();
