// Drives headless Chrome over CDP to verify the OASIS v4 UI: landing roles,
// the single user screen, the admin dashboard, and no horizontal overflow.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://localhost:3000';
const PORT = 9224;
const profile = mkdtempSync(path.join(tmpdir(), 'oasis-ui-'));

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--window-size=1440,900',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitDevtools() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome devtools did not start');
}

let ws;
let nextId = 1;
const pending = new Map();

function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function connect() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  };
}

async function evalJs(expression) {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || 'eval failed');
  return res.result.value;
}

async function goto(url) {
  await send('Page.navigate', { url });
  await waitFor('document.readyState === "complete"', 15000);
  await sleep(450);
}

async function waitFor(expression, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await evalJs(expression)) return true;
    } catch {}
    await sleep(150);
  }
  return false;
}

async function viewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
}

let passed = 0;
const failures = [];
function check(name, ok, extra = '') {
  if (ok) {
    passed += 1;
    console.log(`ok    ${name}`);
  } else {
    failures.push(name);
    console.error(`FAIL  ${name}${extra ? ' — ' + extra : ''}`);
    process.exitCode = 1;
  }
}

const clickSel = (sel) => evalJs(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true; })()`);
const login = (persona) => evalJs(`fetch('/api/auth/demo',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({persona:${JSON.stringify(persona)}})}).then(r=>r.json()).then(r=>r.ok)`);
const reset = () => evalJs(`fetch('/api/act',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'reset_demo'})}).then(r=>r.json()).then(r=>r.ok)`);

try {
  await waitDevtools();
  await connect();
  await send('Runtime.enable');
  await send('Page.enable');
  await viewport(1440, 900);

  // ---------------------------------------------------------------- landing
  await goto(`${BASE}/`);
  const land = await evalJs('document.body.innerText');
  check('landing renders the headline', land.includes('Find a seat.'));
  check('landing states the product line', /fact, not a guess/.test(land));
  check('landing offers exactly two roles', (await evalJs('document.querySelectorAll(".l4-role").length')) === 2);
  check('role cards are Admin and User', /Admin/.test(land) && /User/.test(land));
  check('landing numbers come from the store', /10/.test(await evalJs('document.querySelector(".l4-proof").innerText')));
  check('camera state is honest', /camera|readings/i.test(await evalJs('document.querySelector(".l4-coverage").innerText')));

  // ---------------------------------------------------------------- user
  await login('seeker');
  await goto(`${BASE}/radar`);
  await waitFor('document.querySelectorAll(".u4-row").length >= 10');
  const rows = await evalJs('document.querySelectorAll(".u4-row").length');
  check('user screen lists every table', rows === 10, `rows=${rows}`);

  const hero = await evalJs('document.querySelector(".u4-count b").innerText');
  const freeRows = await evalJs('document.querySelectorAll(".u4-chip.t-empty").length');
  check('hero count matches the free rows', String(freeRows) === hero, `hero=${hero} rows=${freeRows}`);

  const camLine = await waitFor('!!document.querySelector(".u4-camline")', 6000);
  const camText = await evalJs('document.querySelector(".u4-camline")?.innerText || ""');
  check('user screen shows the camera replay line', camLine && /replay/i.test(camText), camText);

  const defDur = await evalJs('document.querySelectorAll(".u4-seg button.is-on")[0].innerText');
  const defMode = await evalJs('document.querySelectorAll(".u4-seg button.is-on")[1].innerText');
  check('booking defaults to 60 min deep work', defDur === '60' && /deep work/i.test(defMode), `${defDur}/${defMode}`);

  const overflow = await evalJs('document.documentElement.scrollWidth - window.innerWidth');
  check('no horizontal overflow at 1440', overflow <= 1, `overflow=${overflow}`);

  await clickSel('.u4-cta');
  const booked = await waitFor('!!document.querySelector(".u4-note")', 10000);
  const note = await evalJs('document.querySelector(".u4-note")?.innerText || ""');
  check('booking confirms in one action', booked && /booked/i.test(note), note);

  await reset();
  await goto(`${BASE}/radar`);
  check('reset restores the free count', (await evalJs('document.querySelectorAll(".u4-chip.t-empty").length')) === 9);

  // ---------------------------------------------------------------- admin
  await login('admin');
  await goto(`${BASE}/admin`);
  await waitFor('document.querySelectorAll(".a4-kpi").length === 4');
  const adm = await evalJs('document.body.innerText');
  check('admin shows four KPIs', (await evalJs('document.querySelectorAll(".a4-kpi").length')) === 4);
  check('admin lists the active room tables', (await evalJs('document.querySelectorAll(".a4-table").length')) === 6);
  check('admin names the model and its honest metric', /yolo/i.test(adm) && /0\.573/.test(adm));
  check('admin declares the camera state', /No camera readings yet|stale|stream lost/i.test(adm));
  check('admin keeps the event log', /event log/i.test(adm));

  const hasVideo = await evalJs('!!document.querySelector(".a4-feed video")');
  check('admin tile carries the room footage', hasVideo);
  const videoState = await evalJs(`(() => { const v = document.querySelector('.a4-feed video'); return v ? JSON.stringify({t: v.currentTime, ready: v.readyState, paused: v.paused}) : '{}'; })()`);
  const vs = JSON.parse(videoState);
  check('footage plays without a click', vs.ready >= 2 && vs.paused === false, videoState);
  const camBadges = await evalJs('document.querySelectorAll(".a4-cam").length');
  check('frame readings reach the table cards', camBadges > 0, `badges=${camBadges}`);
  const reachable = await evalJs(`(() => {
    const rows = document.querySelectorAll('.a4-table');
    const last = rows[rows.length - 1];
    if (!last) return 'no rows';
    last.scrollIntoView({ block: 'center' });
    const r = last.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight + 1 ? 'visible' : 'clipped';
  })()`);
  check('last table card is reachable', reachable === 'visible', reachable);

  const tabs = await evalJs('[...document.querySelectorAll(".a4-cam-tabs button")].map(b=>b.textContent.trim())');
  check('both rooms have a camera tab', tabs.length === 2, JSON.stringify(tabs));
  const beforeSrc = await evalJs('document.querySelector(".a4-feed video").getAttribute("src")');
  await evalJs('[...document.querySelectorAll(".a4-cam-tabs button")].find(b=>/Student Centre/i.test(b.textContent)).click()');
  await waitFor(`document.querySelector('.a4-feed video')?.getAttribute('src') !== ${JSON.stringify(beforeSrc)}`, 6000);
  const afterSrc = await evalJs('document.querySelector(".a4-feed video").getAttribute("src")');
  check('switching cameras swaps the footage', afterSrc !== beforeSrc && /canteen/.test(afterSrc), `${beforeSrc} -> ${afterSrc}`);
  const otherBadge = await waitFor('!!document.querySelector(".a4-cam")', 6000);
  check('switched frame feeds table badges', otherBadge);
  const otherTables = await evalJs('document.querySelectorAll(".a4-table").length');
  check('switched tab shows its own tables', otherTables === 4, `tables=${otherTables}`);
  const badges = await evalJs('[...document.querySelectorAll(".a4-cam")].map(e=>e.textContent.trim())');
  check('badges carry people and seen/clear', badges.some((b) => /\d+p · (seen|clear)/.test(b)), JSON.stringify(badges));
  const railFoot = await evalJs('document.querySelector(".a4-rail-foot")?.innerText || ""');
  check('rail reports fps and unassigned', /fps/.test(railFoot) && /unassigned/.test(railFoot), railFoot);
  const coverageText = await evalJs('document.querySelector(".a4-panel:last-of-type")?.innerText || document.body.innerText');
  check('coverage names the replay camera', /recorded replay/i.test(coverageText));

  await evalJs('[...document.querySelectorAll(".u4-seg button")].find(b=>b.textContent.trim()==="mock").click()');
  const mockOn = await evalJs('[...document.querySelectorAll(".u4-seg button")].find(b=>b.textContent.trim()==="mock").classList.contains("is-on")');
  check('mock source can be selected', mockOn);

  const adminOverflow = await evalJs('document.documentElement.scrollWidth - window.innerWidth');
  check('no horizontal overflow on admin', adminOverflow <= 1, `overflow=${adminOverflow}`);

  // ---------------------------------------------------------------- mobile
  await login('seeker');
  await viewport(390, 844);
  await goto(`${BASE}/radar`);
  await waitFor('document.querySelectorAll(".u4-row").length >= 10');
  const mOverflow = await evalJs('document.documentElement.scrollWidth - window.innerWidth');
  check('no horizontal overflow at 390', mOverflow <= 1, `overflow=${mOverflow}`);
  const navItems = await evalJs('document.querySelectorAll(".nav a").length');
  check('user nav stays at four items', navItems === 4, `items=${navItems}`);
  const ctaBox = await evalJs('JSON.stringify(document.querySelector(".u4-cta").getBoundingClientRect())');
  check('primary CTA is at least 44px tall', JSON.parse(ctaBox).height >= 44, ctaBox);

  await goto(`${BASE}/`);
  check('landing stacks on mobile', await evalJs('getComputedStyle(document.querySelector(".l4-body")).gridTemplateColumns.split(" ").length === 1'));

  console.log(`\n${passed} UI checks passed${failures.length ? ` — ${failures.length} failed: ${failures.join(', ')}` : ''}`);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}
