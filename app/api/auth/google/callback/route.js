import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { emailAllowed, exchangeGoogleCode, setSession, upsertGoogleUser } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const store = await cookies();
  const expected = store.get('oasis_oauth_state')?.value;

  if (!code || !expected || state !== expected) {
    return NextResponse.redirect(`${origin}/login?error=state`);
  }
  store.set('oasis_oauth_state', '', { path: '/', maxAge: 0 });

  let info;
  try {
    info = await exchangeGoogleCode(code, origin);
  } catch {
    return NextResponse.redirect(`${origin}/login?error=google`);
  }

  // Server-side domain gate: the client never decides who gets in.
  if (!emailAllowed(info.email)) {
    return NextResponse.redirect(`${origin}/login?error=domain`);
  }

  const user = await upsertGoogleUser(info);
  await setSession(user.id);
  return NextResponse.redirect(`${origin}/radar`);
}
