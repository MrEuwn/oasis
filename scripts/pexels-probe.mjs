// Finds the direct CDN url of a Pexels video file by watching network resources
// in a throwaway headless Chrome. Usage: node scripts/pexels-probe.mjs <videoId>
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ARG = process.argv[2];
if (!ARG) throw new Error('usage: node scripts/pexels-probe.mjs <videoId|url>');
const TARGET = ARG.startsWith('http') ? ARG : `https://www.pexels.com/video/${ARG}/`;
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9555;
const profile = mkdtempSync(path.join(tmpdir(), 'pexels-'));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  });
  const send = (method, params = {}) => {
    id += 1;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((r) => pending.set(id, r));
  };
  const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }))?.result?.value;

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: TARGET });
  await sleep(5000);
  // an mp4 only appears once the player starts; nudge it
  await ev(`document.querySelector('video')?.play?.()`);
  await sleep(4000);
  await ev(`window.scrollTo(0, 1200)`);
  await sleep(3000);
  const urls = await ev(`JSON.stringify([...new Set(performance.getEntriesByType('resource')
    .map(e => e.name).filter(n => /(\.mp4|video-files)/.test(n)))])`);
  console.log(urls || '[]');
  const inline = await ev(`JSON.stringify([...new Set(
    (document.documentElement.innerHTML.match(/https:\/\/[a-z0-9.-]+\/[^"'\s>]+\.mp4/g) || [])
  )].slice(0, 24))`);
  console.log('inline', inline || '[]');
  ws.close();
}

main().finally(() => chrome.kill());
