import { read } from '@/lib/store';
import { tableView } from '@/lib/domain';
import RoleCards from '@/components/RoleCards';

export const dynamic = 'force-dynamic';

const PROBLEMS = [
  ['01', 'Walking room to room', 'New coworking spaces, no way to see what is free. A 90-minute gap disappears in corridors.'],
  ['02', 'Asking a 500-person group chat', 'Finding study partners means posting into a giant WhatsApp group. Most students just do not ask.'],
  ['03', 'Silent or social?', 'People who need silence and people who want to discuss share the same tables, with no way to signal which.'],
  ['04', 'Tables that look taken but are empty', 'Informal claims and ghost bookings make a room look full when it is not.'],
];

const STEPS = [
  ['01', 'See it', 'Status comes from bookings, QR check-ins and a camera on the floor. No patrols, no guessing.'],
  ['02', 'Claim it', 'Book in a few taps, or scan the table QR and sit down. Miss the 15-minute hold and it frees itself.'],
  ['03', 'Share it', 'Open spare seats in Deep Work or Networking mode, so everyone knows what they are walking into.'],
];

function coverage() {
  const db = read();
  const at = new Date();
  const spaces = db.spaces.filter((s) => s.is_demo);
  const tables = db.tables.filter((t) => spaces.some((s) => s.id === t.space_id));
  const views = tables.map((t) => ({ t, v: tableView(db, t, at) }));
  const readings = (db.sensor_readings || []).filter((r) => tables.some((t) => t.id === r.table_id));
  const newest = readings.map((r) => Date.parse(r.observed_at)).sort((a, b) => b - a)[0] || 0;
  return {
    total: views.length,
    free: views.filter(({ v }) => v.status === 'empty').length,
    open: views.filter(({ v }) => v.status === 'open').length,
    seen: views.filter(({ v }) => v.camera).length,
    live_rooms: spaces.filter((s2) =>
      readings.some((r) => tables.filter((t) => t.space_id === s2.id).some((t) => t.id === r.table_id))).length,
    rooms: spaces.length,
    cameras: [...new Set(readings.map((r) => r.camera_id))],
    age_s: newest ? Math.max(0, Math.round((at.getTime() - newest) / 1000)) : null,
    spaces: spaces.map((s) => ({
      name: s.name,
      floor: s.floor,
      tables: views.filter(({ t }) => t.space_id === s.id).length,
      camera: readings.some((r) => views.filter(({ t }) => t.space_id === s.id).some(({ t }) => t.id === r.table_id)),
    })),
  };
}

export default function Landing() {
  const c = coverage();
  return (
    <div className="l4">
      <header className="l4-top">
        <div className="l4-brand">
          <b>OASIS</b>
          <span className="mono-label">campus occupancy</span>
        </div>
        <span className="mono-note l4-top-mid">{c.rooms} rooms · {c.total} tables</span>
        <span className="l4-live">
          <i aria-hidden="true" />
          {c.age_s != null ? `live · ${c.age_s} s ago` : 'no camera readings yet'}
        </span>
      </header>

      <main className="l4-body">
        <section className="l4-hero">
          <p className="mono-label">campus occupancy · every seat accounted for</p>
          <h1>Find a seat.<br />Not a corridor.</h1>
          <p className="l4-lede">
            OASIS reads the tables that are actually free — camera on the floor, QR at the seat —
            so a free chair is a fact, not a guess.
          </p>
          <dl className="l4-proof">
            <div><dt>tables</dt><dd>{c.total}</dd></div>
            <div><dt>free now</dt><dd>{c.free}</dd></div>
            <div><dt>open to join</dt><dd>{c.open}</dd></div>
            <div><dt>rooms with camera</dt><dd>{c.live_rooms}/{c.rooms}</dd></div>
          </dl>
          <p className="mono-note l4-fine">Same numbers on every surface: table view, admin log, points ledger.</p>
        </section>

        <aside className="l4-roles">
          <RoleCards />
          <div className="l4-coverage">
            <p className="mono-label">coverage · today</p>
            {c.spaces.map((s) => (
              <div className="l4-cov-row" key={s.name}>
                <i className={s.camera ? 'is-on' : ''} aria-hidden="true" />
                <div>
                  <b>{s.name}</b>
                  <span className="mono-note">
                    {s.tables} tables · {s.camera ? 'camera attached' : 'no camera · booking only'}
                  </span>
                </div>
                <em>{s.camera ? 'live' : 'offline'}</em>
              </div>
            ))}
            <p className="mono-note">
              {c.cameras.length
                ? `${c.cameras.join(', ')} · last frame ${c.age_s} s ago`
                : 'Run cv/detect.py to feed the camera. The demo works without it.'}
            </p>
          </div>
        </aside>
      </main>

      <section className="l4-band">
        <div className="l4-band-head">
          <p className="mono-label">what is broken today</p>
          <h2>Four things every student already knows.</h2>
        </div>
        <div className="l4-rows">
          {PROBLEMS.map(([n, title, body]) => (
            <div className="l4-row" key={n}>
              <span className="mono-label">{n}</span>
              <b>{title}</b>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="l4-band">
        <div className="l4-band-head">
          <p className="mono-label">how it works</p>
          <h2>Three moves, one screen.</h2>
        </div>
        <div className="l4-rows">
          {STEPS.map(([n, title, body]) => (
            <div className="l4-row" key={n}>
              <span className="mono-label">{n}</span>
              <b>{title}</b>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="l4-foot">
        <div className="l4-foot-links">
          <a href="/docs/OASIS_PRD_v3.md">PRD v3</a>
          <a href="/docs/ARCHITECTURE.md">Architecture</a>
          <span className="mono-note">STACK 2026 · case 1</span>
        </div>
        <p className="l4-privacy">
          Privacy: display name, study programme, intake year and points. No images leave the camera, no video,
          no location tracking; sensor payloads are integers and readings expire in 10 minutes.
          Navigator prompts carry no personal data, logs are pruned after 7 days, in the spirit of UU PDP No. 27/2022.
        </p>
        <p className="l4-privacy">
          AI usage: the Navigator calls Gemini when a key is present; a deterministic offline parser covers the
          scripted prompts and is labelled in the app. Everything else is rule-based. Demo data is simulated
          campus data, labelled on every screen.
        </p>
        <p className="mono-note">OASIS · Open Academic Space and Interaction System</p>
      </footer>
    </div>
  );
}
