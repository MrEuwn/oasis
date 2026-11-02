'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from './AppState';

const MODES = { deep_work: 'deep work', networking: 'networking' };

export default function UserScreen() {
  const { state, act, me } = useApp();
  const [selected, setSelected] = useState(null);
  const [duration, setDuration] = useState(60);
  const [mode, setMode] = useState('deep_work');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [cams, setCams] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => fetch('/api/cam/now', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setCams(d?.cameras || null); })
      .catch(() => {});
    load();
    const id = setInterval(load, 4000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const tables = useMemo(() => (state?.spaces || []).flatMap((s) =>
    s.tables.map((t) => ({ ...t, space: s.name, floor: s.floor }))), [state]);

  useEffect(() => {
    const free = tables.find((t) => t.status === 'empty');
    setSelected((cur) => cur || free?.id || null);
  }, [tables]);

  const free = tables.filter((t) => t.status === 'empty');
  const open = tables.filter((t) => t.status === 'open');
  const full = tables.filter((t) => t.status === 'full' || t.status === 'in_use');
  const target = tables.find((t) => t.id === selected) || free[0] || null;

  async function book() {
    if (!target) return;
    setBusy(true);
    setNote('');
    const res = await act('create_booking', { tableId: target.id, duration, mode });
    setBusy(false);
    setNote(res.ok ? `Booked ${target.label} · check in within 15 min` : res.error || 'Could not book');
  }

  async function join(table) {
    setBusy(true);
    const res = await act('join', { bookingId: table.booking_id, normsAccepted: true });
    setBusy(false);
    setNote(res.ok ? `Joined ${table.label}` : res.error || 'Could not join');
  }

  return (
    <div className="u4">
      <section className="u4-main">
        <p className="mono-label">free now</p>
        <div className="u4-count">
          <b>{free.length}</b>
          <span>/ {tables.length} tables</span>
        </div>
        <p className="u4-sum">
          <span className="t-empty">{free.length} free</span>
          <span className="t-open">· {open.length} open</span>
          <span className="t-full">· {full.length} full</span>
        </p>
        {cams && Object.keys(cams).length > 0 && (
          <p className="u4-camline">
            <span className="mono-label">camera</span>
            {Object.values(cams).map((c) => (
              <span key={c.camera_id}>{c.space} · {c.people}p</span>
            ))}
            <span className="u4-fine">replay</span>
          </p>
        )}

        <p className="u4-sub">
          {target
            ? `${target.label} · ${target.space} · ${target.capacity} seats · ${target.mode ? MODES[target.mode] : 'free for booking'}`
            : 'No table is free right now. Student Centre usually clears after 15:00.'}
        </p>

        <p className="mono-label u4-listlabel">tables in this room</p>
        <div className="u4-rows">
          {tables.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`u4-row ${t.id === selected ? 'is-selected' : ''} ${t.status === 'full' ? 'is-dim' : ''}`}
              onClick={() => setSelected(t.id)}
              aria-pressed={t.id === selected}
            >
              <b>{t.label}</b>
              <span className="u4-row-meta">
                {t.capacity} seats{t.mode ? ` · ${MODES[t.mode]}` : ''}
                {t.host ? ` · ${t.host.name}` : ''}
                {t.camera ? ` · cam ${t.camera.people}p` : ''}
              </span>
              <span className={`u4-chip t-${t.status}`}>
                {t.status === 'empty' ? 'free' : t.status === 'open' ? 'open' : t.status === 'in_use' ? 'seen' : 'full'}
              </span>
            </button>
          ))}
        </div>
      </section>

      <aside className="u4-side">
        <div className="u4-panel">
          <h2>Book a table</h2>
          <p className="mono-note">
            {target ? `${target.label} · ${target.capacity} seats · ${target.space}` : 'pick a table'}
          </p>

          <p className="mono-label">duration</p>
          <div className="u4-seg" role="group" aria-label="Duration">
            {[30, 60, 90, 120].map((d) => (
              <button
                key={d}
                type="button"
                className={d === duration ? 'is-on' : ''}
                onClick={() => setDuration(d)}
              >
                {d}
              </button>
            ))}
          </div>

          <p className="mono-label">mode</p>
          <div className="u4-seg" role="group" aria-label="Mode">
            {Object.entries(MODES).map(([k, label]) => (
              <button key={k} type="button" className={k === mode ? 'is-on' : ''} onClick={() => setMode(k)}>
                {label}
              </button>
            ))}
          </div>

          <p className="u4-fine">
            Hold 15 min after booking. Miss the check-in and the table returns to the pool.
          </p>
          <dl className="u4-kv">
            <dt>points</dt><dd>+10 on check-in</dd>
            <dt>cancel</dt><dd>free until start</dd>
          </dl>

          <button className="u4-cta" type="button" onClick={book} disabled={busy || !target}>
            {busy ? 'Booking…' : 'Confirm booking'}
          </button>
          {note && <p className="u4-note" role="status">{note}</p>}
        </div>

        <div className="u4-panel u4-join">
          <p className="mono-label">open tables · join</p>
          {open.length === 0 && <p className="u4-fine">No host has opened seats right now.</p>}
          {open.map((t) => (
            <div className="u4-join-row" key={t.id}>
              <div>
                <b>{t.host?.name || 'Host'}</b>
                <span className="mono-note">
                  {t.mode ? MODES[t.mode] : 'open'} · {t.seats_free} seat{t.seats_free === 1 ? '' : 's'} left · {t.label}
                </span>
              </div>
              <button type="button" className="u4-link" onClick={() => join(t)} disabled={busy}>
                Join
              </button>
            </div>
          ))}
        </div>

        <div className="u4-links">
          <Link href="/session" className="u4-link">Session</Link>
          <Link href="/scan" className="u4-link">Scan QR</Link>
          <Link href="/points" className="u4-link">{me ? `${me.points} pts` : 'Points'}</Link>
        </div>
      </aside>
    </div>
  );
}
