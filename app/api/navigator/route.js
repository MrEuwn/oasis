import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { mutate } from '@/lib/store.js';
import { newId } from '@/lib/domain.js';
import { parseIntent, runIntent } from '@/lib/navigator.js';
import { buildState } from '@/lib/view.js';
import { rateLimit } from '@/lib/ratelimit.js';

export const dynamic = 'force-dynamic';

function cleanIntent(raw, source) {
  const room = ['library', 'student centre'].includes(String(raw.room)) ? String(raw.room) : null;
  const mode = ['deep_work', 'networking'].includes(raw.mode) ? raw.mode : null;
  return {
    room,
    anyRoom: Boolean(raw.anyRoom),
    partySize: Math.min(Math.max(Number(raw.partySize) || 0, 0), 12),
    duration: Math.min(Math.max(Number(raw.duration) || 60, 30), 120),
    mode,
    topic: raw.topic ? String(raw.topic).slice(0, 40) : null,
    startAt: raw.startAt ? new Date(raw.startAt).toISOString() : null,
    openTable: raw.openTable === null || raw.openTable === undefined ? null : Boolean(raw.openTable),
    ambiguous: Boolean(raw.ambiguous),
    offTopic: Number(raw.partySize) === 0,
    source: source || 'offline parser',
  };
}

export async function POST(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 });

  const wait = rateLimit(`nav:${user.id}`, 10, 60000);
  if (wait) {
    return NextResponse.json(
      { ok: false, error: `Slow down a moment — try again in ${wait}s.` },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const prompt = String(body.prompt || '').slice(0, 400);
  const started = Date.now();

  let intent;
  if (body.intent) {
    intent = cleanIntent(body.intent, body.source || 'offline parser');
  } else {
    if (!prompt.trim()) return NextResponse.json({ ok: false, error: 'Type a request first.' }, { status: 400 });
    intent = await parseIntent(prompt);
  }

  const outcome = await mutate((db) => {
    const me = db.profiles.find((p) => p.id === user.id);
    const run = runIntent(db, me, intent);
    db.navigator_runs.push({
      id: newId(),
      user_id: me.id,
      prompt: prompt || '(clarification answer)',
      parsed_intent: JSON.stringify(intent),
      tools_called: run.steps.map((s) => s.key).join(','),
      outcome: run.outcome,
      latency_ms: Date.now() - started,
      created_at: new Date().toISOString(),
    });
    return run;
  });

  const state = await buildState(user);
  return NextResponse.json({
    ok: outcome.outcome === 'booked',
    source: intent.source,
    intent,
    steps: outcome.steps,
    result: outcome.result || null,
    clarification: outcome.clarification || null,
    alternatives: outcome.alternatives || null,
    error: outcome.error || null,
    offer_now: Boolean(outcome.offerNow),
    latency_ms: Date.now() - started,
    state,
  });
}
