import { mutate } from './store.js';
import {
  ADVANCE,
  CHECKIN_MINUTES,
  DAILY_CAP,
  MODES,
  PEAK,
  POINTS,
  TIERS,
  perksFor,
  qrToken,
  runJobs,
  seatsFree,
  spacesView,
  tierFor,
  userSession,
} from './domain.js';

export const EVENT_LABELS = {
  check_in: 'Checked in on time',
  complete: 'Completed a session',
  host_success: 'Hosted a successful Open Table',
  good_neighbour: 'Good Neighbour',
  mode_respected: 'Mode respected',
};

function sessionCard(db, active, at) {
  const { booking, member } = active;
  const table = db.tables.find((t) => t.id === booking.table_id);
  const space = table && db.spaces.find((s) => s.id === table.space_id);
  const people = db.booking_members.filter(
    (m) => m.booking_id === booking.id && (m.status === 'joined' || m.status === 'checked_in'),
  );
  const guests = people
    .filter((m) => m.role === 'guest')
    .map((m) => {
      const p = db.profiles.find((x) => x.id === m.user_id);
      return {
        name: p?.display_name?.split(' ')[0] || 'Student',
        user_id: m.user_id,
        program: p?.study_program || '',
        year: p?.intake_year || null,
        status: m.status,
        checked_in: Boolean(m.checked_in_at),
      };
    });
  const host = db.profiles.find((p) => p.id === booking.host_id);
  return {
    booking_id: booking.id,
    space: space?.name || '',
    table: table?.label || '',
    table_id: booking.table_id,
    capacity: table?.capacity || 0,
    mode: booking.mode,
    mode_label: booking.mode ? MODES[booking.mode].label : null,
    role: member.role,
    member_status: member.status,
    checked_in: Boolean(member.checked_in_at),
    starts_at: booking.starts_at,
    ends_at: booking.ends_at,
    checkin_deadline: booking.checkin_deadline,
    booking_status: booking.status,
    open_seats: seatsFree(db, booking),
    guests,
    topic_tag: booking.topic_tag,
    note: booking.note,
    host_name: host?.display_name?.split(' ')[0] || null,
    kind: booking.kind,
    is_live: at.getTime() < Date.parse(booking.ends_at),
  };
}

export async function buildState(profile) {
  return mutate((db) => {
    runJobs(db);
    const at = new Date();
    const me = db.profiles.find((p) => p.id === profile.id) || profile;
    const perks = perksFor(me, at);
    const active = userSession(db, me.id, at);
    const tier = tierFor(me.points_balance);
    const nextTier = TIERS.find((t) => t.min > me.points_balance) || null;
    const history = db.points_ledger
      .filter((e) => e.user_id === me.id)
      .slice(-8)
      .reverse()
      .map((e) => ({ id: e.id, event: e.event, label: EVENT_LABELS[e.event] || e.event, points: e.points, at: e.created_at }));

    const spaces = spacesView(db, db.spaces.filter((s) => s.is_demo === me.is_demo).map((s) => s.id), at);
    // ponytail: demo tables publish their static QR token so a judge can check in
    // without a printed code. Real campus tables never expose it.
    if (me.is_demo) {
      for (const space of spaces) for (const table of space.tables) table.qr_token = qrToken(table.id);
    }

    return {
      now: at.toISOString(),
      me: {
        id: me.id,
        name: me.display_name,
        first_name: me.display_name.split(' ')[0],
        program: me.study_program,
        year: me.intake_year,
        points: me.points_balance,
        tier,
        next_tier: nextTier ? { name: nextTier.name, at: nextTier.min } : null,
        streak: me.checkin_streak,
        paused_until: me.perks_paused_until,
        paused: perks.paused,
        advance: perks.advance,
        priority: perks.priority,
        is_demo: me.is_demo,
      },
      spaces,
      my_session: active ? sessionCard(db, active, at) : null,
      points_history: history,
      config: {
        peak: PEAK,
        peak_now: at.getHours() >= PEAK.start && at.getHours() < PEAK.end,
        checkin_minutes: CHECKIN_MINUTES,
        daily_cap: DAILY_CAP,
        durations: [30, 60, 90, 120],
        modes: MODES,
        tiers: TIERS,
        advance: ADVANCE,
        points: POINTS,
        ai: Boolean(process.env.GEMINI_API_KEY),
        google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        allowed_domains: (process.env.ALLOWED_EMAIL_DOMAINS || 'upnjatim.ac.id,student.upnjatim.ac.id').split(','),
      },
    };
  });
}
