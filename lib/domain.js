import crypto from 'node:crypto';
import { secret } from './store.js';
import { pruneSensors, sensorFor } from './sensors.js';

export const POINTS = { CHECKIN: 10, COMPLETE: 5, HOST_SUCCESS: 15, GOOD_NEIGHBOUR: 2, MODE_RESPECTED: 3 };
export const DAILY_CAP = 50;
export const CHECKIN_MINUTES = 15;
export const PEAK = { start: 10, end: 14 };
export const ADVANCE = { Shallows: 0, Reef: 60, 'Deep Blue': 120 };
export const TIERS = [
  { name: 'Shallows', min: 0 },
  { name: 'Reef', min: 50 },
  { name: 'Deep Blue', min: 150 },
];
export const MODES = {
  deep_work: {
    label: 'Deep Work',
    icon: 'headphones',
    norms: 'I will keep this table silent: no talking, headphones and typing are fine, whisper only for logistics.',
  },
  networking: {
    label: 'Networking',
    icon: 'chat',
    norms: 'I will talk, explain and quiz, and keep the volume considerate for the room.',
  },
};

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();
export const plus = (iso, min) => new Date(Date.parse(iso) + min * 60000).toISOString();

export function tierFor(points) {
  let name = TIERS[0].name;
  for (const t of TIERS) if (points >= t.min) name = t.name;
  return name;
}

export function perksFor(profile, at = new Date()) {
  const paused = profile.perks_paused_until && Date.parse(profile.perks_paused_until) > at.getTime();
  const tier = paused ? 'Shallows' : tierFor(profile.points_balance);
  return { tier, paused: Boolean(paused), advance: ADVANCE[tier], priority: tier !== 'Shallows' };
}

export function isPeak(at = new Date()) {
  const h = at.getHours();
  return h >= PEAK.start && h < PEAK.end;
}

export function qrToken(tableId) {
  return crypto.createHmac('sha256', secret()).update('qr:' + tableId).digest('hex').slice(0, 12);
}

