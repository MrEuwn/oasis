// PRD D9 rehearsal: 20 consecutive demo logins and 10 end-to-end Navigator runs.
const BASE = process.env.BASE || 'http://localhost:3000';

class Client {
  constructor() { this.cookie = ''; }
  async req(path, method = 'GET', body) {
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(this.cookie ? { cookie: this.cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set?.startsWith('oasis_session=')) this.cookie = set.split(';')[0];
    const type = res.headers.get('content-type') || '';
    return { status: res.status, data: type.includes('json') ? await res.json() : await res.text() };
  }
  act(action, payload = {}) { return this.req('/api/act', 'POST', { action, ...payload }); }
}

let logins = 0;
for (let i = 0; i < 20; i += 1) {
  const c = new Client();
  const res = await c.req('/api/auth/demo', 'POST', { persona: 'seeker' });
  if (res.data.ok) logins += 1;
  else console.error(`login ${i + 1} failed: ${res.data.error || res.status}`);
}
console.log(`demo logins: ${logins}/20`);

const personas = ['navigator', 'guest', 'seeker'];
const clients = [];
for (const persona of personas) {
  const c = new Client();
  await c.req('/api/auth/demo', 'POST', { persona });
  clients.push(c);
}

const latencies = [];
let booked = 0;
for (let i = 0; i < 10; i += 1) {
  const client = clients[i % clients.length];
  await client.act('reset_demo');
  const started = Date.now();
  const first = await client.req('/api/navigator', 'POST', { prompt: 'Find a quiet table for 4 people in the library' });
  const option = first.data.clarification?.options?.find((o) => /Already/i.test(o.label));
  const second = await client.req('/api/navigator', 'POST', { intent: option?.value, source: first.data.source, prompt: option?.label || '' });
  const took = Date.now() - started;
  if (second.data.ok && second.data.result?.space) {
    booked += 1;
    latencies.push(took);
    await client.act('cancel', { bookingId: second.data.result.booking_id });
  } else {
    console.error(`run ${i + 1} failed: ${second.data.error || 'no result'}`);
  }
}
latencies.sort((a, b) => a - b);
const median = latencies.length ? latencies[Math.floor(latencies.length / 2)] : 0;
console.log(`navigator runs: ${booked}/10 booked, median ${median} ms (two prompts per run)`);
console.log(booked === 10 && logins === 20 ? 'rehearsal passed' : 'rehearsal FAILED');
process.exitCode = booked === 10 && logins === 20 ? 0 : 1;
