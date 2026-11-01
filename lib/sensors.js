// Camera occupancy fusion.
// A reading is a point-in-time observation from an edge camera: counts only,
// never pixels. The server keeps the latest reading per table and lets it go
// stale on its own, so a crashed detector degrades to booking-only truth.

export const SENSOR_TTL_MS = 90_000; // three missed 30 s cycles
const PRUNE_MS = 10 * 60_000;

export function sensorFor(db, tableId, at = new Date()) {
  const row = (db.sensor_readings || []).find((r) => r.table_id === tableId);
  if (!row) return null;
  const age = at.getTime() - Date.parse(row.observed_at);
  if (age > PRUNE_MS) return null;
  return {
    camera: row.camera_id,
    occupied: Boolean(row.occupied),
    people: row.people || 0,
    chairs: row.chairs || 0,
    confidence: row.confidence ?? null,
    observed_at: row.observed_at,
    age_s: Math.max(0, Math.round(age / 1000)),
    stale: age > SENSOR_TTL_MS,
  };
}

export function applyReadings(db, payload, at = new Date()) {
  const cameraId = String(payload.camera_id || '').slice(0, 40);
  if (!cameraId) return { ok: false, error: 'camera_id is required.' };
  const rows = Array.isArray(payload.tables) ? payload.tables : null;
  if (!rows || rows.length === 0) return { ok: false, error: 'tables[] is required.' };
  if (rows.length > 64) return { ok: false, error: 'Too many tables in one reading.' };

  // A detector usually knows table labels ("L1"), not database ids. Resolve by
  // label inside the named room; fall back to raw ids for integrations.
  const spaceName = String(payload.space || '').toLowerCase();
  const space = spaceName
    ? db.spaces.find((s) => s.name.toLowerCase().replace(' demo', '') === spaceName.replace(' demo', ''))
    : null;
  const byLabel = new Map(
    db.tables.filter((t) => !space || t.space_id === space.id).map((t) => [String(t.label).toLowerCase(), t.id]),
  );
  const known = new Set(db.tables.map((t) => t.id));
  const now = at.toISOString();
  let applied = 0;
  for (const row of rows) {
    const tableId = row.table_id && known.has(row.table_id)
      ? row.table_id
      : byLabel.get(String(row.label || row.table || '').toLowerCase());
    if (!tableId) continue; // unknown table: ignore, do not invent
    const reading = {
      table_id: tableId,
      camera_id: cameraId,
      occupied: Boolean(row.occupied),
      people: clampInt(row.people, 0, 40),
      chairs: clampInt(row.chairs, 0, 40),
      confidence: clampNum(row.confidence, 0, 1),
      observed_at: now,
    };
    const i = db.sensor_readings.findIndex((r) => r.table_id === tableId);
    if (i >= 0) db.sensor_readings[i] = reading;
    else db.sensor_readings.push(reading);
    applied += 1;
  }
  db.sensor_readings = db.sensor_readings.filter(
    (r) => at.getTime() - Date.parse(r.observed_at) < PRUNE_MS,
  );
  if (!applied) return { ok: false, error: 'No known table_id in the reading.' };
  return { ok: true, applied, camera_id: cameraId, observed_at: now };
}

export function pruneSensors(db, at = new Date()) {
  const before = db.sensor_readings?.length || 0;
  db.sensor_readings = (db.sensor_readings || []).filter(
    (r) => at.getTime() - Date.parse(r.observed_at) < PRUNE_MS,
  );
  return before - db.sensor_readings.length;
}

function clampInt(value, min, max) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

function clampNum(value, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
}
