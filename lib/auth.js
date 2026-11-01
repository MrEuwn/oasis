import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { read, mutate, secret } from './store.js';

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
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
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
