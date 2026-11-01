# OASIS — Product Requirements Document

**Open Academic Space and Interaction System** · STACK 2026 · Case 1: Smarter Campus and Learning

Theme: *Agent of the Ocean: Vibing Beyond the Code* · Version 3.0 · 1 November 2026 · Team: \[Team Name\]

> **Reading note.** Figures labelled *target* are goals, not results. Baselines marked *TBD* will be measured in the pilot (Section 3). Section 8 states exactly what is and is not built in the MVP, and which parts of the judge demo use simulated data.

## 1. Executive Summary

OASIS is a lightweight, zero-install Progressive Web App (PWA) that shows students of Universitas Pembangunan Nasional Veteran Jawa Timur (UPNVJT), in real time, which coworking tables are free, lets them claim one in seconds, and helps them find study partners who share their working style. A built-in AI agent, the **OASIS Navigator**, turns a plain-language request such as “Find a quiet table for 4 people in the library” into a booking and an Open Table.

**Value proposition: See it. Claim it. Share it.**

- **See it.** The real-time *Radar* colours every coworking room Green (empty), Yellow (open table) or Red (full). Status comes from bookings, QR check-ins, walk-in scans and releases, so every student sees the same picture and nobody has to patrol the rooms.
- **Claim it.** Students book a table, or scan its QR code to sit down at once, and confirm arrival within 15 minutes. Unclaimed bookings release automatically, and good habits earn **OASIS Points** that unlock priority booking at peak hours. There are no strikes.
- **Share it.** A host can open spare seats as an *Open Table* in **Deep Work** (silent) or **Networking** (discussion welcome) mode, so students know what they are joining before they walk over.
- **Or just ask.** The Navigator does all three through conversation: it searches, books and sets up the Open Table in one step.

The stack (Vercel, Supabase and the Gemini API free tier) is designed to run with no credit card and no extra hardware.

**Fit with Case 1 and the theme**

| Case 1 expectation | How OASIS answers it |
| --- | --- |
| A clear user journey | Journeys in Section 4, with exact click-paths in Section 6 |
| A working core interaction | Radar, Open Table and Navigator, live in the MVP |
| A measurable or testable benefit | Seat-finding time reduced by 50 % (*target*) and a Campus Space Efficiency metric |
| Better accessibility | Status never relies on colour alone; large touch targets; Deep Work and Networking modes |

**Agent of the Ocean.** The Navigator is a literal agent: like a navigator charting a course, it reads the request, searches, books and sets up the table. **Vibing Beyond the Code.** Table modes and OASIS Points design for how students feel, not only for what they need to do. STACK does not require an AI agent, and OASIS stays fully usable without one; we use it where it removes the most taps.

The project does not address marine issues. The ocean is our narrative and interface metaphor: the Radar sweeps the campus the way sonar sweeps water, and OASIS is the calm place students arrive at.

## 2. Problem Statement & Target Users

### 2.1 Problem breakdown

UPNVJT has recently built new coworking spaces, but nothing tells students which seats are free. Checking is manual, and when students want company, the only channel is a large group chat.

| # | Problem | Today | Consequence |
| --- | --- | --- | --- |
| PR1 | No visibility of availability | Students walk from room to room looking for an empty seat | Lost time, abandoned study plans, uneven use of the new spaces |
| PR2 | No signal of intent or accountability | Seats are claimed informally; a naive booking tool would invite ghost bookings | Tables that look taken but are empty |
| PR3 | Social friction when finding partners | Requests are posted in massive WhatsApp groups | Students hesitate to ask, so group work is done alone or at the last minute |
| PR4 | Mismatched working styles | Students who want silence and students who want discussion share the same space, with no way to signal which | Students feel unsure or unsafe about booking or joining a shared table |

*Evidence status:* the problem descriptions come from the team’s own campus observations. Quantitative baselines are TBD and will be collected as described in Section 3.3.

### 2.2 User personas

Illustrative personas with fictional names, to be refined after interviews.

| Persona | Profile | Goal | Pain point |
| --- | --- | --- | --- |
| **Rina**, the Time-Pressed Seeker | Semester 5 student with a 90-minute gap between classes | Sit down and start working within minutes | Walks through several rooms and sometimes finds nothing |
| **Dimas**, the Hesitant Collaborator | Semester 3 student with a group assignment and few contacts in other classes | Find one or two study partners whose working style suits him | Finds large group chats awkward and cannot tell whether a shared table will be quiet or chatty |
| **Pak Hadi**, the Facility Coordinator (secondary) | Staff member responsible for the coworking spaces | Understand how the spaces are used without patrolling | No utilisation data |

## 3. Goals & Success Metrics

### 3.1 Goals and non-goals

**Goals**

- **G1.** Cut the time students spend finding a seat.
- **G2.** Keep the Radar trustworthy without any sensors, using check-ins, auto-release and community reports.
- **G3.** Lower the social barrier to finding study partners, and let students choose a working style (Deep Work or Networking) before they commit.
- **G4.** Keep tables honest by rewarding good habits with OASIS Points instead of punishing mistakes.
- **G5.** Make booking effortless: one natural-language request through the Navigator replaces several taps.
- **G6.** Prove the full system runs at zero cost and survives a live pitch, even if sign-in or the AI service fails.

**Non-goals:** classroom or lecture scheduling, monitoring of students (OASIS stores no images or video), payments, native mobile apps, integration with university academic systems, and bans or fines for students.

### 3.2 Success metrics

All targets are hypotheses for the pilot, not results.

