import crypto from 'node:crypto';

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const plus = (iso, min) => new Date(Date.parse(iso) + min * 60000).toISOString();

const ROOMS = [
  {
    name: 'Library',
    building: 'Library',
    floor: 1,
    x: 30,
    y: 42,
    tables: [
      { label: 'L1', capacity: 4, priority: true },
      { label: 'L2', capacity: 2, priority: false },
      { label: 'L3', capacity: 4, priority: false },
      { label: 'L4', capacity: 6, priority: true },
      { label: 'L5', capacity: 2, priority: false },
      { label: 'L6', capacity: 8, priority: false },
    ],
  },
  {
    name: 'Student Centre',
    building: 'Student Centre',
    floor: 2,
    x: 70,
    y: 62,
    tables: [
      { label: 'S1', capacity: 4, priority: true },
      { label: 'S2', capacity: 6, priority: false },
      { label: 'S3', capacity: 2, priority: false },
      { label: 'S4', capacity: 4, priority: false },
    ],
  },
];

function campus(db, suffix, isDemo) {
  for (const room of ROOMS) {
    const space = {
      id: id(),
      name: room.name + (suffix ? ` ${suffix}` : ''),
      building: room.building,
      floor: room.floor,
      map_x: room.x,
      map_y: room.y,
      is_demo: isDemo,
    };
    db.spaces.push(space);
    for (const t of room.tables) {
      db.tables.push({
        id: id(),
        space_id: space.id,
        label: t.label,
        capacity: t.capacity,
        is_priority: t.priority,
        reported_busy_until: null,
        is_demo: isDemo,
      });
    }
  }
}

export function seedDb() {
  const db = {
    profiles: [],
    spaces: [],
    tables: [],
    bookings: [],
    booking_members: [],
    points_ledger: [],
    status_reports: [],
    mode_feedback: [],
    navigator_runs: [],
    sensor_readings: [],
    demo_seeded_at: now(),
  };

  const people = [
    ['seeker', 'Demo Seeker', 'Informatics', 2023, 20, true],
    ['host', 'Demo Host', 'Information Systems', 2022, 120, true],
    ['guest', 'Demo Guest', 'Data Science', 2023, 35, true],
    ['navigator', 'Demo Navigator', 'Informatics', 2021, 180, true],
    ['admin', 'Demo Admin', 'Campus Operations', 2024, 0, true],
  ];
  for (const [persona, name, program, year, points, isDemo] of people) {
    db.profiles.push({
      id: id(),
      persona,
      display_name: name,
      study_program: program,
      intake_year: year,
      points_balance: points,
      checkin_streak: 0,
      perks_paused_until: null,
      email: null,
      is_demo: isDemo,
    });
  }

  campus(db, 'Demo', true);
  campus(db, '', false);

  seedDemoState(db);
  return db;
}

// Called on demo login and by the hourly job: keeps the seeded demo usable
// without wiping a judge who is mid-journey.
export function ensureDemoFresh(db, at = new Date()) {
  const demoUsers = db.profiles.filter((p) => p.is_demo).map((p) => p.id);
  const live = db.bookings.some(
    (b) =>
      demoUsers.includes(b.host_id) &&
      (b.status === 'reserved' || b.status === 'active') &&
      Date.parse(b.ends_at) > at.getTime() + 5 * 60000,
  );
  const stale = at.getTime() - Date.parse(db.demo_seeded_at || 0) > 60 * 60 * 1000;
  if (!live || stale) {
    seedDemoState(db);
    return true;
  }
  return false;
}

// Rebuilds only demo rows, so a judge who opens the app hours later still finds
// the published Networking Open Table waiting. Real rows are untouched.
export function seedDemoState(db) {
  const demoSpaces = db.spaces.filter((s) => s.is_demo).map((s) => s.id);
  const demoTables = db.tables.filter((t) => demoSpaces.includes(t.space_id)).map((t) => t.id);
  const demoNames = ['seeker', 'host', 'guest', 'navigator', 'admin'];
  const demoUsers = db.profiles.filter((p) => p.is_demo);
  const userIds = demoUsers.map((p) => p.id);

  db.bookings = db.bookings.filter((b) => !demoTables.includes(b.table_id));
  db.booking_members = db.booking_members.filter((m) => !userIds.includes(m.user_id));
  db.points_ledger = db.points_ledger.filter((e) => !userIds.includes(e.user_id));
  db.status_reports = db.status_reports.filter((r) => !demoTables.includes(r.table_id));
  db.mode_feedback = db.mode_feedback.filter((f) => !userIds.includes(f.user_id));
  db.navigator_runs = db.navigator_runs.filter((r) => !userIds.includes(r.user_id));
  db.sensor_readings = (db.sensor_readings || []).filter((r) => !demoTables.includes(r.table_id));

  for (const p of demoUsers) {
    const preset = { seeker: 20, host: 120, guest: 35, navigator: 180, admin: 0 }[p.persona] ?? 20;
    p.points_balance = preset;
    p.checkin_streak = 0;
    p.perks_paused_until = null;
  }
  for (const t of db.tables) {
    if (demoTables.includes(t.id)) t.reported_busy_until = null;
  }

  const host = demoUsers.find((p) => p.persona === 'host');
  const table = db.tables.find((t) => demoTables.includes(t.id) && t.label === 'L3');
  if (host && table) {
    const startsAt = now();
    const booking = {
      id: id(),
      table_id: table.id,
      host_id: host.id,
      kind: 'booked',
      starts_at: startsAt,
      ends_at: plus(startsAt, 60),
      status: 'reserved',
      checkin_deadline: plus(startsAt, 15),
      open_seats: 2,
      mode: 'networking',
      topic_tag: 'Calculus',
      note: 'Group problem set, beginners welcome.',
      created_via: 'app',
      is_demo: true,
    };
    db.bookings.push(booking);
    db.booking_members.push({
      id: id(),
      booking_id: booking.id,
      user_id: host.id,
      role: 'host',
      status: 'joined',
      norms_accepted_at: startsAt,
      checked_in_at: null,
      joined_at: startsAt,
    });
  }

  db.demo_seeded_at = now();
  return db;
}
