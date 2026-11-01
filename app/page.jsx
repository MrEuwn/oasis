import Link from 'next/link';
import DemoLogin from '@/components/DemoLogin';

const SAMPLE = [
  { room: 'Library', floor: 1, status: 'open', free: 2, open: 1, total: 6 },
  { room: 'Student Centre', floor: 2, status: 'empty', free: 3, open: 0, total: 4 },
];

const STEPS = [
  { title: 'See it', body: 'The Radar colours every room green, yellow or red, from live bookings and check-ins. No sensors, no patrols.' },
  { title: 'Claim it', body: 'Book a table in a few taps, or scan its QR code and sit down. Confirm within 15 minutes, or it frees itself.' },
  { title: 'Share it', body: 'Open spare seats in Deep Work or Networking mode, so everyone knows what they are walking into.' },
  { title: 'Ask it', body: 'Tell the Navigator: “Find a quiet table for 4 in the library.” It searches, books, and opens the seats.' },
];

const PROBLEMS = [
  { title: 'Walking room to room', body: 'New coworking spaces, no way to see what is free. A 90-minute gap can disappear in corridors.' },
  { title: 'Asking a giant group chat', body: 'Finding study partners means posting into a 500-person WhatsApp group. Most students just do not ask.' },
  { title: 'Silent or social?', body: 'People who need silence and people who want to discuss share the same tables, with no way to signal which.' },
  { title: 'Tables that look taken but are empty', body: 'Informal claims and ghost bookings make the room look full when it is not.' },
];