| Metric | Definition | Baseline | MVP target | Measurement |
| --- | --- | --- | --- | --- |
| Seat-finding time (median) | Time from deciding to study to being seated | TBD (observe ≥ 20 students) | −50 % | Timed observation; in-app timestamps (Radar open → check-in) |
| Wandering minutes avoided | (Baseline median − OASIS median) × searches per user per week | n/a | Reported, not targeted | Derived from the row above and app usage |
| Campus Space Efficiency | Checked-in table-hours ÷ available table-hours during opening hours | TBD (manual counts) | +15 % over baseline (*hypothesis*) | Database sessions compared with on-site counts |
| Radar accuracy | Table statuses that match a random on-site spot check | n/a | ≥ 90 % | ≥ 100 spot checks across times of day |
| Realtime propagation | p95 time from a booking or check-in to every open Radar updating | n/a | ≤ 3 s | Client timestamps |
| Navigator success rate | Prompts that end in the intended booking without manual correction | n/a | ≥ 80 % | Test set of ≥ 30 prompts in English and Bahasa Indonesia |
| Navigator time-to-booking | Median time from sending a prompt to a confirmed booking | n/a | ≤ 10 s | Server logs (depends on free-tier model latency) |
| Open Table fill rate | Open Tables that get ≥ 1 guest | n/a | ≥ 50 % | Database analytics |
| Mode respected rate | Post-session answers saying the Deep Work or Networking mode was respected | n/a | ≥ 90 % | One-tap in-app question |
| No-show rate | Bookings never checked in | n/a | ≤ 10 % | Database analytics |
| Perk adoption | Pilot users who reach the Reef tier | n/a | ≥ 25 % | Points ledger |
| Judge entry experience | One-click demo login works first time; landing page Lighthouse score (mobile) | n/a | 20 of 20 rehearsal logins; ≥ 90 Performance and Accessibility | Rehearsal log; Lighthouse |
| Cost | Monthly spend and cards on file | $0 | $0, no card | Platform billing pages |
| Pilot adoption | Unique verified users | 0 | ≥ 30 | Supabase Auth |

### 3.3 Measurement plan

1. **Baseline:** timed observation and a short survey of at least 20 students before OASIS is introduced.
2. **Radar audit:** spot-check at least 100 tables on site against what the Radar shows, and report the match rate.
3. **Navigator test set:** run at least 30 prompts (English and Bahasa Indonesia, clear and ambiguous) and record whether the intended booking resulted.
4. **Pilot:** a short live pilot with consenting students, as long as the schedule allows before Final Day.
5. **Honest reporting:** report sample sizes, and clearly mark any seeded or simulated data.

### 3.4 Sustainability and campus impact

The 50 % seat-finding target is also an energy target. Every minute not spent drifting between rooms is human energy saved, and fewer students circulating in search of a seat means calmer corridors. A good chart saves a ship the cost of a wrong turn; the Radar does the same for students.

**Campus Space Efficiency** extends the idea to the building: OASIS gets more study hours out of rooms the university already built, instead of asking for more space. Once utilisation data exists, coordinators could light and cool only the rooms students actually use. That is a post-MVP idea that needs their buy-in. We will report measured figures only, and make no energy or emissions claims until baseline and pilot data exist.

## 4. User Journeys

This section describes what the user does and what the system does. Section 6 gives the exact click-paths.

### 4.1 Seeker finds and claims a table (Rina)

1. Rina opens OASIS. The Radar is the home screen.
2. She taps a Green or Yellow room, picks a table and taps **Book now**. Duration and mode are pre-filled from her last booking.
3. The table turns Red (or Yellow if she opens seats) for everyone within seconds, and a 15-minute check-in countdown starts.
4. At the table she scans the QR code. The session becomes *Active* and she earns +10 OASIS Points.

**Alternate paths:** *Walk-in:* if she finds a Green table, she scans its QR code and taps **Sit here** to claim it for 60 minutes without booking. *Mismatch:* if a Green table is actually occupied, she taps **Someone is here** to report it. *Missed deadline:* if she does not check in within 15 minutes, the table is released and she simply earns no points for that session. Cancelling before the deadline is always free.

### 4.2 Host creates an Open Table

1. After choosing a table, the host switches on **Open Table** in the booking sheet.
2. She picks a mode, **Deep Work** (silent) or **Networking** (discussion welcome), sets how many seats to open, and optionally adds a course tag.
3. She publishes. The table turns Yellow with a mode badge, and the 15-minute check-in countdown starts.
4. She scans the QR code at the table and the session becomes *Active*. When the first guest checks in, she earns +15 OASIS Points.
5. She can close the Open Table, remove a guest or end the session at any time.

**Alternate path:** if the host does not check in within 15 minutes, the booking expires, the table is released and joined guests are notified.

### 4.3 Guest joins an Open Table (Dimas)

1. Dimas opens the Radar and sees a Yellow room.
2. He taps it and sees Open Tables with mode, course tag, seats left, time remaining and the host’s first name, study program and intake year.
3. He taps **Join** and accepts the mode norms in one tap, for example “I’ll keep this table silent”.
4. The seat count drops in real time and the host is notified.
5. He scans the QR code at the table within 15 minutes of joining and earns +10 OASIS Points.
6. After the session, a one-tap question asks whether the mode was respected.

**Alternate paths:** Dimas can leave at any time with **Leave quietly**, with no explanation and no penalty. If he does not check in within 15 minutes of joining, his seat is released.

### 4.4 Navigator books for you

1. The user opens the Navigator tab and types or taps a suggestion, for example “Find a quiet table for 4 people in the library”.
2. The Navigator sends the text to the Gemini API, which returns a structured request: library, Deep Work (quiet), capacity 4, start now, 60 minutes.
3. The agent calls its tools in order: search tables, ask at most one clarifying question if needed (“Already four of you, or find three partners?”), book the best table and set up the Open Table with the remaining seats.
4. A live step trace shows each action. The result card shows room, table, mode, time, seats open and the check-in deadline, with **Undo** and **Open scanner**.
5. The Radar updates like any other booking. If the AI service is unavailable, a pre-filled quick-booking form opens instead.

