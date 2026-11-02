import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

// The demo has no live camera, so the replay timeline is the clock: pick the
// sample that matches "now" modulo the clip length. Honest label on the client.
const CAMS = ['canteen', 'library'];

function pick(samples, seconds) {
  if (!samples.length) return null;
  const dur = samples[samples.length - 1].t || 1;
  const t = seconds % dur;
  return samples.reduce((best, s) => (Math.abs(s.t - t) < Math.abs(best.t - t) ? s : best), samples[0]);
}

export async function GET() {
  const seconds = Math.floor(Date.now() / 1000);
  const out = {};
  for (const name of CAMS) {
    try {
      const raw = await readFile(path.join(process.cwd(), 'public', 'cam', `${name}.json`), 'utf8');
      const doc = JSON.parse(raw);
      const sample = pick(doc.samples, seconds);
      if (!sample) continue;
      out[name] = {
        camera_id: doc.camera_id,
        space: doc.space,
        source: 'replay',
        people: sample.people,
        unassigned: sample.unassigned ?? 0,
        confidence: sample.confidence,
        zones: sample.zones,
        fps: doc.fps,
      };
    } catch {
      // a missing timeline is not an error: the tile simply has no replay
    }
  }
  return NextResponse.json({ ok: true, cameras: out }, { headers: { 'cache-control': 'no-store' } });
}
