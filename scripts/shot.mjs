// Screenshots of the v4 web UI via headless Chrome + CDP.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:3001';
const PORT = 9333;
const OUT = path.join(process.cwd(), 'shots');
mkdirSync(OUT, { recursive: true });
const profile = mkdtempSync(path.join(tmpdir(), 'oasis-shot-'));

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--hide-scrollbars',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('devtools not ready');
}

const ws = new WebSocket(await wsUrl());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
function send(method, params = {}) {
  id += 1;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => pending.set(id, resolve));
}

async function viewport(w, h) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
}

async function go(url) {
  await send('Page.navigate', { url });
  await sleep(1400);
}

async function shot(name) {
  const res = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(res.result.data, 'base64'));
  console.log('shot', name);
}

const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  return r.result?.result?.value;
};

try {
  await send('Page.enable');
  await send('Runtime.enable');

  await viewport(1440, 900);
  await go(`${BASE}/`);
  await shot('01-landing');

  await evalJs(`fetch('/api/auth/demo',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:'admin'})}).then(r=>r.json())`);
  await go(`${BASE}/admin`);
  await shot('02-admin');
  await evalJs(`[...document.querySelectorAll('.a4-cam-tabs button')].find(b=>/Library/i.test(b.textContent))?.click()`);
  await sleep(2200);
  await shot('02b-admin-library');

  await evalJs(`fetch('/api/auth/demo',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:'seeker'})}).then(r=>r.json())`);
  await go(`${BASE}/radar`);
  await shot('03-user');

  await viewport(390, 844);
  await go(`${BASE}/radar`);
  await shot('04-user-mobile');
  await go(`${BASE}/`);
  await shot('05-landing-mobile');

  await viewport(1440, 900);
  await go(`${BASE}/radar`);
  const full = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(path.join(OUT, '06-user-full.png'), Buffer.from(full.result.data, 'base64'));
  console.log('shot 06-user-full', await evalJs('document.documentElement.scrollHeight + "px tall vs " + innerHeight'));

  console.log('text:', await evalJs('document.body.innerText.slice(0,300).replace(/\\n/g," | ")'));
} finally {
  ws.close();
  chrome.kill();
}
