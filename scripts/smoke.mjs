// End-to-end check against a running dev server: node scripts/smoke.mjs
const BASE = process.env.BASE || 'http://localhost:3000';

let passed = 0;
function check(name, ok, extra = '') {
  if (!ok) {
    console.error(`FAIL  ${name}${extra ? ' — ' + extra : ''}`);
    process.exitCode = 1;
  } else {
    passed += 1;
    console.log(`ok    ${name}`);
  }
}

class Client {
  constructor() {
    this.cookie = '';
  }
  async req(path, method = 'GET', body) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    const set = res.headers.get('set-cookie');
    if (set) {
      const pair = set.split(';')[0];
      if (pair.startsWith('oasis_session=')) this.cookie = pair;
    }
    const type = res.headers.get('content-type') || '';
    const data = type.includes('application/json') ? await res.json() : await res.text();
    return { status: res.status, data };
  }
  act(action, payload = {}) {
    return this.req('/api/act', 'POST', { action, ...payload });
  }
  login(persona) {
    return this.req('/api/auth/demo', 'POST', { persona });
  }
}

const anon = new Client();
const unauth = await anon.req('/api/state');
check('unauthenticated state is rejected', unauth.status === 401);

const seeker = new Client();
const login = await seeker.login('seeker');
check('one-click demo login', login.status === 200 && login.data.ok);
await seeker.act('reset_demo');

let state = (await seeker.req('/api/state')).data.state;
const lib = state.spaces.find((s) => s.name.startsWith('Library'));
const free = lib.tables.find((t) => t.status === 'empty' && t.capacity >= 4 && t.label !== 'L3');
check('radar exposes demo tables with status', Boolean(free), lib?.tables?.map((t) => t.label).join(','));

const booking = await seeker.act('create_booking', {
  tableId: free.id,
  duration: 60,
  mode: 'deep_work',
  openSeats: 1,
  topic: 'Calculus',
});
check('create booking', booking.data.ok, JSON.stringify(booking.data.error));
state = booking.data.state;
const booked = state.spaces.flatMap((s) => s.tables).find((t) => t.id === free.id);
check('table turns Open Table with 1 seat', booked.status === 'open' && booked.seats_free === 1, `${booked?.status}/${booked?.seats_free}`);

const second = await seeker.act('create_booking', { tableId: free.id, duration: 60 });
check('double booking on same table is refused', !second.data.ok);

const checkin = await seeker.act('checkin', { tableId: free.id, token: booked.qr_token });
check('host QR check-in awards +10', checkin.data.ok && checkin.data.points === 10, JSON.stringify(checkin.data.error));

const guest = new Client();
await guest.login('guest');
const rejected = await guest.act('join', { bookingId: booked.booking_id, normsAccepted: false });
check('join without accepting norms is refused', !rejected.data.ok && rejected.data.code === 'norms');
const joined = await guest.act('join', { bookingId: booked.booking_id, normsAccepted: true });
check('guest joins and seat count drops', joined.data.ok && joined.data.state.spaces.flatMap((s) => s.tables).find((t) => t.id === free.id).seats_free === 0);

const guestSession = joined.data.state.my_session;
const guestCheckin = await guest.act('checkin', { tableId: free.id, token: booked.qr_token });
check('guest check-in awards +10', guestCheckin.data.ok && guestCheckin.data.points === 10, JSON.stringify(guestCheckin.data.error));
check('guest sees host first name and mode', Boolean(guestSession?.mode_label) && Boolean(guestSession?.host_name));

const nav = new Client();
await nav.login('navigator');
const full = await nav.act('join', { bookingId: booked.booking_id, normsAccepted: true });
check('third guest is refused when the table is full', !full.data.ok && /full/i.test(full.data.error || ''), full.data.error);

state = (await seeker.req('/api/state')).data.state;
check('host earns hosting bonus', state.me.points === 45, `points=${state.me.points}`);

const leave = await seeker.act('end', { bookingId: booked.booking_id, endAction: 'leave' });
check('host releases the table', leave.data.ok);
state = leave.data.state;
check('completion + good neighbour points', state.me.points === 52, `points=${state.me.points}`);
const freed = state.spaces.flatMap((s) => s.tables).find((t) => t.id === free.id);
check('table returns to Empty', freed.status === 'empty', freed.status);

const otherFree = state.spaces.flatMap((s) => s.tables).find((t) => t.status === 'empty' && t.label !== 'L3' && t.id !== free.id);
const walkin = await seeker.act('scan_sit', { tableId: otherFree.id, token: otherFree.qr_token, duration: 30 });
check('scan & sit claims a free table', walkin.data.ok && walkin.data.booking_id, JSON.stringify(walkin.data.error));
const walkinTable = walkin.data.state.spaces.flatMap((s) => s.tables).find((t) => t.id === otherFree.id);
check('walk-in shows the table as Full', walkinTable.status === 'full', walkinTable.status);
await seeker.act('end', { bookingId: walkin.data.booking_id, endAction: 'leave' });

const report1 = await guest.act('report_busy', { tableId: otherFree.id });
const report2 = await nav.act('report_busy', { tableId: otherFree.id });
check('two reports flag the table as busy', report1.data.ok && report2.data.flagged === true);

const clarify = await nav.req('/api/navigator', 'POST', { prompt: 'Find a quiet table for 4 people in the library' });
check('navigator asks one clarifying question', Boolean(clarify.data.clarification?.options?.length), JSON.stringify(clarify.data.error));
const option = clarify.data.clarification.options.find((o) => /We're all|Already/i.test(o.label));
const bookedByAi = await nav.req('/api/navigator', 'POST', { intent: option.value, source: clarify.data.source, prompt: option.label });
check('navigator books after the answer', bookedByAi.data.ok && /Library/.test(bookedByAi.data.result?.space || ''), JSON.stringify(bookedByAi.data));
check('result card carries check-in deadline and undo', Boolean(bookedByAi.data.result?.checkin_deadline));
const undo = await nav.act('cancel', { bookingId: bookedByAi.data.result.booking_id });
check('undo cancels for free', undo.data.ok);

const offTopic = await nav.req('/api/navigator', 'POST', { prompt: 'What is the weather like tomorrow?' });
check('navigator declines off-topic requests', !offTopic.data.ok && /only help/i.test(offTopic.data.error || ''), offTopic.data.error);

const qr = await seeker.req(`/api/qr/${free.id}`);
check('table QR renders as SVG', qr.status === 200 && String(qr.data).startsWith('<svg'));

const reset = await seeker.act('reset_demo');
check('reset demo restores the seed', reset.data.ok && reset.data.state.me.points === 20, `points=${reset.data.state.me.points}`);

console.log(`\n${passed} checks passed${process.exitCode ? ' — with failures' : ''}`);