### 4.5 How the Radar stays accurate without sensors

1. Every booking, walk-in scan and release writes a session row, and the Radar reads only those rows.
2. A QR check-in confirms that the person is there. A booking not checked in by its deadline expires and the table returns to Green (a job runs every minute).
3. Five minutes before a session ends, the app asks **Still here?** The user can extend by 30 minutes (if nobody is booked next) or end now.
4. **I’m leaving** frees the table immediately and earns a small *Good Neighbour* bonus, so honest releases are rewarded.
5. If a Green table is occupied, two independent **Someone is here** reports within 10 minutes add a *Reported busy* badge until the next scan clears or confirms it.
6. Sessions that reach their scheduled end close automatically, so no table stays Red by accident.

### 4.6 Judge opens the demo

1. A judge opens the public landing page and reads the vision.
2. They tap **One-Click Demo Login**: no password and no Google sign-in.
3. They land on the Radar as *Demo Seeker*, under a “Demo mode · simulated campus data” banner, and can switch to Demo Host, Demo Guest or Demo Navigator in two taps.
4. They run the Seeker, Host and Navigator journeys, then tap **Reset demo** to restore the seeded data.

## 5. Feature Specifications

Priority uses MoSCoW: **M** = must have in the MVP, **S** = should have, **C** = could have.

### 5.1 Real-time Radar

| ID | Requirement | Priority |
| --- | --- | --- |
| R1 | A schematic SVG floor or campus map with one pin per room, coloured by status | M |
| R2 | Room colour: Green if ≥ 1 table is Empty; otherwise Yellow if ≥ 1 Open Table has free seats; otherwise Red | M |
| R3 | Tapping a room lists its tables with status, seats free, mode badge (Deep Work or Networking) and a star on priority tables | M |
| R4 | Live updates through Supabase Realtime with an “updated X s ago” label | M |
| R5 | Status is never conveyed by colour alone: every status also has an icon and a text label | M |
| R6 | Status derives only from bookings, QR check-ins, walk-in scans, releases and user reports; no hardware | M |
| R7 | Two independent **Someone is here** reports within 10 minutes on an Empty table add a *Reported busy* badge until the next scan clears or confirms it | M |
| R8 | Filters: Free now, Open Tables, mode, minimum seats | S |
| R9 | Offline app shell showing the last known state, labelled as stale | S |

**Table status rules**

| Order | Condition | Status |
| --- | --- | --- |
| 1 | A session (booked or walk-in) exists with open seats > 0 | 🟡 Open Table |
| 2 | A session exists with no open seats | 🔴 Full |
| 3 | No session | 🟢 Empty |

A reserved table that has not been checked in shows a countdown badge.

### 5.2 Open Table (matchmaking) and Table Modes

Every Open Table has a **mode**, chosen by the host, so students feel safe before they book or join.

| Mode | Meaning | Norms shown on join |
| --- | --- | --- |
| **Deep Work** | Silent study together | No talking; headphones and typing are fine; whisper only for logistics |
| **Networking** | Discussion welcome | Talk, explain and quiz each other; keep the volume considerate |

| ID | Requirement | Priority |
| --- | --- | --- |
| O1 | The host books a table for 30–120 minutes (default 60), starting now | M |
| O2 | The host opens 1 to (capacity − 1) seats and adds an optional course or topic tag and a note of up to 140 characters | M |
| O3 | Mode is required (Deep Work or Networking), fixed for the session, and shown as an icon plus label on every card | M |
| O4 | A guest accepts the mode norms with one tap when joining | M |
| O5 | Guests join instantly while seats remain; joining is transactional so seats cannot be overbooked | M |
| O6 | Guests see only the host’s first name, study program and intake year; no phone numbers or direct contacts | M |
| O7 | The host can close the table or remove a guest; a guest can **Leave quietly** at any time with no explanation and no penalty | M |
| O8 | A user can hold only one active session at a time | M |
| O9 | After the session, a one-tap question asks whether the mode was respected, plus report and block | S |
| O10 | Optional host approval of join requests | S |
| O11 | Course-based partner suggestions | C |

**Acceptance criteria**

- Given a table with 2 open seats, when two guests join at the same moment, then both succeed and a third attempt is rejected with “Table is full”.
- Given a Deep Work Open Table, when a guest taps **Join**, then the norms appear and the join completes only after the guest accepts them.
- Given an Open Table whose host has not checked in after 15 minutes, then the booking expires, the table is released and joined guests are notified.

### 5.3 QR Check-in, Scan & Sit and auto-release

| ID | Requirement | Priority |
| --- | --- | --- |
| Q1 | Each table has a printed QR code encoding the table ID and a signed token (static in the MVP). Scanning it with the phone’s own camera opens the OASIS check-in screen; an in-app scanner is also provided | M |
| Q2 | Check-in succeeds only if the scanner is the host or a joined guest of the current session at that table and the scan is before the deadline | M |
| Q3 | The deadline is 15 minutes from the booking start (“book now” = the moment of booking) for hosts, and 15 minutes from joining for guests | M |
| Q4 | If the deadline passes, the booking expires automatically and the table is released. No points are earned for that session and the user’s check-in streak resets. There are no strikes | M |
| Q5 | Cancelling before the deadline is free and neutral: no points are lost | M |
| Q6 | **Scan & Sit:** scanning the QR code of an Empty table starts a walk-in session (default 60 minutes, adjustable 30–120) and turns the table Red | M |
| Q7 | **I’m leaving** ends a session at once and frees the table | M |
| Q8 | Five minutes before the end, a **Still here?** prompt offers Extend (+30 minutes, if nobody is booked next) or End | M |
| Q9 | Sessions that reach their scheduled end close automatically | M |
| Q10 | Rotating QR codes shown on a screen | C |

