import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { googleAuthUrl, googleConfigured } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const origin = new URL(request.url).origin;
  if (!googleConfigured()) {
    return NextResponse.redirect(`${origin}/login?google=unconfigured`);
  }
  const { url, state } = googleAuthUrl(origin);
  const store = await cookies();
  store.set('oasis_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });
  return NextResponse.redirect(url);
}
