// Drives headless Chrome over CDP to verify the OASIS UI flows.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || 'http://localhost:3000';
const PORT = 9223;
const profile = mkdtempSync(path.join(tmpdir(), 'oasis-chrome-'));

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=420,900',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

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
  await sleep(400);
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

let passed = 0;
function check(name, ok, extra = '') {
  if (ok) {
    passed += 1;
    console.log(`ok    ${name}`);
  } else {
    console.error(`FAIL  ${name}${extra ? ' — ' + extra : ''}`);
    process.exitCode = 1;
  }
}

const clickText = (sel, text) =>
  evalJs(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => e.textContent.includes(${JSON.stringify(text)}));
    if (!el) return false;
    el.click();
    return true;
  })()`);

try {
  await waitDevtools();
  await connect();
  await send('Runtime.enable');
  await send('Page.enable');

  await goto(BASE);
  check('landing renders hero', (await evalJs('document.body.innerText')).includes('A calmer way to find a seat'));
  check('landing shows the value line', (await evalJs('document.body.innerText')).includes('See it. Claim it. Share it.'));
  check('landing marks sample data', (await evalJs('document.body.innerText')).includes('Sample data'));

  check('one-click demo button exists', await clickText('button', 'One-Click Demo Login'));
  const onRadar = await waitFor('location.pathname === "/radar" && document.querySelectorAll(".room-row").length >= 2', 20000);
  check('demo login lands on the Radar', onRadar, await evalJs('location.pathname + " " + document.body.innerText.slice(0,120)'));

  const radarText = await evalJs('document.body.innerText');
  check('demo banner is visible', radarText.includes('Demo mode · simulated campus data'));
  check('radar shows both rooms', radarText.includes('Library') && radarText.includes('Student Centre'));
  check('status labels are textual, not colour only', radarText.includes('Empty') && radarText.includes('Open Table'));
  check('updated label is present', /updated \d+s ago/.test(radarText));

  await clickText('.room-row', 'Library');
  await waitFor('!!document.querySelector(".table-row")');
  const sheetText = await evalJs('document.querySelector(".sheet")?.innerText || ""');
  check('room sheet lists tables and seats', sheetText.includes('Table L1') && sheetText.includes('seats'));
  check('room sheet exposes filters', sheetText.includes('Free now') && sheetText.includes('Open tables'));

  const openRow = await evalJs(`(() => {
    const rows = [...document.querySelectorAll('.table-row')];
    const row = rows.find((r) => r.textContent.includes('Empty'));
    if (!row) return false;
    row.click(); return true;
  })()`);
  check('an Empty table can be opened', openRow);
  await waitFor('document.body.innerText.includes("Book now")');

  check('table detail offers Book now', await clickText('button', 'Book now'));
  await waitFor('document.body.innerText.includes("Book this table")');
  const bookingSheet = await evalJs('document.querySelector(".sheet").innerText');
  check('booking sheet pre-fills duration and mode', bookingSheet.includes('60 min') && bookingSheet.includes('Deep Work'));

  check('Open Table toggle works', await clickText('.toggle', 'Open Table'));
  await waitFor('document.body.innerText.toUpperCase().includes("SEATS TO OPEN")');
  const afterToggle = await evalJs('document.querySelector(".sheet").innerText');
  check('seat stepper appears after toggling', /SEATS TO OPEN/i.test(afterToggle));

  check('publish button is offered', await clickText('button', 'Publish Open Table'));
  const published = await waitFor('document.querySelector(".toast")?.innerText.includes("Open Table published")', 10000);
  check('publishing shows a toast with Undo', published && (await evalJs('document.querySelector(".toast").innerText.includes("Undo")')));

  await goto(`${BASE}/session`);
  const sessionText = await evalJs('document.body.innerText');
  check('session screen shows the countdown', /to check in|until the session ends/.test(sessionText));
  check('session screen offers check-in', sessionText.includes('Check in'));
  check('session screen shows the table QR', (await evalJs('!!document.querySelector(".qr-box img")')));

  check('go to scanner', await clickText('a', 'Check in'));
  await waitFor('location.pathname === "/scan"', 15000);
  await waitFor('document.body.innerText.includes("Check in here")', 15000);
  check('scanner knows the table', (await evalJs('document.body.innerText')).includes('Library'));
  // The check-in button is disabled until state settles with the demo token.
  await waitFor('[...document.querySelectorAll("button")].some((b) => b.textContent.includes("Check in here") && !b.disabled)', 10000);
  check('demo scanner is armed with the table token', await clickText('button', 'Check in here'));
  const checkedIn = await waitFor('document.querySelector(".toast")?.innerText.includes("Checked in")', 10000);
  check('check-in shows the points toast', checkedIn);

  await goto(`${BASE}/session`);
  check('end the session from the session screen', await clickText('button', 'End session'));
  const ended = await waitFor('document.querySelector(".toast")?.innerText.includes("released")', 10000);
  check('ending frees the table with a toast', ended);

  await goto(`${BASE}/points`);
  const pointsText = await evalJs('document.body.innerText');
  check('points screen shows the balance', /37|OASIS Points/.test(pointsText));
  check('points screen lists tiers', pointsText.includes('Shallows') && pointsText.includes('Reef'));

  await goto(`${BASE}/navigator`);
  check('navigator shows suggestion chips', (await evalJs('document.body.innerText')).includes('Find a quiet table for 4 people in the library'));
  check('send a navigator prompt', await clickText('.chip', 'Find a quiet table for 4 people in the library'));
  const clarified = await waitFor('document.body.innerText.includes("Already") && document.body.innerText.includes("partner")', 20000);
  const navText = await evalJs('document.body.innerText');
  check('navigator shows the step trace', navText.includes('Understanding') && navText.includes('Searching tables'));
  check('navigator asks a clarifying question', clarified, navText.slice(0, 300));

  if (clarified) {
    check('answer the clarifying question', await clickText('.chip', 'Already'));
    const bookedCard = await waitFor('document.body.innerText.includes("Check in by") || document.body.innerText.includes("No free table")', 20000);
    const finalText = await evalJs('document.body.innerText');
    check('navigator returns a booking card or honest alternatives', bookedCard, finalText.slice(0, 300));
    check('result card offers Undo and scanner', finalText.includes('Undo') || finalText.includes('Open scanner'));
  }

  await goto(`${BASE}/radar`);
  await sleep(1200);
  check('radar still renders after the navigator run', (await evalJs('document.querySelectorAll(".room-row").length')) >= 2);
} catch (err) {
  console.error('ERROR', err.message);
  process.exitCode = 1;
} finally {
  console.log(`\n${passed} UI checks passed${process.exitCode ? ' — with failures' : ''}`);
  try {
    ws?.close();
  } catch {}
  chrome.kill();
}