*Known limitation:* a static QR code can be photographed and scanned remotely. The MVP mitigates this by binding scans to an active booking (Q2), allowing one active session per user, and relying on community reports (R7). Rotating codes are a later improvement.

### 5.4 OASIS Navigator (AI agent)

The Navigator is a chat-style agent powered by a Gemini model. It turns a natural-language request into actions: it searches the database, books the table and sets up the Open Table. It executes the booking itself and offers one-tap **Undo**. Cancelling before the check-in deadline is always free, so a wrong guess costs nothing.

| ID | Requirement | Priority |
| --- | --- | --- |
| N1 | Chat input in English and Bahasa Indonesia, with tappable suggestion chips | M |
| N2 | The LLM parses each request into a structured intent: room, party size, mode (“quiet” maps to Deep Work), start time, duration, Open Table or not, topic tag | M |
| N3 | Execution uses allowlisted tools through function calling: `search_tables`, `book_table` (including Open Table setup), `cancel_booking`, `get_my_session`. Tools run server-side as the signed-in user, so Row Level Security, perks and peak-hour rules apply exactly as in the app | M |
| N4 | A live step trace shows Understanding, Searching, Booking and Setting up Open Table | M |
| N5 | The result card shows room, table, mode, time, seats open and check-in deadline, with **Undo** and **Open scanner** | M |
| N6 | At most one clarifying question, answered by tapping an option. If nothing matches, the Navigator offers the closest alternatives instead of guessing | M |
| N7 | Guardrails: tool arguments validated against a strict schema, the model never writes SQL, off-topic requests are declined, per-user rate limit, no personal data sent in prompts | M |
| N8 | Graceful degradation: if the AI service is rate-limited or unavailable, a pre-filled quick-booking form opens within 3 seconds. A deterministic parser covers the scripted demo prompts and is labelled *offline parser* | M |
| N9 | Defaults remembered from the last booking (duration, mode) | S |
| N10 | Voice input | C |

**Example requests**

| Request | Parsed intent | Agent actions |
| --- | --- | --- |
| “Find a quiet table for 4 people in the library” | Library, Deep Work, capacity ≥ 4, now, 60 minutes | Searches; asks “Already four of you, or find three partners?”; books the table; opens 3 Deep Work seats if partners are wanted |
| “Book a table for our Calculus group at 2 PM, discussion is fine” | Networking, 14:00, topic Calculus | Checks the user’s advance-booking perk; books and opens seats, or offers “now” if the perk is not unlocked |
| “I need a spot right now, anywhere” | Any room, now, last-used mode | Books the first Empty table and returns the result card |

**Acceptance criteria**

- Given the prompt “Find a quiet table for 4 people in the library” and a free table with capacity ≥ 4, then within about 10 seconds a Deep Work booking exists, the Radar shows it, and the result card offers Undo.
- Given that the AI service is unavailable, then the quick-booking form appears within 3 seconds and no booking is made without the user’s tap.

### 5.5 OASIS Points & Perks

Points replace the strike system. Students earn them for behaviour that keeps the spaces honest and friendly, and points unlock priority booking at peak hours. All values below are configurable defaults.

| Event | Points | Rule |
| --- | --- | --- |
| Check in on time | +10 | Before the 15-minute deadline |
| Complete a session | +5 | Checked in and session reaches its end, or is ended by the user |
| Host a successful Open Table | +15 | At least one guest checks in |
| Join an Open Table and check in | +10 | Guest checks in on time |
| Good Neighbour | +2 | Release a table with **I’m leaving** at least 10 minutes early |
| Mode respected | +3 | Another participant confirms the mode was respected |

**Tiers and perks**

| Tier | Points | Perks |
| --- | --- | --- |
| Shallows | 0–49 | Book now; standard tables |
| Reef | 50–149 | Priority tables at peak hours; book up to 60 minutes ahead |
| Deep Blue | 150+ | Everything in Reef; book up to 120 minutes ahead; extend a session when nobody is waiting |

**Peak hours and Priority Tables:** peak hours are configurable (assumed 10:00–14:00). During peak hours, about 30 % of the tables in each room are marked with a star and are bookable only by Reef and Deep Blue students. Everyone can still book standard tables, and the Radar is always open to all.

**Accountability without punishment:** a missed check-in earns no points and resets the check-in streak. If a student misses three check-ins within 14 days, priority perks pause for 7 days. Booking, the Radar and the Navigator stay available, and no points are ever deducted.

| ID | Requirement | Priority |
| --- | --- | --- |
| P1 | An append-only points ledger; awards happen in server-side functions, never in the client | M |
| P2 | Tier and perks enforced server-side on every booking, including those made by the Navigator | M |
| P3 | Anti-abuse: a daily cap (assumed 50 points), points only for verified check-ins, and hosting points only when a different guest checks in (the same pair earns at most twice a day) | M |
| P4 | Profile shows balance, tier-progress ring and recent events; a toast appears when points are earned | M |
| P5 | Opt-in weekly leaderboard showing first names only | S |
| P6 | Streak badges for consecutive on-time check-ins | C |

### 5.6 Landing Page

A public landing page is the front door for students and a showcase for judges. It explains the vision before anyone signs in.

