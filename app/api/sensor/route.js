import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { mutate } from '../../../lib/store.js';
import { applyReadings } from '../../../lib/sensors.js';

export const dynamic = 'force-dynamic';

// Edge detector -> server. Counts only, no frames. Shared secret in
// `x-sensor-key`; without SENSOR_SECRET set, the demo key works from localhost.
function authorised(request) {
  const expected = process.env.SENSOR_SECRET || 'oasis-demo-camera';
  const given = request.headers.get('x-sensor-key') || '';
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  if (process.env.SENSOR_SECRET) return true;
  const host = request.headers.get('host') || '';
  return host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

export async function POST(request) {
  if (!authorised(request)) return NextResponse.json({ ok: false, error: 'Bad sensor key.' }, { status: 401 });
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Send JSON.' }, { status: 400 });
  }
  const result = await mutate((db) => applyReadings(db, body, new Date()));
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
