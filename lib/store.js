import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { seedDb } from './seed.js';

const DIR = path.join(process.cwd(), '.data');
const FILE = path.join(DIR, 'db.json');
const SECRET_FILE = path.join(DIR, 'secret');
const LOCK = path.join(DIR, 'db.lock');

let db = null;
let stamp = null;
let secretCache = null;
let queue = Promise.resolve();

function ensureDir() {
  fs.mkdirSync(DIR, { recursive: true });
}

export function secret() {
  if (secretCache) return secretCache;
  ensureDir();
  if (!fs.existsSync(SECRET_FILE)) {
    fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString('hex'));
  }
  secretCache = fs.readFileSync(SECRET_FILE, 'utf8').trim();
  return secretCache;
}

function fileStamp() {
  try {
    const s = fs.statSync(FILE);
    return `${s.mtimeMs}:${s.size}`;
  } catch {
    return null;
  }
}

// Next dev renders pages and route handlers in separate workers, so the file is
// the source of truth: reload whenever another worker has written it.
function load() {
  ensureDir();
  const current = fileStamp();
  if (db && current && current === stamp) return db;
  if (!current) {
    db = seedDb();
    save(db);
    return db;
  }
  try {
    db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    stamp = current;
  } catch {
    db = db || seedDb();
  }
  return db;
}

function save(next) {
  ensureDir();
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 1));
  fs.renameSync(tmp, FILE);
  stamp = fileStamp();
}

async function acquireLock() {
  for (let i = 0; i < 500; i += 1) {
    try {
      const fd = fs.openSync(LOCK, 'wx');
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return;
    } catch {
      try {
        if (Date.now() - fs.statSync(LOCK).mtimeMs > 10000) fs.unlinkSync(LOCK);
      } catch {}
      await new Promise((r) => setTimeout(r, 10));
    }
  }
  throw new Error('Database is busy. Try again.');
}

function releaseLock() {
  try {
    fs.unlinkSync(LOCK);
  } catch {}
}

export function read() {
  return load();
}

// ponytail: JSON file + one write lock. Swap for Supabase (schema in
// supabase/schema.sql) when the pilot needs more than one server instance.
export function mutate(fn) {
  const run = queue.then(async () => {
    await acquireLock();
    try {
      stamp = null;
      const current = load();
      const result = await fn(current);
      save(current);
      return result;
    } finally {
      releaseLock();
    }
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function replaceDb(next) {
  return mutate((current) => {
    for (const key of Object.keys(current)) delete current[key];
    Object.assign(current, next);
    return next;
  });
}