| ID | Requirement | Priority |
| --- | --- | --- |
| L1 | A public route (`/`) that needs no sign-in, is mobile-first and renders on the server for fast first paint | M |
| L2 | Hero with the product name, a one-line explanation, “See it. Claim it. Share it.” and two buttons: **Sign in with campus Google** and **Try the demo (one click)** | M |
| L3 | Problem section in student language: wandering between rooms, awkward group-chat requests, silent or social? | M |
| L4 | “How it works” in four steps: See it, Claim it, Share it, Ask it, each with a screenshot or illustration | M |
| L5 | “Who it is for”: students looking for a seat, hosts, guests who prefer Deep Work or Networking, and facility coordinators | M |
| L6 | Feature overview: Radar, Open Table, Navigator, OASIS Points, QR check-in | M |
| L7 | Campus impact strip showing the seat-finding and Campus Space Efficiency targets, labelled as targets | M |
| L8 | A read-only mini-Radar with sample data, labelled “sample data” | M |
| L9 | Footer: team, STACK 2026 and GDGoC ITB, privacy note, AI-usage note, repository link and contact | M |
| L10 | A “For judges” strip with the demo login, this PRD and the architecture overview | S |
| L11 | Lighthouse mobile Performance and Accessibility ≥ 90; WCAG 2.1 AA contrast | M |
| L12 | English and Bahasa Indonesia toggle | S |

### 5.7 Judge Demo Mode (One-Click Demo Login)

A live pitch must not depend on Google OAuth, campus email or a stable venue network. Demo Mode lets a judge enter the product in one tap.

| ID | Requirement | Priority |
| --- | --- | --- |
| D1 | The database is seeded with four demo accounts (table below) in a separate demo campus | M |
| D2 | The login page has a prominent, full-width **One-Click Demo Login** button above the fold. One tap signs the judge in as Demo Seeker; four persona chips under it sign in as another persona in one tap | M |
| D3 | No credentials are typed and no OAuth is involved. A server-side `demo-login` function returns a session for an allowlisted demo user, so no password ships in the client | M |
| D4 | Demo accounts can act only on demo spaces, enforced by Row Level Security, so real student data is never touched. A banner reads “Demo mode · simulated campus data” | M |
| D5 | **Reset demo** restores the seeded state on demand, and a scheduled job does the same hourly | M |
| D6 | Three scripted Navigator prompt chips work even if the AI service fails, using the labelled offline parser | M |
| D7 | Rate limiting on `demo-login`, and an allowlist so it can never sign in a real student | M |
| D8 | Pre-warm: opening the landing page pings the backend so the first demo tap is fast | S |
| D9 | Rehearsal checklist: 20 consecutive successful demo logins and 10 end-to-end Navigator runs before Final Day | S |

**Seeded demo accounts**

| Account | Tier and points | Seeded state | Used to demonstrate |
| --- | --- | --- | --- |
| Demo Seeker | Shallows, 20 | No session | Radar, booking, Scan & Sit |
| Demo Host | Reef, 120 | A published Networking Open Table with 2 seats open | Host journey, priority tables |
| Demo Guest | Shallows, 35 | No session | Joining the host’s table on a second device |
| Demo Navigator | Deep Blue, 180 | No session | Navigator prompts, advance booking, perks |

### 5.8 Cross-cutting requirements

| Area | Requirement |
| --- | --- |
| Identity | Supabase Auth with Google OAuth. Non-institutional emails are rejected **server-side** (Auth hook or database trigger), not only in the client. Demo accounts use the separate demo path above. Domain to confirm with the university |
| Performance | Largest Contentful Paint ≤ 2.5 s on a mid-range phone over 4G (*target*); realtime propagation p95 ≤ 3 s |
| PWA | Installable manifest, service worker, offline shell |
| Accessibility | Core flows target WCAG 2.1 AA; status never by colour alone; touch targets ≥ 48 px; reduced-motion support |
| Security | Row Level Security on every table; writes only through Edge Functions or security-definer SQL; secrets in platform environment variables, never in the repository |
| Privacy | Data minimisation (name, study program, intake year, points); no images, video or location tracking; Navigator prompts contain no personal data; logs kept 7 days; consistent with the principles of Indonesia’s Personal Data Protection Law (UU PDP No. 27/2022) |
| Language | English UI for the judges; Bahasa Indonesia UI is a should-have; the Navigator accepts both languages |
| Notifications | In-app first; Web Push where supported (iOS requires an installed PWA) |

## 6. UI/UX & User Flow

OASIS is designed for a student standing in a corridor with one free hand. The interface is mobile-first, calm and fast: a seat should be claimed in a few taps, and every tap should answer back.

### 6.1 Design principles

- **Mobile-first.** Design at 360 × 800 px and scale up. Primary actions sit in the bottom thumb zone.
- **Frictionless.** Sensible defaults (60 minutes, last-used mode) and at most 4 taps from the Radar to a reserved table.
- **Large touch targets.** At least 48 × 48 px with 8 px between targets; full-width primary buttons.
- **Clear visual feedback.** Skeleton loaders instead of blank screens, optimistic updates, a pulse on any pin that changes, a countdown ring for the check-in deadline, and toasts with **Undo** instead of confirmation dialogs.
- **Inclusive by default.** Status uses icon, label and colour together; contrast of at least 4.5:1; light and dark themes; motion reduced when the device asks for it.
- **Calm ocean aesthetic.** Deep-navy and teal surfaces, with Green, Yellow and Red reserved for status so they always carry meaning.

### 6.2 Navigation and screens

A bottom bar holds five destinations: **Radar · Navigator · Scan (raised centre button) · Session · Points**.

