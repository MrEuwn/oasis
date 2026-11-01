import { NextResponse } from 'next/server';
import { loginDemo } from '@/lib/auth.js';
import { mutate } from '@/lib/store.js';
import { ensureDemoFresh } from '@/lib/seed.js';
import { buildState } from '@/lib/view.js';
import { rateLimit } from '@/lib/ratelimit.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const wait = rateLimit(`demo:${ip}`, 60, 60000);
  if (wait) {
    return NextResponse.json({ ok: false, error: `Too many demo logins. Try again in ${wait}s.` }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  const user = await loginDemo(body.persona || 'seeker');
  if (!user) return NextResponse.json({ ok: false, error: 'Unknown demo persona.' }, { status: 404 });
  await mutate((db) => ensureDemoFresh(db));
  const state = await buildState(user);
  return NextResponse.json({ ok: true, state });
}
