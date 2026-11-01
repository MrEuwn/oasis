# OASIS architecture

## Runtime

```
Phone / judge laptop
  │  React screens (app/*, components/*)
  │  every 2 s: GET /api/state   ← the Radar is a pure view of this payload
  ▼
Next.js route handlers (server only)
  ├─ /api/auth/demo · /api/auth/logout             session cookie (HMAC)
  ├─ /api/act                                          all mutations, one allowlist
  ├─ /api/navigator ──► Gemini API (structured intent) ──► same server actions
  ├─ /api/state                                        runs the jobs, then renders
  ├─ /api/qr/[tableId]                                 static signed QR (SVG)
  └─ /api/cron                                         expiry, closing, demo reseed
  ▼
lib/domain.js  (rules: seats, deadlines, points, tiers, peak hours)
lib/store.js   (JSON document + write lock + mtime reload)
.data/db.json
```

No browser code decides a seat count, a point award or a permission. The client sends an intention; the server validates it and returns the new state.

## Why a JSON file

The PRD targets Supabase. This build had no Supabase project (and the brief forbids cards), so the store is one JSON document with:

- a lock file so concurrent requests cannot interleave a booking (no overbooking);
- mtime-based reload so Next's page worker and route worker see each other's writes;
- the same table shapes as `supabase/schema.sql`.

Swapping to Supabase is a change of `lib/store.js` and moving `lib/domain.js` calls into Edge Functions/security-definer SQL. Nothing above that line changes.

## Invariants (enforced in `lib/domain.js`)

1. One live session per user, host or guest.
2. A seat can only be taken if `open_seats − joined guests > 0`; joining needs accepted norms.
3. A session's life: `reserved → active → completed | cancelled | expired`. Guests: `joined → checked_in → completed | left | expired`.
4. Check-in requires a valid table token, membership of the live session, and `now ≤ checkin_deadline` (15 min).
5. Points are append-only, awarded only here, capped at 50 per user per day; nothing is ever deducted.
6. Priority tables (≈30%, starred) are bookable only by Reef+ during peak hours (10:00–14:00, configurable).
7. Tier perks: Shallows 0 min advance, Reef 60, Deep Blue 120; a paused profile falls back to Shallows.
8. `runJobs` expires unchecked bookings (streak reset, no points), closes finished sessions (completion points), clears stale “reported busy” badges and prunes logs after 7 days.
9. Demo rows (`is_demo`) are invisible to real users and are rebuilt without touching real rows.

## Table status

```
session with open seats > 0 → Open Table (yellow)
session with no free seat    → Full (red)
no session                   → Empty (green)  + “Reported busy” badge after 2 reports in 10 min
```

Every status is rendered with icon, text and colour, so colour is never the only signal.

## Navigator path

1. Prompt (≤400 chars) → `/api/navigator`, rate-limited per user.
2. If `GEMINI_API_KEY`: Gemini returns strict JSON (`room`, `partySize`, `mode`, `duration`, `startAt`, `openTable`, `topic`, `ambiguous`) with an 8 s timeout; anything invalid or slow falls back to the deterministic parser, and the UI labels which one answered.
3. Server actions: `searchTables` (same filters the UI uses), `createBooking`, `cancelBooking`, `userSession`. Model text never reaches SQL, and the user's own permissions apply.
4. One clarifying question at most, then a result card with Undo and the scanner deep link.

## Room to grow

- Replace the store with Supabase + Realtime; keep `/api/act` as the contract.
- Rotating QR tokens (time-based HMAC) instead of the static per-table token.
- Web Push on session events; leaderboard; Bahasa UI toggle.
- A real scheduler for `/api/cron` (the included GitHub Actions workflow pings it hourly).
