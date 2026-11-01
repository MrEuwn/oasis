// Rule-level checks that do not need a server: node scripts/unit.mjs
import { seedDb, seedDemoState } from '../lib/seed.js';
import {
  DAILY_CAP,
  checkIn,
  createBooking,
  joinBooking,
  qrToken,
  runJobs,
  seatsFree,
  sessionAt,
  tableView,
  userSession,
} from '../lib/domain.js';

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

const db = seedDb();
const demoSeeker = db.profiles.find((p) => p.persona === 'seeker');
const demoGuest = db.profiles.find((p) => p.persona === 'guest');
const demoNav = db.profiles.find((p) => p.persona === 'navigator');
const host = db.profiles.find((p) => p.persona === 'host');

const hostBooking = db.bookings.find((b) => b.host_id === host.id);
check('seed publishes a host Open Table with 2 seats', Boolean(hostBooking) && seatsFree(db, hostBooking) === 2);
check('seeded open table shows as Open Table', tableView(db, db.tables.find((t) => t.id === hostBooking.table_id)).status === 'open');

const freeTable = db.tables.find((t) => !sessionAt(db, t.id) && t.capacity >= 4 && t.label !== 'L3' && t.is_demo);
const first = createBooking(db, demoSeeker, { tableId: freeTable.id, duration: 60, mode: 'deep_work', openSeats: 1 });
check('booking reserves a table', first.ok);
check('host holds exactly one active session', userSession(db, demoSeeker.id) !== null);

const twice = createBooking(db, demoSeeker, { tableId: freeTable.id, duration: 60 });
check('one active session per user', !twice.ok);

const guestJoin = joinBooking(db, demoGuest, { bookingId: first.booking.id, normsAccepted: true });
check('guest joins a seat', guestJoin.ok);
check('seat count reaches zero', seatsFree(db, first.booking) === 0);
const navJoin = joinBooking(db, demoNav, { bookingId: first.booking.id, normsAccepted: true });
check('overbooking is refused', !navJoin.ok && /full/i.test(navJoin.error));

// Daily cap: many real check-ins in one day must stop at the cap.
const capped = seedDb();
const seeker = capped.profiles.find((p) => p.persona === 'seeker');
for (let i = 0; i < 8; i += 1) {
  const t = capped.tables.find((x) => x.is_demo && !sessionAt(capped, x.id) && x.label !== 'L3');
  const b = createBooking(capped, seeker, { tableId: t.id, duration: 30 });
  if (!b.ok) break;
  checkIn(capped, seeker, { tableId: t.id, token: qrToken(t.id) });
  b.booking.status = 'completed';
}
const today = capped.points_ledger
  .filter((e) => e.user_id === seeker.id)
  .reduce((sum, e) => sum + e.points, 0);
check('daily cap is enforced server-side', today === DAILY_CAP, `today=${today}`);

// Expiry: an unchecked booking past its deadline is released, no points, streak reset.
const expiryDb = seedDb();
const s2 = expiryDb.profiles.find((p) => p.persona === 'seeker');
const t2 = expiryDb.tables.find((t) => t.is_demo && !sessionAt(expiryDb, t.id) && t.label !== 'L3');
const pending = createBooking(expiryDb, s2, { tableId: t2.id, duration: 60 });
s2.checkin_streak = 4;
const before = s2.points_balance;
pending.booking.checkin_deadline = new Date(Date.now() - 60000).toISOString();
const jobs = runJobs(expiryDb);
check('expired bookings are released by the job', jobs.expired === 1 && pending.booking.status === 'expired', JSON.stringify(jobs));
check('no points for a missed check-in', s2.points_balance === before);
check('missed check-in resets the streak', s2.checkin_streak === 0);

// Demo refresh keeps the host table alive without touching real rows.
const fresh = seedDb();
const realTable = fresh.tables.find((t) => !t.is_demo);
const realUser = fresh.profiles.find((p) => !p.is_demo);
fresh.profiles.push({ ...realUser, id: 'real-user', display_name: 'Real Student', is_demo: false, email: 'student@upnjatim.ac.id' });
fresh.bookings.push({
  id: 'real-booking',
  table_id: realTable.id,
  host_id: 'real-user',
  kind: 'booked',
  starts_at: new Date().toISOString(),
  ends_at: new Date(Date.now() + 3600000).toISOString(),
  status: 'reserved',
  checkin_deadline: new Date(Date.now() + 900000).toISOString(),
  open_seats: 0,
  mode: null,
  is_demo: false,
});
seedDemoState(fresh);
const survivor = fresh.bookings.find((b) => b.id === 'real-booking');
check('demo reseed preserves real rows', Boolean(survivor) && survivor.status === 'reserved');
check('demo reseed rebuilds exactly one host Open Table', fresh.bookings.filter((b) => b.is_demo).length === 1);

console.log(`\n${passed} checks passed${process.exitCode ? ' — with failures' : ''}`);