| Screen | Purpose | Key components |
| --- | --- | --- |
| Landing (public) | Explain OASIS before sign-in | Hero, four-step explainer, sample Radar, two CTAs |
| Login | Enter the app | Google sign-in, One-Click Demo Login, persona chips |
| Radar (home) | See availability | SVG map, status pins, filter chips, bottom sheet |
| Room sheet | Choose a table | Table rows with status, mode icon, seats left, priority star |
| Table card and booking sheet | Claim a table | Duration chips, mode selector, Open Table toggle, **Confirm** |
| Navigator | Ask in plain language | Chat input, suggestion chips, step trace, result card |
| Scanner | Check in or Scan & Sit | Viewfinder, manual-code fallback |
| Session | Manage the active session | Countdown ring, guest list, Extend, **I’m leaving** |
| Points | See progress | Balance, tier ring, perks, recent events |

### 6.3 Click-paths for the three main journeys

**A. The Seeker uses the Radar to find a table**

1. Open OASIS. The Radar is home, with the session remembered (0 taps).
2. Tap a Green or Yellow room pin (tap 1). A bottom sheet rises: “Library · 3 of 6 tables free”.
3. Tap a table row (tap 2). The table card shows status, seats, mode badge and a priority star where relevant.
4. Tap **Book now** (tap 3). The booking sheet opens with 60 minutes and the last-used mode pre-selected.
5. Tap **Confirm** (tap 4). The pin changes colour live, a countdown ring reads “Check in within 15:00”, and a preview says “+10 on check-in”.
6. At the table, tap **Scan** (tap 5), or scan the QR code with the phone camera. A check mark, a haptic buzz and “+10 OASIS Points” confirm the check-in.

*Walk-in variant:* tap **Scan** (1), scan the QR code of a Green table, tap **Sit here** (2). Total: 4 taps to reserve, 5 to be checked in.

**B. The Host creates an Open Table**

1. From the Radar, tap a Green room pin (tap 1), tap a table (tap 2) and tap **Book now** (tap 3).
2. In the booking sheet, tap the **Open Table** toggle (tap 4). The sheet expands with mode, seat stepper and course chips.
3. Confirm the mode: **Deep Work** or **Networking** (tap 5; skip if the pre-selected last-used mode is right).
4. Adjust open seats with the + and − stepper (default 2) and optionally tap a course chip.
5. Tap **Publish Open Table** (tap 6). The table turns Yellow live, with the mode badge and a countdown ring.
6. At the table, tap **Scan** (tap 7). The session is *Active*, and the host earns +15 when the first guest checks in.

Total: 6 taps to publish (5 if the default mode is kept), with a target of 30 seconds or less.

**C. The Navigator books a room with the AI agent**

1. Tap the **Navigator** tab (tap 1). A chat opens with suggestion chips such as “Quiet table for 4 in the library”.
2. Tap a chip, or type a request and tap **Send** (tap 2). Nothing else is needed.
3. Watch the live step trace without tapping: Understanding → Searching tables → Booking → Setting up Open Table.
4. If the agent needs one detail, answer by tapping an option such as “Find 3 partners” (tap 3).
5. The result card shows room, table, mode, time, seats open and check-in deadline. Tap **Open scanner** at the table, or **Undo** to cancel for free.

Total: 2 taps from opening the app to a booked table (3 with a clarifying answer).

*Also:* a guest joins in three taps (room pin → Open Table card → **Join**, plus a one-tap acceptance of the mode norms), and a judge enters in one tap (**One-Click Demo Login**).

### 6.4 Feedback and states

| Moment | Behaviour |
| --- | --- |
| Loading | Skeletons appear within 100 ms; the screen is never blank |
| Booking confirmed | Optimistic update; the pin pulses and the countdown ring starts |
| Table just taken | Sheet says “Taken a moment ago” and offers the two nearest alternatives in one tap |
| Check-in success | Check mark, haptic buzz where supported, points toast |
| Cancel or leave | One tap with an **Undo** toast, no confirmation dialog |
| Navigator working | Live step trace; the input stays editable |
| Navigator unavailable | Friendly message and a pre-filled quick-booking form |
| Offline | Banner “Offline: showing last known state”, with every status marked stale |

### 6.5 Visual system

- **Type:** one sans-serif family, 16 px base, headings 20–28 px.
- **Spacing:** an 8 px grid; rounded 12 px corners on cards and sheets.
- **Status:** Green *Empty*, Yellow *Open Table*, Red *Full*, each with its own icon and text label. Priority tables carry a star.
- **Modes:** Deep Work uses a headphones icon, Networking uses speech bubbles; both always carry a text label.
- **Motion:** 200–300 ms transitions, a sonar-style ripple on Radar updates, disabled when reduced motion is requested.

## 7. Zero-Cost Technical Architecture

OASIS has no sensors, cameras or computer vision. The Radar is a pure function of session rows in the database, written by bookings, QR check-ins, walk-in scans, releases and community reports. The only AI component is the Navigator agent.

### 7.1 Overview

```
Student phone / judge laptop: OASIS PWA (Next.js on Vercel)
   │  taps · QR scans · Navigator prompts · demo login
   ▼
Supabase Edge Functions
   ├─ create-booking · join-booking · check-in · scan-sit · end-session · report-busy
   ├─ navigator ──► Gemini API (intent parsing + function calling)
   │      └─ allowlisted tools, run as the signed-in user:
   │         search_tables · book_table · cancel_booking · get_my_session
   └─ demo-login · reset-demo
   ▼
Postgres (Row Level Security) ──► Realtime ──► Radar on every open PWA
   ▲
pg_cron: expire unchecked bookings · close finished sessions · reset demo data · prune logs
```

### 7.2 Components

Free-tier terms change, so confirm current limits when setting up. The design assumes small pilot-scale traffic.

