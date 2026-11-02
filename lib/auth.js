import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { read, mutate, secret } from './store.js';

const COOKIE = 'oasis_session';
const PERSONAS = ['seeker', 'host', 'guest', 'navigator', 'admin'];

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

const DEMO_DEFAULTS = {
  seeker: ['Demo Seeker', 'Informatics', 2023, 20],
  host: ['Demo Host', 'Information Systems', 2022, 120],
  guest: ['Demo Guest', 'Data Science', 2023, 35],
  navigator: ['Demo Navigator', 'Informatics', 2021, 180],
  admin: ['Demo Admin', 'Campus Operations', 2024, 0],
};

export async function loginDemo(persona) {
  if (!PERSONAS.includes(persona)) return null;
  // ponytail: old db.json files predate a persona; create the demo profile on
  // first login instead of asking a judge to wipe their store.
  const user = await mutate((db) => {
    let found = db.profiles.find((p) => p.is_demo && p.persona === persona);
    if (!found) {
      const [name, program, year, points] = DEMO_DEFAULTS[persona];
      found = {
        id: crypto.randomUUID(),
        persona,
        display_name: name,
        study_program: program,
        intake_year: year,
        points_balance: points,
        checkin_streak: 0,
        perks_paused_until: null,
        email: null,
        is_demo: true,
      };
      db.profiles.push(found);
    }
    return found;
  });
  if (!user) return null;
  await setSession(user.id);
  return user;
}
