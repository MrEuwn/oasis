import Link from 'next/link';
import DemoLogin from '@/components/DemoLogin';
import { IconChevron, Logo } from '@/components/Icons';

const STEPS = [
  { n: '01', title: 'See it', body: 'The radar colours every room from live bookings and check-ins. No sensors, no patrols.' },
  { n: '02', title: 'Claim it', body: 'Book in a few taps, or scan the table QR and sit down. Confirm within 15 minutes or it frees itself.' },
  { n: '03', title: 'Share it', body: 'Open spare seats in Deep Work or Networking mode, so everyone knows what they are walking into.' },
  { n: '04', title: 'Ask it', body: '“Quiet table for 4 in the library.” The Navigator searches, books and opens the seats.' },
];

const PROBLEMS = [
  { n: '01', title: 'Walking room to room', body: 'New coworking spaces, no way to see what is free. A 90-minute gap disappears in corridors.' },
  { n: '02', title: 'Asking a 500-person group chat', body: 'Finding study partners means posting into a giant WhatsApp group. Most students just do not ask.' },
  { n: '03', title: 'Silent or social?', body: 'People who need silence and people who want to discuss share the same tables, with no way to signal which.' },
  { n: '04', title: 'Tables that look taken but are empty', body: 'Informal claims and ghost bookings make a room look full when it is not.' },
];

