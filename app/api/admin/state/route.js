import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { adminState } from '@/lib/admin';
import { mutate } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 });
  if (user.persona !== 'admin') return NextResponse.json({ ok: false, error: 'Admin only' }, { status: 403 });
  const state = await mutate((db) => adminState(db, db.profiles.find((p) => p.id === user.id) || user));
  return NextResponse.json({ ok: true, state }, { headers: { 'cache-control': 'no-store' } });
}
