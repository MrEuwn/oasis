'use client';

import { useState } from 'react';
import Link from 'next/link';
import { fmtClock, fmtRange, mmss, useApp, useMounted } from './AppState';
import { IconQr, IconScan, IconTimer } from './Icons';

export default function SessionScreen() {
  const { session, act, showToast, state, config } = useApp();
  const mounted = useMounted();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const table = session ? (state.spaces || []).flatMap((s) => s.tables).find((t) => t.id === session.table_id) : null;
  const scanHref = session ? `/scan?t=${session.table_id}${table?.qr_token ? `&k=${table.qr_token}` : ''}` : '/scan';

  async function run(action, endAction, message) {
    setBusy(true);
    const res = await act(action, { bookingId: session.booking_id, endAction });
    setBusy(false);
    if (res.ok) showToast(message);
  }

  if (!session) {
    return (
      <>
        <div className="screen-head">
          <div>
            <h1>Session</h1>
            <span className="mono">no active hold</span>
          </div>
        </div>

        <div className="empty">
          <IconTimer width={34} height={34} />
          <h2>Nothing held right now</h2>
          <p>Book from the radar, join an open table, or scan a free table to sit down immediately.</p>
          <div className="cta-row" style={{ justifyContent: 'center', marginTop: 8 }}>
            <Link className="btn btn-primary" href="/radar">Open the radar</Link>
            <Link className="btn" href="/scan"><IconScan width={16} height={16} /> Scan a table</Link>
          </div>
        </div>

        <p className="hint">
          Check in within 15 minutes or the table frees itself. Five minutes before the end you are asked “Still
          here?”; reach the end and the session closes on its own.
        </p>
      </>
    );
  }

  const deadline = session.checked_in ? session.ends_at : session.checkin_deadline;
  const total = session.checked_in ? 60 : 15;
  const left = Math.max(0, Math.round((Date.parse(deadline) - Date.now()) / 60000));
  const pct = mounted ? Math.max(2, Math.min(100, Math.round((left / total) * 100))) : 100;
  const endingSoon = mounted && session.checked_in && Date.parse(session.ends_at) - Date.now() <= 5 * 60000;

  return (
    <>
      <div className="screen-head">
        <div>
          <h1>{session.space.replace(' Demo', '')}</h1>
          <span className="mono">table {session.table} · {session.role}</span>
        </div>
      </div>

      {endingSoon && (
        <div className="card" style={{ borderColor: 'color-mix(in srgb, var(--amber) 45%, transparent)' }}>
          <h3>Still here?</h3>
          <p>
            The session ends in {Math.max(1, Math.round((Date.parse(session.ends_at) - Date.now()) / 60000))} minutes.
            Extend only works when nobody is booked next.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-sm" disabled={busy} onClick={() => run('end', 'extend', 'Extended by 30 minutes.')}>
              Extend 30m
            </button>
            <button className="btn btn-sm" disabled={busy} onClick={() => run('end', 'leave', 'Session ended. +5 points.')}>
              End now
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className={`dial ${pct <= 8 ? 'late' : pct <= 25 ? 'warn' : ''}`} style={{ '--p': `${pct}%` }}>
          <div className="dial-inner">
            <b>{mounted ? mmss(deadline) : '--:--'}</b>
            <span>{session.checked_in ? 'until it ends' : 'left to check in'}</span>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="kv"><span className="k">Now</span><span className="v">{fmtClock(state.now)}</span></div>
          <div className="kv"><span className="k">Booked</span><span className="v">{fmtRange(session.starts_at, session.ends_at)}</span></div>
          <div className="kv"><span className="k">Check-in closes</span><span className="v">{fmtClock(session.checkin_deadline)}</span></div>
          {session.mode_label && <div className="kv"><span className="k">Mode</span><span className="v">{session.mode_label}</span></div>}
          {session.topic_tag && <div className="kv"><span className="k">Topic</span><span className="v">{session.topic_tag}</span></div>}
          {session.role === 'host' && (
            <div className="kv"><span className="k">Seats you opened</span><span className="v">{session.open_seats}</span></div>
          )}
        </div>

        <div className="session-actions" style={{ marginTop: 14 }}>
          {!session.checked_in && (
            <>
              <Link className="btn btn-primary btn-block" href={scanHref}>
                <IconScan width={17} height={17} /> Check in at the table
              </Link>
              <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => run('cancel', null, 'Booking cancelled. Free, no points lost.')}>
                Cancel booking
              </button>
            </>
          )}
          {session.checked_in && (
            <>
              {session.role === 'host' && (
                <button className="btn btn-block" disabled={busy} onClick={() => run('end', 'extend', 'Extended by 30 minutes.')}>
                  Extend 30 minutes
                </button>
              )}
              <button
                className="btn btn-primary btn-block"
                disabled={busy}
                onClick={() =>
                  run('end', 'leave', session.role === 'host' ? 'Table released. +5 for completing.' : 'Left quietly. No penalty.')
                }
              >
                {session.role === 'host' ? 'End session · free the table' : "I'm leaving"}
              </button>
            </>
          )}
        </div>
      </div>

      {session.role === 'host' && (
        <div className="card">
          <h3>Guests</h3>
          {session.guests.length === 0 && <p>No guests yet. {session.open_seats} seats open.</p>}
          {session.guests.map((g) => (
            <div className="guest-row" key={g.user_id}>
              <span className="who">
                {g.name}
                <small>{g.program} {g.year}</small>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge">{g.checked_in ? 'Present' : 'Joining'}</span>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={async () => {
                    const res = await act('remove_guest', { bookingId: session.booking_id, userId: g.user_id });
                    if (res.ok) showToast(`${g.name} removed. The seat is free again.`);
                  }}
                >
                  Remove
                </button>
              </span>
            </div>
          ))}
          <p className="hint" style={{ marginTop: 10 }}>
            Guests see only your first name, programme and intake year.
          </p>
        </div>
      )}

      <div className="card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconQr width={17} height={17} /> Table code
        </h3>
        <p>Print once, fix to the table. Scanning opens the check-in screen.</p>
        <div className="qr-box" style={{ marginTop: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/qr/${session.table_id}`} alt={`QR code for table ${session.table}`} />
        </div>
        <p className="hint" style={{ marginTop: 12 }}>
          A static code can be photographed. Scans are bound to an active booking, one session per user, and the
          two-report rule covers the gap until rotating codes ship.
        </p>
      </div>

      {session.checked_in && session.mode && (
        <div className="card">
          <h3>Was {session.mode_label} respected?</h3>
          <p>One tap. {config?.points?.MODE_RESPECTED || 3} points when you confirm it was.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              className="btn btn-sm"
              disabled={Boolean(feedback)}
              onClick={async () => {
                const res = await act('mode_feedback', { bookingId: session.booking_id, respected: true });
                if (res.ok) {
                  setFeedback('Thanks — the norm was kept.');
                  showToast(`Mode respected. +${config?.points?.MODE_RESPECTED || 3} points.`);
                }
              }}
            >
              Yes, respected
            </button>
            <button
              className="btn btn-sm"
              disabled={Boolean(feedback)}
              onClick={async () => {
                await act('mode_feedback', { bookingId: session.booking_id, respected: false });
                setFeedback('Noted. Thanks for telling us.');
              }}
            >
              No
            </button>
          </div>
          {feedback && <p className="hint" style={{ marginTop: 10 }}>{feedback}</p>}
        </div>
      )}
    </>
  );
}
