'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { fmtRange, useApp } from './AppState';

export default function ScannerScreen() {
  const { state, act, showToast, session } = useApp();
  const params = useSearchParams();
  const [duration, setDuration] = useState(60);
  const [manualId, setManualId] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const tables = useMemo(() => (state.spaces || []).flatMap((s) => s.tables.map((t) => ({ ...t, space: s.name }))), [state.spaces]);

  const targetId = params.get('t') || session?.table_id || '';
  const token = params.get('k') || tables.find((t) => t.id === targetId)?.qr_token || '';
  const target = tables.find((t) => t.id === targetId);

  async function checkin(tableId, code) {
    setBusy(true);
    const res = await act('checkin', { tableId, token: code });
    setBusy(false);
    if (res.ok) showToast(`Checked in. +${res.points} OASIS Points.`);
    else setNotice({ error: res.error, tableId, code });
    return res;
  }

  async function sit(tableId, code) {
    setBusy(true);
    const res = await act('scan_sit', { tableId, token: code, duration });
    setBusy(false);
    if (res.ok) showToast(`Sitting at ${target?.space || 'table'} ${target?.label || ''}. +${res.points} OASIS Points.`);
    else setNotice({ error: res.error });
  }

  async function submitManual(e) {
    e.preventDefault();
    const table = tables.find((t) => t.id === manualId);
    if (!table) {
      setNotice({ error: 'Pick a table first.' });
      return;
    }
    const res = await checkin(table.id, manualCode.trim());
    if (!res.ok) {
      const sitRes = await sit(table.id, manualCode.trim());
      if (sitRes.ok) setNotice(null);
    }
  }

  return (
    <>
      <p className="hint">
        Point the phone camera at the QR code on the table — it opens this screen. The in-app scanner and the manual
        code are here for older phones and for the demo.
      </p>

      {target && (
        <div className="card" style={{ borderColor: 'var(--teal)' }}>
          <div className="row between">
            <strong>{target.space} · table {target.label}</strong>
            <span className="badge">{target.capacity} seats</span>
          </div>
          <p style={{ marginTop: 6 }}>
            {session?.table_id === target.id
              ? session.checked_in
                ? `Checked in. Session ends ${fmtRange(null, session.ends_at)}.`
                : 'You are booked here. Confirm you are at the table.'
              : 'Scan a table to sit down now, or check in to your booking.'}
          </p>
          <div className="qr-box" style={{ marginTop: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/qr/${target.id}`} alt={`QR code for ${target.space} table ${target.label}`} />
          </div>
          <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => checkin(target.id, token)} disabled={busy || !token}>
              Check in here
            </button>
            <button className="btn" onClick={() => sit(target.id, token)} disabled={busy || !token}>
              Sit here (walk-in)
            </button>
          </div>
          {notice?.error && <p className="error" style={{ marginTop: 10 }}>{notice.error}</p>}
        </div>
      )}

      {!target && (
        <div className="card">
          <h3>No table selected</h3>
          <p>Scan a QR code, or pick the table and type the code printed under it.</p>
        </div>
      )}

      <form className="card" onSubmit={submitManual}>
        <h3>Manual code</h3>
        <div className="field" style={{ marginTop: 10 }}>
          <label htmlFor="table">Table</label>
          <select
            id="table"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            style={{ minHeight: 48, borderRadius: 12, border: '1px solid var(--line)', background: 'var(--navy-950)', padding: '10px 12px' }}
          >
            <option value="">Choose a table…</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>{t.space} · {t.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="code">Code</label>
          <input id="code" type="text" value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="12-character code" autoComplete="off" />
        </div>
        <div className="field">
          <span className="label">Walk-in duration</span>
          <div className="chips">
            {[30, 60, 90, 120].map((d) => (
              <button type="button" key={d} className="chip" aria-pressed={duration === d} onClick={() => setDuration(d)}>{d} min</button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>Check in / sit here</button>
        <p className="hint" style={{ marginTop: 10 }}>
          Check-in only works if you are the host or a joined guest of the current session, before the 15-minute
          deadline.
        </p>
      </form>
    </>
  );
}
