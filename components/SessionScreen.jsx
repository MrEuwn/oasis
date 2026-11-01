'use client';

import { useState } from 'react';
import Link from 'next/link';
import { fmtRange, mmss, useApp, useMounted } from './AppState';

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
        <div className="card">
          <h3>No active session</h3>
          <p>Book a table from the Radar, join an Open Table, or scan a free table to sit down now.</p>
          <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" href="/radar">Open the Radar</Link>
            <Link className="btn" href="/scan">Scan a table</Link>
          </div>
        </div>
        <div className="card">
          <h3>How sessions end</h3>
          <p>
            Check in within 15 minutes of booking, or the table is released and no points are earned. Five minutes
            before the end you are asked “Still here?”. Reach the end and the session closes itself.
          </p>
        </div>
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
      {endingSoon && (
        <div className="card" style={{ borderColor: 'var(--yellow)' }}>
          <h3>Still here?</h3>
          <p>The session ends in {Math.max(1, Math.round((Date.parse(session.ends_at) - Date.now()) / 60000))} minutes.</p>
          <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-sm" disabled={busy} onClick={() => run('end', 'extend', 'Extended by 30 minutes.')}>
              Extend +30 min
            </button>
            <button
              className="btn btn-sm"
              disabled={busy}
              onClick={() => run('end', 'leave', 'Session ended. +5 for completing, +2 Good Neighbour if early.')}
            >
              End now
            </button>
          </div>
          <p className="hint" style={{ marginTop: 8 }}>Extend only works when nobody is booked next.</p>
        </div>
      )}
      <div className="card">
        <div className="row between" style={{ marginBottom: 8 }}>
          <strong>{session.space} · table {session.table}</strong>
          <span className="badge mode">{session.mode_label || 'Standard'}</span>
        </div>

        <div className="ring" style={{ '--p': `${pct}%` }}>
          <div className="ring-content">
            <strong>{mounted ? mmss(deadline) : '--:--'}</strong>
            <span>{session.checked_in ? 'until the session ends' : 'to check in'}</span>
          </div>
        </div>

        <div className="kv"><span>You are</span><span>{session.role === 'host' ? 'Host' : 'Guest'}</span></div>
        <div className="kv"><span>Status</span><span>{session.booking_status === 'active' ? 'Active' : 'Reserved'} · {session.checked_in ? 'checked in' : 'not checked in yet'}</span></div>
        <div className="kv"><span>Time</span><span>{fmtRange(session.starts_at, session.ends_at)}</span></div>
        {session.mode_label && <div className="kv"><span>Mode</span><span>{session.mode_label}</span></div>}
        {session.topic_tag && <div className="kv"><span>Topic</span><span>{session.topic_tag}</span></div>}
        {session.role === 'host' && <div className="kv"><span>Seats open</span><span>{session.open_seats}</span></div>}

        <div className="row" style={{ gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          {!session.checked_in && (
            <>
              <Link className="btn btn-primary" href={scanHref}>Check in</Link>
              <button className="btn" disabled={busy} onClick={() => run('cancel', null, 'Booking cancelled. Free, no points lost.')}>
                Cancel booking
              </button>
            </>
          )}
          {session.checked_in && session.role === 'host' && (
            <button className="btn" disabled={busy} onClick={() => run('end', 'extend', 'Extended by 30 minutes.')}>
              Extend +30 min
            </button>
          )}
          {session.checked_in && (
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() =>
                run('end', 'leave', session.role === 'host' ? 'Table released. +5 for completing, +2 Good Neighbour if early.' : 'Left quietly. No penalty.')
              }
            >
              {session.role === 'host' ? 'End session & free the table' : "I'm leaving"}
            </button>
          )}
        </div>
      </div>

      {session.role === 'host' && (
        <div className="card">
          <h3>Guests</h3>
          {session.guests.length === 0 && <p>No guests yet. Seats opened: {session.open_seats}.</p>}
          <ul className="list-plain">
            {session.guests.map((g, i) => (
              <li key={i}>
                <span>{g.name} · {g.program} {g.year}</span>
                <span className="row" style={{ gap: 8 }}>
                  <span className="badge">{g.checked_in ? 'Checked in' : 'Joining'}</span>
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
              </li>
            ))}
          </ul>
          <p className="hint" style={{ marginTop: 8 }}>
            Guests see only your first name, study programme and intake year. They can leave quietly at any time.
          </p>
        </div>
      )}

      <div className="card">
        <h3>Table QR</h3>
        <p>Print it once and fix it to the table. Scanning opens the check-in screen.</p>
        <div className="qr-box" style={{ marginTop: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/qr/${session.table_id}`} alt={`QR code for table ${session.table}`} />
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          A static code can be photographed. Scans are bound to an active booking, one session per user, and the
          two-report rule covers the gap until rotating codes ship.
        </p>
      </div>

      {session.checked_in && session.mode && (
        <div className="card">
          <h3>Was the {session.mode_label} mode respected?</h3>
          <p>One tap. {config?.points?.MODE_RESPECTED || 3} points when you confirm it was.</p>
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button
              className="btn btn-sm"
              disabled={Boolean(feedback)}
              onClick={async () => {
                const res = await act('mode_feedback', { bookingId: session.booking_id, respected: true });
                if (res.ok) {
                  setFeedback('Thanks — +3 points for keeping the norm.');
                  showToast('Mode respected. +3 OASIS Points.');
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