| Layer | Service | Role | Free-tier notes |
| --- | --- | --- | --- |
| Frontend | Vercel Hobby (Next.js App Router, PWA) | Landing page, app UI, static assets, hosting on a `vercel.app` subdomain | Sign up with GitHub; non-commercial use, which suits a student project |
| Backend | Supabase Free | Postgres with RLS, Auth, Realtime, Edge Functions, `pg_cron` | No card needed; projects can pause after inactivity and have usage quotas |
| AI agent | Gemini API (free tier, key held server-side in Edge Function secrets) | Intent parsing and function calling for the Navigator | **Confirm** the current free-tier model, rate limits and data-use terms before relying on it; because free-tier prompts may be reviewed by the provider, prompts contain no personal data |
| AI fallback | Deterministic parser in the Edge Function | Handles the scripted demo prompts and basic requests when the AI service fails | $0; labelled *offline parser* in the UI |
| Check-in | Printed QR codes, in-app scanner, manual-code fallback | Proves presence at a table | $0; codes generated once and printed |
| Scheduling and keep-warm | `pg_cron` inside Supabase; a scheduled GitHub Actions workflow | Expiry and reset jobs; a periodic ping so the free Supabase project does not pause | Free for public repositories |

### 7.3 Data model

| Table | Key columns |
| --- | --- |
| `profiles` | id, display\_name, study\_program, intake\_year, points\_balance, tier, checkin\_streak, perks\_paused\_until, is\_demo |
| `spaces` | id, name, building, floor, map\_x, map\_y, is\_demo |
| `tables` | id, space\_id, label, capacity, is\_priority, qr\_secret\_hash, display\_status, reported\_busy\_until |
| `bookings` | id, table\_id, host\_id, kind (booked, walk\_in), starts\_at, ends\_at, status (reserved, active, completed, cancelled, expired), checkin\_deadline, open\_seats, mode (deep\_work, networking), topic\_tag, note, created\_via (app, navigator) |
| `booking_members` | booking\_id, user\_id, role (host, guest), status (joined, checked\_in, left, expired), norms\_accepted\_at, checked\_in\_at |
| `points_ledger` | id, user\_id, booking\_id, event, points, created\_at (append-only) |
| `status_reports` | table\_id, user\_id, created\_at |
| `mode_feedback` | booking\_id, user\_id, respected (boolean), created\_at |
| `navigator_runs` | id, user\_id, prompt, parsed\_intent, tools\_called, outcome (booked, clarified, fallback, declined), latency\_ms, created\_at (pruned after 7 days) |

Row Level Security: students can read spaces, tables and open bookings; all writes go through Edge Functions or security-definer SQL functions; the points ledger accepts inserts only from server-side functions; users flagged `is_demo` can read and write only rows in demo spaces.

### 7.4 Server functions and jobs

| Name | Trigger | Purpose |
| --- | --- | --- |
| `create-booking` | User JWT | Validates the one-session rule, peak-hour and tier perks, creates the booking and sets the 15-minute deadline |
| `join-booking` | User JWT | Transactional seat reservation after the guest accepts the mode norms |
| `check-in` | User JWT | Verifies the QR token, the user’s membership and the deadline, then awards points |
| `scan-sit` | User JWT | Starts a walk-in session on an Empty table |
| `end-session` | User JWT | Handles **I’m leaving**, **Extend** and host close |
| `report-busy` | User JWT | Records **Someone is here** and applies the two-report rule |
| `navigator` | User JWT | Runs the agent loop (Section 7.5) |
| `demo-login` | Public, rate-limited | Returns a session for an allowlisted demo user (Section 7.6) |
| `reset-demo` | Demo user or `pg_cron`, hourly | Restores the seeded demo state |
| `release_expired_bookings()` | `pg_cron`, every minute | Expires unchecked bookings, frees tables, resets the check-in streak, applies the three-misses perk pause. No points are ever deducted |
| `close_finished_sessions()` | `pg_cron`, every minute | Closes sessions that reached their end and awards completion points |
| `prune_logs()` | `pg_cron`, daily | Deletes `navigator_runs` and expired reports older than 7 days |

Clients subscribe to Realtime changes on `tables` and `bookings`, filtered by space. All points are awarded inside these server functions, never by the client.

### 7.5 Navigator agent design

1. The client sends the prompt to the `navigator` function with the user’s JWT.
2. The function calls the Gemini API with a short system prompt, the allowlisted tool definitions and the user’s prompt (no names, emails or IDs).
3. The model returns tool calls. Each call is validated against a strict schema, then executed with the user’s own permissions, so RLS, tier perks and peak-hour rules apply exactly as in the app. The model never writes SQL.
4. The loop is limited to 4 tool calls and an 8-second budget. Each step streams to the client as the live step trace.
5. If the model needs one missing detail, the function returns a clarifying question as tappable options.
6. On timeout, rate limit or schema failure, the function falls back to the offline parser or opens the quick-booking form. No booking is ever made without a valid, validated tool call.
7. User text is treated as data, not instructions: it cannot add tools or widen permissions, and off-topic requests are declined.

### 7.6 Demo login architecture

- Four demo users exist in Supabase Auth, flagged `is_demo`, with their passwords stored only in Edge Function secrets.
- `demo-login` accepts only a persona key (`seeker`, `host`, `guest`, `navigator`), signs in server-side and returns a session to the browser. No password or OAuth step is involved, and no secret ships in the client.
- The function rejects any identity outside the allowlist and is rate-limited per IP.
- The seed script and `reset-demo` rebuild the demo campus (spaces, tables, the Demo Host’s published Networking Open Table, points balances) in one transaction.
- **Plan B for the pitch:** a 60-second screen recording of the full flow, ready offline in case the venue network fails.

### 7.7 Staying at $0