export default function Landing() {
  return (
    <div className="landing">
      <div className="wrap">
        <header className="topbar-landing">
          <Link className="brand" href="/">
            <Logo size={26} />
            OASIS
          </Link>
          <nav>
            <Link className="btn btn-sm btn-ghost" href="/login">Sign in</Link>
          </nav>
        </header>

        <section className="hero">
          <div>
            <p className="eyebrow">UPN Veteran Jawa Timur · campus radar</p>
            <h1>Find a seat. <em>Not a corridor.</em></h1>
            <p className="lede">
              OASIS shows which campus tables are free, claims one in a few taps, and tells you whether the table is
              quiet or social before you walk over.
            </p>
            <p className="value-line">See it. Claim it. Share it.</p>
            <div className="cta-row">
              <Link className="btn btn-primary" href="/login">
                Open the demo <IconChevron width={16} height={16} />
              </Link>
              <a className="btn" href="#how">How it works</a>
            </div>
            <div className="hero-meta">
              <span><b>2 taps</b> with the navigator</span>
              <span><b>15 min</b> auto-release</span>
              <span><b>$0</b> stack, no install</span>
            </div>
          </div>

          <div className="instrument" aria-label="Sample radar interface">
            <div className="instrument-head">
              <span className="mono" style={{ color: 'var(--text)' }}>Campus scope</span>
              <span className="mono tag">
                <i style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }} aria-hidden="true" />
                sample data
              </span>
            </div>
            <div className="instrument-body">
              <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }} aria-hidden="true">
                <defs>
                  <linearGradient id="heroSweep" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#35e0c0" stopOpacity="0" />
                    <stop offset="1" stopColor="#35e0c0" stopOpacity="0.2" />
                  </linearGradient>
                </defs>
                <g stroke="rgba(150,196,206,.2)" fill="none">
                  <circle cx="50" cy="50" r="45" />
                  <circle cx="50" cy="50" r="31" strokeDasharray="1.6 3" />
                  <circle cx="50" cy="50" r="17" strokeDasharray="1.6 3" />
                  <path d="M50 3v6M50 91v6M3 50h6M91 50h6" />
                  <path d="M50 5v90M5 50h90" opacity="0.2" />
                </g>
                <g className="scope-sweep" style={{ transformOrigin: '50px 50px' }}>
                  <path d="M50 50 L50 5 A45 45 0 0 1 81 19 Z" fill="url(#heroSweep)" />
                  <line x1="50" y1="50" x2="50" y2="5" stroke="#35e0c0" strokeWidth="0.5" opacity="0.6" />
                </g>
                <g>
                  <circle cx="34" cy="37" r="1.4" fill="#3ddc97" />
                  <circle cx="66" cy="62" r="1.4" fill="#f7c948" />
                  <circle cx="50" cy="50" r="1" fill="#35e0c0" />
                </g>
                <g fill="rgba(233,243,245,.72)" style={{ fontFamily: 'ui-monospace, monospace', fontSize: '2.6px', letterSpacing: '0.2px' }}>
                  <text x="34" y="33" textAnchor="middle">Library</text>
                  <text x="66" y="58" textAnchor="middle">Student Centre</text>
                </g>
              </svg>
              <div className="booked-toast">
                <span className="tick" aria-hidden="true">
                  <IconChevron width={14} height={14} style={{ transform: 'rotate(180deg)' }} />
                </span>
                <span>
                  <b>Library · table L3</b>
                  <span className="mono">Networking · 2 seats open · check in by 14:15</span>
                </span>
              </div>
            </div>
            <div className="instrument-foot">
              <span className="mono" style={{ color: 'var(--green)' }}>● 9 free</span>
              <span className="mono" style={{ color: 'var(--amber)' }}>● 1 open</span>
              <span className="mono" style={{ color: 'var(--dim)' }}>2 rooms</span>
            </div>
          </div>
        </section>

        <section className="section" id="problem">
          <div className="section-head">
            <h2>What is broken today</h2>
            <p>
              UPNVJT has just built new coworking spaces. Nothing tells students which seats are free, and nothing
              signals who wants silence and who wants to talk.
            </p>
          </div>
          <div className="problem-list">
            {PROBLEMS.map((p) => (
              <article className="problem" key={p.n}>
                <span className="num">{p.n}</span>
                <div>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="how">
          <div className="section-head">
            <h2>Four moves, one bottom bar</h2>
            <p>Every journey starts on the radar and ends at a table. The fastest one is two taps.</p>
          </div>
          <div className="steps">
            {STEPS.map((s) => (
              <article className="step" key={s.n}>
                <span className="num">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section" id="modes">
          <div className="section-head">
            <h2>Say how you work before you sit</h2>
            <p>
              Every open table carries a mode, fixed for the session and shown on every card. Norms are accepted once,
              in one tap, before a guest joins.
            </p>
          </div>
          <div className="modes">
            <article className="mode-card">
              <span className="mono">Deep work</span>
              <h3>Silent study together</h3>
              <p>No talking. Headphones and typing are fine. Whisper only for logistics.</p>
            </article>
            <article className="mode-card">
              <span className="mono">Networking</span>
              <h3>Discussion welcome</h3>
              <p>Talk, explain, quiz each other. Keep the volume considerate for the room.</p>
            </article>
          </div>
        </section>

        <section className="section" id="impact">
          <div className="section-head">
            <h2>What we intend to prove</h2>
            <p>Targets, not results. Baselines are measured in the pilot, and every number is reported with its sample size.</p>
          </div>
          <div className="impact">
            <div className="impact-item"><strong>−50%</strong><span>target: median seat-finding time, baseline TBD</span></div>
            <div className="impact-item"><strong>+15%</strong><span>target: campus space efficiency over baseline</span></div>
            <div className="impact-item"><strong>≥90%</strong><span>target: radar accuracy across 100 spot checks</span></div>
            <div className="impact-item"><strong>$0</strong><span>stack cost, no card on file</span></div>
          </div>
        </section>

        <section className="section" id="judges">
          <div className="section-head">
            <h2>For judges</h2>
            <p>
              One tap in, no password. Every demo screen is labelled simulated campus data, and Reset demo restores the
              seed from the menu.
            </p>
          </div>
          <div className="judge-grid">
            <div className="panel">
              <h3>Enter the demo</h3>
              <p style={{ marginBottom: 14 }}>Four personas: seeker, host, guest and a Deep Blue navigator.</p>
              <DemoLogin primary chips />
            </div>
            <div className="panel">
              <h3>Read the detail</h3>
              <p style={{ marginBottom: 14 }}>
                PRD v3, the architecture note, and the honest list of what is built versus planned.
              </p>
              <div className="chips">
                <a className="btn btn-sm" href="/docs/OASIS_PRD_v3.md">PRD v3</a>
                <a className="btn btn-sm" href="/docs/ARCHITECTURE.md">Architecture</a>
              </div>
              <p className="mono" style={{ marginTop: 18 }}>STACK 2026 · case 1 · GDGoC ITB</p>
            </div>
          </div>
        </section>

        <footer className="footer">
          <div className="row" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>OASIS · Open Academic Space and Interaction System</strong>
            <span className="mono">STACK 2026</span>
          </div>
          <p>
            Privacy: a display name, study programme, intake year and points. No images, video or location tracking.
            Navigator prompts carry no personal data, logs are pruned after 7 days, in the spirit of UU PDP No. 27/2022.
          </p>
          <p>
            AI usage: the Navigator calls the Gemini API to parse requests; a deterministic offline parser covers the
            scripted prompts and is labelled in the app. Everything else is rule-based. Built with Next.js and React.
          </p>
          <p>
            <a href="/docs/ARCHITECTURE.md">Architecture</a> · <a href="/docs/OASIS_PRD_v3.md">Product requirements</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