export default function Landing() {
  return (
    <div className="landing">
      <div className="wrap">
        <header className="landing-header">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">◉</span>
            OASIS
          </div>
          <nav className="row" style={{ gap: 8 }}>
            <Link className="btn btn-sm btn-ghost" href="/login">Sign in</Link>
            <Link className="btn btn-sm btn-primary" href="/login">Try the demo</Link>
          </nav>
        </header>

        <section className="hero">
          <p className="eyebrow">STACK 2026 · Case 1 · UPN Veteran Jawa Timur</p>
          <h1>A calmer way to find a seat on campus.</h1>
          <p className="value-line">See it. Claim it. Share it.</p>
          <p className="lede">
            OASIS is a zero-install web app that shows which coworking tables are free right now, lets you claim one in
            seconds, and helps you find study partners who work the way you do. Ask the Navigator in plain language and
            it does all three.
          </p>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/login">Open the demo — one click</Link>
            <a className="btn" href="/docs/OASIS_PRD_v3.md">Read the PRD</a>
          </div>
          <p className="hint">No install. No sensors. No card. Works on the phone already in your hand.</p>
        </section>

        <section className="section" id="problem">
          <h2>What is broken today</h2>
          <p className="section-lede">
            UPNVJT has just built new coworking spaces. Nothing tells students which seats are free, and nothing signals
            who wants silence and who wants to talk.
          </p>
          <div className="grid">
            {PROBLEMS.map((p) => (
              <article className="card" key={p.title}>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="how">
          <h2>How it works</h2>
          <p className="section-lede">Four moves, all reachable from the same bottom bar.</p>
          <div className="grid">
            {STEPS.map((s, i) => (
              <article className="card" key={s.title}>
                <span className="step-index" aria-hidden="true">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="sample">
          <h2>What the Radar looks like</h2>
          <p className="section-lede">
            Status comes from bookings, QR check-ins, walk-in scans and releases — never from a camera. Sample data
            below.
          </p>
          <div className="grid">
            {SAMPLE.map((room) => (
              <article className="card" key={room.room}>
                <div className="row between">
                  <div>
                    <h3>{room.room}</h3>
                    <p>Floor {room.floor} · {room.total} tables</p>
                  </div>
                  <span className={`status-pill ${room.status}`}>
                    {room.status === 'empty' ? '○ Empty' : room.status === 'open' ? '◐ Open Table' : '● Full'}
                  </span>
                </div>
                <div className="legend" style={{ marginTop: 14 }}>
                  <span><i className="dot empty" aria-hidden="true" /> {room.free} free</span>
                  <span><i className="dot open" aria-hidden="true" /> {room.open} open table</span>
                </div>
              </article>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 10 }}>Sample data — not live campus numbers.</p>
        </section>

        <section className="section" id="for">
          <h2>Who it is for</h2>
          <div className="grid">
            <article className="card"><h3>Students between classes</h3><p>Sit down and start working within minutes, instead of touring four rooms.</p></article>
            <article className="card"><h3>Hosts</h3><p>Open spare seats with a mode, a topic and a note. Earn points when someone joins and shows up.</p></article>
            <article className="card"><h3>Deep Work or Networking</h3><p>Choose the table that matches how you work. Norms are accepted once, before you join.</p></article>
            <article className="card"><h3>Facility coordinators</h3><p>See how the new spaces are actually used, from data that already exists.</p></article>
          </div>
        </section>

        <section className="section" id="features">
          <h2>Inside the app</h2>
          <div className="grid">
            <article className="card"><h3>Real-time Radar</h3><p>Green, yellow and red pins with an icon and label — never colour alone. “Updated 2 s ago” on every screen.</p></article>
            <article className="card"><h3>Open Table</h3><p>Host up to capacity − 1 guests, with Deep Work or Networking norms and a course tag.</p></article>
            <article className="card"><h3>QR check-in &amp; Scan &amp; Sit</h3><p>Prove you are at the table. Unclaimed bookings release after 15 minutes, automatically.</p></article>
            <article className="card"><h3>OASIS Points</h3><p>Rewards for showing up, hosting, and releasing early. No strikes, no fines, no points deducted.</p></article>
            <article className="card"><h3>OASIS Navigator</h3><p>A Gemini-powered agent that turns “quiet table for 4 in the library” into a booking and an Open Table.</p></article>
            <article className="card"><h3>Demo mode</h3><p>One tap in, one tap reset. Built so a live pitch never depends on sign-in or venue Wi-Fi.</p></article>
          </div>
        </section>

        <section className="section" id="impact">
          <h2>What we intend to prove</h2>
          <p className="section-lede">Targets, not results. Baselines are being measured in the pilot.</p>
          <div className="impact">
            <div className="impact-stat"><strong>−50%</strong><span>target: median seat-finding time (baseline TBD)</span></div>
            <div className="impact-stat"><strong>+15%</strong><span>target: Campus Space Efficiency over baseline</span></div>
            <div className="impact-stat"><strong>≥90%</strong><span>target: Radar accuracy over 100 on-site spot checks</span></div>
            <div className="impact-stat"><strong>$0</strong><span>stack cost, no card on file</span></div>
          </div>
        </section>

        <section className="section" id="judges">
          <h2>For judges</h2>
          <p className="section-lede">
            Enter in one tap, no password. Every demo screen is labelled “Demo mode · simulated campus data”, and Reset
            demo restores the seed.
          </p>
          <div className="grid">
            <article className="card">
              <DemoLogin primary chips />
            </article>
            <article className="card">
              <h3>Read the detail</h3>
              <p style={{ marginBottom: 12 }}>Product requirements and the architecture overview are public.</p>
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                <a className="btn btn-sm" href="/docs/OASIS_PRD_v3.md">PRD v3</a>
                <a className="btn btn-sm" href="/docs/ARCHITECTURE.md">Architecture</a>
              </div>
            </article>
          </div>
        </section>

        <footer className="footer">
          <div className="row between" style={{ flexWrap: 'wrap', gap: 8 }}>
            <strong>OASIS · Open Academic Space and Interaction System</strong>
            <span>STACK 2026 · GDGoC ITB</span>
          </div>
          <p style={{ margin: 0 }}>
            Privacy: we store a display name, study programme, intake year and points. No images, video or location
            tracking. Navigator prompts carry no personal data and logs are pruned after 7 days, in the spirit of UU PDP
            No. 27/2022.
          </p>
          <p style={{ margin: 0 }}>
            AI usage: the Navigator calls the Gemini API to parse requests. A deterministic offline parser covers the
            scripted demo prompts and is labelled in the UI. Everything else is rule-based.
          </p>
          <p style={{ margin: 0 }}>
            Built with Next.js, React and the Gemini API. <a href="/docs/ARCHITECTURE.md">Architecture</a> ·{' '}
            <a href="/docs/OASIS_PRD_v3.md">PRD</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
