import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { read, mutate, secret } from './store.js';
import { newId, nowIso } from './domain.js';

const COOKIE = 'oasis_session';
const PERSONAS = ['seeker', 'host', 'guest', 'navigator'];

function sign(value) {
  const mac = crypto.createHmac('sha256', secret()).update(value).digest('base64url');
  return `${value}.${mac}`;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const cut = token.lastIndexOf('.');
  const value = token.slice(0, cut);
  const mac = token.slice(cut + 1);
  const expected = crypto.createHmac('sha256', secret()).update(value).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    return payload;
  } catch {
    return null;
  }
}

export async function setSession(userId) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, iat: Date.now() })).toString('base64url');
  const store = await cookies();
  store.set(COOKIE, sign(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.set(COOKIE, '', { path: '/', maxAge: 0 });
}

export async function currentUser() {
  const store = await cookies();
  const payload = verify(store.get(COOKIE)?.value);
  if (!payload?.uid) return null;
  return read().profiles.find((p) => p.id === payload.uid) || null;
}

export function demoPersonas() {
  return read()
    .profiles.filter((p) => p.is_demo)
    .map((p) => ({ persona: p.persona, name: p.display_name }));
}

export async function loginDemo(persona) {
  if (!PERSONAS.includes(persona)) return null;
  const user = await mutate((db) => db.profiles.find((p) => p.is_demo && p.persona === persona) || null);
  if (!user) return null;
  await setSession(user.id);
  return user;
}

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleAuthUrl(origin) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    state: crypto.randomBytes(16).toString('hex'),
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, state: params.get('state') };
}

export function allowedDomains() {
  return (process.env.ALLOWED_EMAIL_DOMAINS || 'upnjatim.ac.id,student.upnjatim.ac.id')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function emailAllowed(email) {
  const domain = String(email || '').split('@')[1]?.toLowerCase();
  return Boolean(domain) && allowedDomains().includes(domain);
}

export async function exchangeGoogleCode(code, origin) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${origin}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error('Token exchange failed');
  const tokens = await res.json();
  const info = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!info.ok) throw new Error('Userinfo failed');
  return info.json();
}

export async function upsertGoogleUser(info) {
  return mutate((db) => {
    let user = db.profiles.find((p) => p.email === info.email);
    if (!user) {
      user = {
        id: newId(),
        persona: null,
        display_name: info.name || info.email.split('@')[0],
        study_program: 'Student',
        intake_year: new Date().getFullYear(),
        points_balance: 0,
        checkin_streak: 0,
        perks_paused_until: null,
        email: info.email,
        is_demo: false,
        created_at: nowIso(),
      };
      db.profiles.push(user);
    }
    return user;
  });
}