export function qrValid(tableId, token) {
  if (!token) return false;
  const expected = Buffer.from(qrToken(tableId));
  const given = Buffer.from(String(token).slice(0, 12));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

const isLive = (b) => b.status === 'reserved' || b.status === 'active';
const members = (db, bookingId) => db.booking_members.filter((m) => m.booking_id === bookingId);
const activeMembers = (db, bookingId) =>
  members(db, bookingId).filter((m) => m.status === 'joined' || m.status === 'checked_in');

export function seatsFree(db, booking) {
  const guests = activeMembers(db, booking.id).filter((m) => m.role === 'guest').length;
  return Math.max(0, booking.open_seats - guests);
}

export function sessionAt(db, tableId, at = new Date()) {
  return (
    db.bookings.find(
      (b) => b.table_id === tableId && isLive(b) && Date.parse(b.ends_at) > at.getTime(),
    ) || null
  );
}

export function userSession(db, userId, at = new Date()) {
  for (const b of db.bookings) {
    if (!isLive(b) || Date.parse(b.ends_at) <= at.getTime()) continue;
    const m = activeMembers(db, b.id).find((x) => x.user_id === userId);
    if (m) return { booking: b, member: m };
  }
  return null;
}

export function tableView(db, table, at = new Date()) {
  const booking = sessionAt(db, table.id, at);
  const profile = booking ? db.profiles.find((p) => p.id === booking.host_id) : null;
  const free = booking ? seatsFree(db, booking) : 0;
  const cam = sensorFor(db, table.id, at);
  const seen = cam && !cam.stale ? cam : null;
  // Camera wins only when nothing is booked: a booked (even unchecked) table
  // keeps its booking status so the app can show a no-show instead of a lie.
  const status = booking
    ? free > 0
      ? 'open'
      : 'full'
    : seen?.occupied
      ? 'in_use'
      : 'empty';
  return {
    id: table.id,
    label: table.label,
    capacity: table.capacity,
    is_priority: table.is_priority,
    status,
    busy: Boolean(table.reported_busy_until && Date.parse(table.reported_busy_until) > at.getTime()),
    camera: seen
      ? { occupied: seen.occupied, people: seen.people, chairs: seen.chairs, confidence: seen.confidence, age_s: seen.age_s, id: seen.camera }
      : null,
    seats_free: free,
    mode: booking?.mode || null,
    topic_tag: booking?.topic_tag || null,
    note: booking?.note || null,
    booking_id: booking?.id || null,
    booking_status: booking?.status || null,
    checkin_deadline: booking?.checkin_deadline || null,
    ends_at: booking?.ends_at || null,
    host: profile
      ? { name: profile.display_name.split(' ')[0], program: profile.study_program, year: profile.intake_year }
      : null,
  };
}

export function spaceView(db, space, at = new Date()) {
  const tables = db.tables.filter((t) => t.space_id === space.id).map((t) => tableView(db, t, at));
  const free = tables.filter((t) => t.status === 'empty').length;
  const open = tables.filter((t) => t.status === 'open').length;
  const inUse = tables.filter((t) => t.status === 'in_use').length;
  const camera = tables.some((t) => t.camera);
  const status = free > 0 ? 'empty' : open > 0 ? 'open' : 'full';
  return {
    id: space.id,
    name: space.name,
    building: space.building,
    floor: space.floor,
    map_x: space.map_x,
    map_y: space.map_y,
    status,
    camera,
    in_use: inUse,
    tables_free: free,
    open_tables: open,
    tables_total: tables.length,
    tables,
  };
}

export function spacesView(db, spaceIds, at = new Date()) {
  return db.spaces.filter((s) => spaceIds.includes(s.id)).map((s) => spaceView(db, s, at));
}

export function mySpaces(db, profile) {
  return db.spaces.filter((s) => s.is_demo === profile.is_demo);
}

function canUseSpace(profile, space) {
  return Boolean(space) && space.is_demo === profile.is_demo;
}

function tablePerkError(profile, table, at) {
  if (!table.is_priority || !isPeak(at)) return null;
  if (perksFor(profile, at).priority) return null;
  return 'Priority tables are for Reef tier and above during peak hours (10:00–14:00).';
}

function nextBookingOnTable(db, tableId, afterIso) {
  const after = Date.parse(afterIso);
  return (
    db.bookings.find(
      (b) => b.table_id === tableId && isLive(b) && Date.parse(b.starts_at) >= after - 60000,
    ) || null
  );
}

function ledgerToday(db, userId, at = new Date()) {
  const day = at.toDateString();
  return db.points_ledger
    .filter((e) => e.user_id === userId && new Date(e.created_at).toDateString() === day)
    .reduce((sum, e) => sum + e.points, 0);
}

function alreadyAwarded(db, userId, bookingId, event) {
  return db.points_ledger.some((e) => e.user_id === userId && e.booking_id === bookingId && e.event === event);
}

function addPoints(db, userId, bookingId, event, points, at = new Date()) {
  if (alreadyAwarded(db, userId, bookingId, event)) return 0;
  const remaining = Math.max(0, DAILY_CAP - ledgerToday(db, userId, at));
  const amount = Math.min(points, remaining);
  if (amount <= 0) return 0;
  db.points_ledger.push({
    id: newId(),
    user_id: userId,
    booking_id: bookingId,
    event,
    points: amount,
    created_at: at.toISOString(),
  });
  const profile = db.profiles.find((p) => p.id === userId);
  if (profile) profile.points_balance += amount;
  return amount;
}

export function createBooking(db, profile, opts = {}) {
  const at = new Date();
  const { tableId, duration = 60, mode = null, openSeats = 0, topic = '', note = '', startAt = null, via = 'app' } = opts;
  const table = db.tables.find((t) => t.id === tableId);
  const space = table && db.spaces.find((s) => s.id === table.space_id);
  if (!table || !canUseSpace(profile, space)) return { ok: false, error: 'Table not available.' };
  if (userSession(db, profile.id, at)) return { ok: false, error: 'You already hold an active session.' };
  const perkError = tablePerkError(profile, table, at);
  if (perkError) return { ok: false, error: perkError };
  if (!Number.isFinite(duration) || duration < 30 || duration > 120) return { ok: false, error: 'Duration must be 30–120 minutes.' };
  if (sessionAt(db, table.id, at)) return { ok: false, error: 'That table was just taken.', code: 'taken' };
  const cam = sensorFor(db, table.id, at);
  if (cam && !cam.stale && cam.occupied) {
    return {
      ok: false,
      error: `The camera sees ${cam.people} ${cam.people === 1 ? 'person' : 'people'} at that table. Pick another one.`,
      code: 'in_use',
    };
  }

  const seats = Number(openSeats) || 0;
  if (!Number.isInteger(seats) || seats < 0 || seats > table.capacity - 1) {
    return { ok: false, error: `Open seats must be 0–${table.capacity - 1}.` };
  }
  if (seats > 0 && !MODES[mode]) return { ok: false, error: 'Pick Deep Work or Networking to open seats.' };
  if (mode && !MODES[mode]) return { ok: false, error: 'Unknown table mode.' };
  if (String(note || '').length > 140) return { ok: false, error: 'Note must be 140 characters or fewer.' };

  const startsAt = startAt ? new Date(startAt) : at;
  const advance = perksFor(profile, at).advance;
  if (startsAt.getTime() < at.getTime() - 60000) return { ok: false, error: 'Start time is in the past.' };
  if (startsAt.getTime() - at.getTime() > advance * 60000 + 59000) {
    return { ok: false, error: `Your tier can book up to ${advance} minutes ahead.`, code: 'advance' };
  }

  const booking = {
    id: newId(),
    table_id: table.id,
    host_id: profile.id,
    kind: 'booked',
    starts_at: startsAt.toISOString(),
    ends_at: plus(startsAt.toISOString(), duration),
    status: 'reserved',
    checkin_deadline: plus(startsAt.toISOString(), CHECKIN_MINUTES),
    open_seats: seats,
    mode: seats > 0 ? mode : mode || null,
    topic_tag: String(topic || '').slice(0, 40) || null,
    note: String(note || '').slice(0, 140) || null,
    created_via: via,
    is_demo: Boolean(profile.is_demo),
  };
  db.bookings.push(booking);
  db.booking_members.push({
    id: newId(),
    booking_id: booking.id,
    user_id: profile.id,
    role: 'host',
    status: 'joined',
    norms_accepted_at: at.toISOString(),
    checked_in_at: null,
    joined_at: at.toISOString(),
  });
  table.reported_busy_until = null;
  return { ok: true, booking };
}

export function joinBooking(db, profile, { bookingId, normsAccepted = false } = {}) {
  const at = new Date();
  const booking = db.bookings.find((b) => b.id === bookingId);
  if (!booking || !isLive(booking) || Date.parse(booking.ends_at) <= at.getTime()) {
    return { ok: false, error: 'That Open Table is no longer available.' };
  }
  const table = db.tables.find((t) => t.id === booking.table_id);
  const space = table && db.spaces.find((s) => s.id === table.space_id);
  if (!canUseSpace(profile, space)) return { ok: false, error: 'Table not available.' };
  if (booking.host_id === profile.id) return { ok: false, error: 'You are hosting this table.' };
  if (members(db, booking.id).some((m) => m.user_id === profile.id)) return { ok: false, error: 'You already joined this table.' };
  if (userSession(db, profile.id, at)) return { ok: false, error: 'You already hold an active session.' };
  if (seatsFree(db, booking) <= 0) return { ok: false, error: 'Table is full.' };
  if (!MODES[booking.mode]) return { ok: false, error: 'This table has no mode set.' };
  if (!normsAccepted) return { ok: false, error: 'Accept the mode norms to join.', code: 'norms' };

  db.booking_members.push({
    id: newId(),
    booking_id: booking.id,
    user_id: profile.id,
    role: 'guest',
    status: 'joined',
    norms_accepted_at: at.toISOString(),
    checked_in_at: null,
    joined_at: at.toISOString(),
  });
  return { ok: true, booking, seats_free: seatsFree(db, booking) };
}

export function checkIn(db, profile, { tableId, token } = {}) {
  const at = new Date();
  const table = db.tables.find((t) => t.id === tableId);
  if (!table) return { ok: false, error: 'Unknown table.' };
  if (!qrValid(table.id, token)) return { ok: false, error: 'This QR code is not valid for that table.' };
  const booking = sessionAt(db, table.id, at);
  if (!booking) return { ok: false, error: 'No session at this table.' };
  const member = members(db, booking.id).find((m) => m.user_id === profile.id);
  if (!member || member.status === 'left' || member.status === 'expired') {
    return { ok: false, error: 'You are not part of this session.' };
  }
  if (member.checked_in_at) return { ok: false, error: 'Already checked in.' };
  if (at.getTime() > Date.parse(booking.checkin_deadline)) {
    return { ok: false, error: 'The check-in window has closed.' };
  }

  member.status = 'checked_in';
  member.checked_in_at = at.toISOString();
  if (booking.status === 'reserved') booking.status = 'active';
  profile.checkin_streak = (profile.checkin_streak || 0) + 1;
  table.reported_busy_until = null;
  const earned = addPoints(db, profile.id, booking.id, 'check_in', POINTS.CHECKIN, at);
  const host = db.profiles.find((p) => p.id === booking.host_id);
  if (member.role === 'guest' && host) {
    addPoints(db, host.id, booking.id, 'host_success', POINTS.HOST_SUCCESS, at);
  }
  return { ok: true, booking, points: earned };
}

export function scanSit(db, profile, { tableId, token, duration = 60 } = {}) {
  const at = new Date();
  const table = db.tables.find((t) => t.id === tableId);
  const space = table && db.spaces.find((s) => s.id === table.space_id);
  if (!table || !canUseSpace(profile, space)) return { ok: false, error: 'Table not available.' };
  if (!qrValid(table.id, token)) return { ok: false, error: 'This QR code is not valid for that table.' };
  if (sessionAt(db, table.id, at)) return { ok: false, error: 'That table is taken.', code: 'taken' };
  if (userSession(db, profile.id, at)) return { ok: false, error: 'You already hold an active session.' };
  const perkError = tablePerkError(profile, table, at);
  if (perkError) return { ok: false, error: perkError };
  if (!Number.isFinite(duration) || duration < 30 || duration > 120) return { ok: false, error: 'Duration must be 30–120 minutes.' };

  const booking = {
    id: newId(),
    table_id: table.id,
    host_id: profile.id,
    kind: 'walk_in',
    starts_at: at.toISOString(),
    ends_at: plus(at.toISOString(), duration),
    status: 'active',
    checkin_deadline: at.toISOString(),
    open_seats: 0,
    mode: null,
    topic_tag: null,
    note: null,
    created_via: 'app',
    is_demo: Boolean(profile.is_demo),
  };
  db.bookings.push(booking);
  db.booking_members.push({
    id: newId(),
    booking_id: booking.id,
    user_id: profile.id,
    role: 'host',
    status: 'checked_in',
    norms_accepted_at: at.toISOString(),
    checked_in_at: at.toISOString(),
    joined_at: at.toISOString(),
  });
  profile.checkin_streak = (profile.checkin_streak || 0) + 1;
  table.reported_busy_until = null;
  const earned = addPoints(db, profile.id, booking.id, 'check_in', POINTS.CHECKIN, at);
  return { ok: true, booking, points: earned };
}

export function endSession(db, profile, { bookingId, action = 'leave' } = {}) {
  const at = new Date();
  const booking = db.bookings.find((b) => b.id === bookingId);
  if (!booking) return { ok: false, error: 'Session not found.' };
  const mine = members(db, booking.id).find((m) => m.user_id === profile.id);
  if (!mine) return { ok: false, error: 'That is not your session.' };
  const isHost = mine.role === 'host';
  let points = 0;

  if (action === 'extend') {
    if (!isHost) return { ok: false, error: 'Only the host can extend.' };
    if (nextBookingOnTable(db, booking.table_id, booking.ends_at)) {
      return { ok: false, error: 'Another booking starts right after this one.' };
    }
    booking.ends_at = plus(booking.ends_at, 30);
    return { ok: true, booking, points: 0 };
  }

  if (!isLive(booking)) return { ok: false, error: 'That session already ended.' };

  if (action === 'leave' && !isHost) {
    mine.status = mine.checked_in_at ? 'completed' : 'left';
    if (mine.checked_in_at) points += addPoints(db, profile.id, booking.id, 'complete', POINTS.COMPLETE, at);
    return { ok: true, booking, points };
  }

  // Host ends the table: close it for everyone.
  booking.status = 'completed';
  for (const m of members(db, booking.id)) {
    if (m.status === 'joined' || m.status === 'checked_in') {
      m.status = m.checked_in_at ? 'completed' : 'left';
    }
    if (m.checked_in_at) {
      points += addPoints(db, m.user_id, booking.id, 'complete', POINTS.COMPLETE, at);
    }
  }
  if (mine.checked_in_at && Date.parse(booking.ends_at) - at.getTime() >= 10 * 60000) {
    points += addPoints(db, profile.id, booking.id, 'good_neighbour', POINTS.GOOD_NEIGHBOUR, at);
  }
  return { ok: true, booking, points };
}

export function reportBusy(db, profile, { tableId } = {}) {
  const at = new Date();
  const table = db.tables.find((t) => t.id === tableId);
  const space = table && db.spaces.find((s) => s.id === table.space_id);
  if (!table || !canUseSpace(profile, space)) return { ok: false, error: 'Table not available.' };
  if (sessionAt(db, table.id, at)) return { ok: false, error: 'This table already shows as taken.' };
  const recent = db.status_reports.filter(
    (r) => r.table_id === table.id && at.getTime() - Date.parse(r.created_at) < 10 * 60000,
  );
  if (recent.some((r) => r.user_id === profile.id)) return { ok: false, error: 'You already reported this table.' };
  db.status_reports.push({ id: newId(), table_id: table.id, user_id: profile.id, created_at: at.toISOString() });
  const reporters = new Set(recent.map((r) => r.user_id));
  const flagged = reporters.size + 1 >= 2;
  if (flagged) table.reported_busy_until = plus(at.toISOString(), 60);
  return { ok: true, flagged, reports: reporters.size + 1 };
}

export function removeGuest(db, profile, { bookingId, userId } = {}) {
  const booking = db.bookings.find((b) => b.id === bookingId);
  if (!booking || booking.host_id !== profile.id) return { ok: false, error: 'Only the host can remove a guest.' };
  if (!(booking.status === 'reserved' || booking.status === 'active')) {
    return { ok: false, error: 'That session already ended.' };
  }
  const member = members(db, booking.id).find((m) => m.user_id === userId && m.role === 'guest');
  if (!member) return { ok: false, error: 'Guest not found.' };
  member.status = 'left';
  return { ok: true, booking };
}

export function cancelBooking(db, profile, { bookingId } = {}) {
  const at = new Date();
  const booking = db.bookings.find((b) => b.id === bookingId);
  if (!booking || booking.host_id !== profile.id) return { ok: false, error: 'Booking not found.' };
  if (booking.status !== 'reserved') return { ok: false, error: 'Only a booking that has not started yet can be cancelled.' };
  if (members(db, booking.id).some((m) => m.checked_in_at)) return { ok: false, error: 'Someone has already checked in.' };
  booking.status = 'cancelled';
  for (const m of members(db, booking.id)) m.status = 'left';
  return { ok: true, booking };
}

export function modeFeedback(db, profile, { bookingId, respected } = {}) {
  const at = new Date();
  const booking = db.bookings.find((b) => b.id === bookingId);
  if (!booking) return { ok: false, error: 'Session not found.' };
  if (!members(db, booking.id).some((m) => m.user_id === profile.id)) {
    return { ok: false, error: 'That is not your session.' };
  }
  const existing = db.mode_feedback.find((f) => f.booking_id === booking.id && f.user_id === profile.id);
  if (existing) existing.respected = Boolean(respected);
  else
    db.mode_feedback.push({
      id: newId(),
      booking_id: booking.id,
      user_id: profile.id,
      respected: Boolean(respected),
      created_at: at.toISOString(),
    });
  const points = respected ? addPoints(db, profile.id, booking.id, 'mode_respected', POINTS.MODE_RESPECTED, at) : 0;
  return { ok: true, points };
}

function pauseForMisses(db, profile, at) {
  const since = at.getTime() - 14 * 24 * 60 * 60000;
  const misses = db.bookings.filter(
    (b) => b.host_id === profile.id && b.status === 'expired' && Date.parse(b.created_at || b.starts_at) >= since,
  ).length;
  if (misses >= 3 && !(profile.perks_paused_until && Date.parse(profile.perks_paused_until) > at.getTime())) {
    profile.perks_paused_until = new Date(at.getTime() + 7 * 24 * 60 * 60000).toISOString();
  }
}

// ponytail: in-process interval + /api/cron. Replace with pg_cron when moving to Supabase.
export function runJobs(db, at = new Date()) {
  let expired = 0;
  let closed = 0;
  pruneSensors(db, at);

  for (const b of db.bookings) {
    if (!isLive(b)) continue;
    const people = members(db, b.id);
    const checkedIn = people.filter((m) => m.checked_in_at);

    if (b.status === 'reserved' && Date.parse(b.checkin_deadline) < at.getTime() && checkedIn.length === 0) {
      b.status = 'expired';
      b.created_at = b.starts_at;
      for (const m of people) {
        m.status = 'expired';
        const p = db.profiles.find((x) => x.id === m.user_id);
        if (p) p.checkin_streak = 0;
      }
      const host = db.profiles.find((p) => p.id === b.host_id);
      if (host) pauseForMisses(db, host, at);
      expired += 1;
      continue;
    }

    if (Date.parse(b.ends_at) < at.getTime()) {
      b.status = 'completed';
      b.created_at = b.starts_at;
      for (const m of people) {
        if (m.checked_in_at) {
          addPoints(db, m.user_id, b.id, 'complete', POINTS.COMPLETE, at);
          m.status = 'completed';
        } else if (m.status === 'joined') {
          m.status = 'expired';
        }
      }
      closed += 1;
    }
  }

  for (const t of db.tables) {
    if (t.reported_busy_until && Date.parse(t.reported_busy_until) < at.getTime()) t.reported_busy_until = null;
  }

  const cutoff = at.getTime() - 7 * 24 * 60 * 60000;
  db.navigator_runs = db.navigator_runs.filter((r) => Date.parse(r.created_at) >= cutoff);
  db.status_reports = db.status_reports.filter((r) => Date.parse(r.created_at) >= cutoff);

  return { expired, closed };
}