1. **No payment method anywhere.** If a service asks for a card, replace it rather than add one.
2. **Keep AI calls cheap.** Tap-first flows never call the model; only Navigator prompts do. Suggestion chips and the offline parser cover the demo, and a per-user rate limit plus a global daily cap protect the free quota.
3. **Small payloads.** Realtime subscriptions are filtered by space; no images or video are stored anywhere.
4. **Keep services warm.** A scheduled GitHub Actions ping, and the app’s own traffic during the pilot, stop the free Supabase project from pausing. Opening the landing page pre-warms the demo path.
5. **Prune data.** Logs and reports are deleted after 7 days.
6. **Secrets hygiene.** Only the public anon key reaches the browser; the Gemini key and demo credentials live in platform secrets; Row Level Security is always on.

## 8. MVP Scope & Limitations

### 8.1 Scope

| In the MVP | Out of the MVP |
| --- | --- |
| Public landing page (Section 5.6) | Native iOS or Android apps |
| Institutional Google sign-in, plus One-Click Demo Login with four seeded accounts | In-app chat |
| Radar for 1–2 rooms (SVG map) and 4–6 tables, driven by sessions and reports | Any sensor, camera or computer-vision occupancy detection |
| “Book now” sessions (30–120 min) and booking up to 120 minutes ahead as a points perk | Recurring bookings |
| Open Table with Deep Work and Networking modes: create, join, leave, close | Course-based partner recommendations |
| QR check-in, Scan & Sit, 15-minute auto-release | Rotating QR codes, admin analytics dashboard |
| OASIS Points, tiers and peak-hour priority tables | Voice input for the Navigator |
| OASIS Navigator (Gemini function calling) with offline-parser fallback | Multi-campus support |
| Realtime updates, installable PWA | Guaranteed push notifications on iOS |
| Clearly labelled seed data for the demo | Energy or emissions measurement |

### 8.2 Plan against the STACK 2026 timeline

| Stage | Date | OASIS milestone |
| --- | --- | --- |
| Preliminary | 10 Nov 2026 | Abstract (300–500 words) drawn from this PRD; baseline survey drafted |
| Semifinal | 30 Nov 2026 | Proposal and 2-minute video showing the landing page, one-click demo login, Radar, Open Table and a Navigator prompt on seeded data; completed and remaining work stated clearly |
| Product improvement | 7–16 Dec 2026 | Check-in, points and auto-release working end to end; Navigator tested against the 30-prompt set; repository, README and setup instructions ready |
| Final Day | 16 Dec 2026 | Planned tasks: (1) one-click login → Navigator prompt → booking appearing live on a second device’s Radar, (2) QR check-in with points and auto-release, (3) Open Table join flow with mode norms |

This assumes the team reaches each stage; dates may change per official announcements.

### 8.3 Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Gemini free-tier rate limits, latency or outage | Navigator slow or unavailable during the pitch | Per-user and global caps, 8-second budget, offline parser for scripted prompts, quick-booking form, rehearsal of 10 end-to-end runs |
| Navigator misreads a request | Wrong booking | Strict schema validation, at most one clarifying question, visible step trace, free **Undo**, no booking without a validated tool call |
| Prompt injection or abuse of the agent | Unintended actions | Allowlisted tools, user-scoped permissions, no SQL from the model, off-topic refusal, rate limiting |
| Radar drifts from reality without sensors | Wrong colours erode trust | 15-minute check-in deadline, auto-release, **Still here?** prompt, **I’m leaving** reward, two-report rule, accuracy spot checks reported honestly |
| Ghost bookings and belongings-only tables | Tables look taken but are empty, or the reverse | Booking-bound check-in, one session per user, community reports; a “Possibly occupied” state is a later improvement |
| QR spoofing with a photo of the code | False check-ins | Scans bound to an active booking, one session per user, reports; rotating QR later |
| Points gaming (collusion, farming) | Unfair priority access | Server-side awards, daily cap, verified check-ins only, limits on repeated host–guest pairs |
| Priority tables feel exclusionary | Student frustration | Only about 30 % of tables are priority, only at peak hours; the Radar and standard tables stay open to all; pause rule never deducts points |
| Mode norms ignored | Students feel unsafe or annoyed | Norms accepted on join, one-tap mode-respected feedback, report and block, **Leave quietly** |
| OAuth or campus email failure | Judge cannot enter | One-Click Demo Login with server-side sign-in, no OAuth dependency |
| Demo data mistaken for real results | Loss of credibility | “Demo mode · simulated campus data” banner; seeded data always labelled; targets labelled as targets |
| Free-tier ceilings or project pausing | Outage during the demo | Keep-warm workflow, pruning, usage monitoring, screen-recording Plan B |
| Cold-start adoption: Open Table needs people | Empty demo, little evidence | Pilot with a specific class; seeded sessions, always labelled as simulated |
| Privacy of prompts sent to a free-tier AI service | Personal data exposure | No personal data in prompts, 7-day log retention, privacy and AI-usage note on the landing page |

### 8.4 Honesty and competition compliance

- Material AI assistance (tools and their role) is disclosed in the proposal and the README. The Navigator’s use of the Gemini API is stated openly.
- Demos use synthetic or consented data; mockups, seeded data and unfinished features are identified as such.
- Planned features and *target* metrics are never presented as completed functionality or results.
- A signed Declaration of Originality accompanies the semifinal proposal.
- Third-party libraries and services (Next.js, Supabase, Vercel, Gemini API) are attributed.

### 8.5 Open questions to confirm with UPNVJT

1. The institutional email domain used for student accounts.
2. Which coworking rooms exist, their table counts and opening hours.
3. Whether QR codes may be fixed to tables, and who approves it.
4. Actual peak hours and whether any existing booking or house rules should shape the points and perks design.
5. Whether coordinators want utilisation data after the pilot (relevant to the Campus Space Efficiency metric).
