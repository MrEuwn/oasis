import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { buildState } from '@/lib/view';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 });
  const state = await buildState(user);
  return NextResponse.json(
    { ok: true, state },
    { headers: { 'cache-control': 'no-store' } },
  );
}
