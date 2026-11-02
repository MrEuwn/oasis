import { MODES, tableView } from './domain.js';

// Admin view: same truth as the student view, plus the detection side.
// Everything here is derived on read — no second write path to keep in sync.
const MIN_MS = 60 * 1000;

function clock(at) {
  return new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function camerasFrom(db, spaces, at) {
  const rows = db.sensor_readings || [];
  const bySpace = db.spaces.filter((s) => spaces.some((v) => v.id === s.id));
  const out = bySpace.map((space) => {
    const tables = spaces.find((v) => v.id === space.id)?.tables || [];
    const ids = tables.map((t) => t.id);
    const seen = rows.filter((r) => ids.includes(r.table_id));
    const newest = seen.map((r) => Date.parse(r.observed_at)).sort((a, b) => b - a)[0] || 0;
    const ageS = newest ? Math.round((at.getTime() - newest) / 1000) : null;
    const live = seen.length > 0 && ageS !== null && ageS < 600;
    return {
      id: seen[0]?.camera_id || null,
      space: space.name,
      floor: space.floor,
      status: live ? 'live' : seen.length ? 'stale' : 'none',
      age_s: ageS,
      tables_seen: seen.length,
      people: seen.reduce((n, r) => n + (r.people || 0), 0),
      confidence: seen[0]?.confidence ?? null,
    };
  });
  return out;
}

function feedFrom(db, at) {
  const events = [];
  const name = (id) => (db.profiles.find((p) => p.id === id)?.display_name || 'Student').split(' ')[0];
  const label = (id) => db.tables.find((t) => t.id === id)?.label || '?';

  for (const b of db.bookings.slice(-40)) {
    events.push({
      at: b.starts_at,
      who: 'booking',
      text: `${name(b.host_id)} booked ${label(b.table_id)} · ${b.mode ? MODES[b.mode]?.label || b.mode : 'solo'}` +
        (b.open_seats ? ` · ${b.open_seats} open` : ''),
      tone: b.open_seats ? 'open' : 'empty',
    });
  }
  for (const m of db.booking_members.slice(-80)) {
    if (m.checked_in_at) {
      const booking = db.bookings.find((b) => b.id === m.booking_id);
      events.push({ at: m.checked_in_at, who: 'check-in',
        text: `${name(m.user_id)} checked in to ${label(booking?.table_id)}`, tone: 'empty' });
    }
  }
  for (const e of (db.points_ledger || []).slice(-30)) {
    events.push({ at: e.created_at, who: 'points',
      text: `${name(e.user_id)} ${e.event.replace(/_/g, ' ')} · +${e.points}`, tone: 'empty' });
  }
  for (const r of (db.sensor_readings || []).slice(-30)) {
    events.push({ at: r.observed_at, who: 'sensor',
      text: `${label(r.table_id)} ${r.occupied ? 'seen occupied' : 'seen clear'} · ${r.people || 0}p · conf ${(r.confidence ?? 0).toFixed(2)}`,
      tone: r.occupied ? 'open' : 'full' });
  }
  return events
    .filter((e) => e.at && Date.parse(e.at) <= at.getTime() + MIN_MS)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 8)
    .map((e) => ({ ...e, clock: clock(e.at) }));
}

export function adminState(db, me, at = new Date()) {
  const spaces = db.spaces
    .filter((s) => s.is_demo === me.is_demo)
    .map((s) => ({
      id: s.id,
      name: s.name,
      floor: s.floor,
      tables: db.tables.filter((t) => t.space_id === s.id).map((t) => tableView(db, t, at)),
    }));

  const tables = spaces.flatMap((s) => s.tables);
  const cam = camerasFrom(db, spaces, at);
  const live = cam.filter((c) => c.status === 'live');

  return {
    now: at.toISOString(),
    me: { name: me.display_name, persona: me.persona, is_demo: me.is_demo },
    kpis: {
      free: tables.filter((t) => t.status === 'empty').length,
      total: tables.length,
      people: cam.reduce((n, c) => n + c.people, 0),
      in_use: tables.filter((t) => t.status === 'in_use').length,
      open: tables.filter((t) => t.status === 'open').length,
      full: tables.filter((t) => t.status === 'full').length,
      cameras_live: live.length,
      cameras_total: cam.length,
      alerts: cam.filter((c) => c.status === 'stale').length,
    },
    spaces,
    cameras: cam,
    feed: feedFrom(db, at),
    source: live.length ? 'live' : cam.length ? 'stale' : 'mock',
    model: {
      name: 'yolo11n · 3-class fine-tune',
      input: 'imgsz 512 · batch 1',
      map50: 0.573,
      recall: 0.532,
      latency: '0.22 s / frame · cpu',
    },
  };
}
