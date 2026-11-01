'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { fmtRange, useApp } from './AppState';
import { IconQr, IconScan } from './Icons';

export default function ScannerScreen() {
  const { state, act, showToast, session } = useApp();
  const params = useSearchParams();
  const [duration, setDuration] = useState(60);
  const [manualId, setManualId] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const tables = useMemo(
    () => (state.spaces || []).flatMap((s) => s.tables.map((t) => ({ ...t, space: s.name }))),
    [state.spaces],
  );

  const targetId = params.get('t') || session?.table_id || '';
  const target = tables.find((t) => t.id === targetId);
  const token = params.get('k') || target?.qr_token || '';

  async function checkin(tableId, code) {
    setBusy(true);
    const res = await act('checkin', { tableId, token: code });
    setBusy(false);
    if (res.ok) showToast(`Checked in. +${res.points} points.`);
    else setNotice({ error: res.error });
    return res;
  }

  async function sit(tableId, code) {
    setBusy(true);
    const res = await act('scan_sit', { tableId, token: code, duration });
    setBusy(false);
    if (res.ok) showToast(`Sitting at table ${target?.label || ''}. +${res.points} points.`);
    else setNotice({ error: res.error });
    return res;
  }

  async function submitManual(e) {
    e.preventDefault();
    const table = tables.find((t) => t.id === manualId);
    if (!table) {
      setNotice({ error: 'Pick a table first.' });
      return;
    }
    const res = await checkin(table.id, manualCode.trim());
    if (!res.ok) await sit(table.id, manualCode.trim());
  }

  return (
    <>
      <div className="screen-head">
        <div>
          <h1>Scan</h1>
          <span className="mono">check in · sit down</span>
        </div>
      </div>

      {target ? (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <span className="mono">{target.space.replace(' Demo', '')}</span>
              <h3 style={{ marginTop: 4, fontSize: '1.2rem' }}>Table {target.label}</h3>
              <p className="mono" style={{ marginTop: 4 }}>{target.capacity} seats</p>
            </div>
            <IconQr width={22} height={22} />
          </div>

          <p style={{ marginTop: 12 }}>
            {session?.table_id === target.id
              ? session.checked_in
                ? `Checked in. Session ends ${fmtRange(null, session.ends_at)}.`
                : 'You hold this table — confirm you are standing at it.'
              : 'Scanning a free table claims it for a walk-in session.'}
          </p>

          <div className="qr-box" style={{ marginTop: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/qr/${target.id}`} alt={`QR code for ${target.space} table ${target.label}`} />
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <span className="field-label">Walk-in length · used by “Sit here”</span>
            <div className="seg">
              {[30, 60, 90, 120].map((d) => (
                <button type="button" key={d} aria-pressed={duration === d} onClick={() => setDuration(d)}>{d}m</button>
              ))}
            </div>
          </div>

          <div className="session-actions" style={{ marginTop: 12 }}>
            <button className="btn btn-primary btn-block" onClick={() => checkin(target.id, token)} disabled={busy || !token}>
              <IconScan width={17} height={17} /> Check in to my booking
            </button>
            <button className="btn btn-block" onClick={() => sit(target.id, token)} disabled={busy || !token}>
              Sit here · start a {duration}-minute walk-in
            </button>
          </div>

          <p className="hint" style={{ marginTop: 10 }}>
            Check in confirms a booking you already hold. Sit here claims a free table on the spot.
          </p>

          {notice?.error && <p className="error" style={{ marginTop: 12 }}>{notice.error}</p>}
        </div>
      ) : (
        <div className="empty">
          <IconScan width={34} height={34} />
          <h2>No table selected</h2>
          <p>Scan the QR code on the table, or pick one below and type its code.</p>
        </div>
      )}

      <form className="card" onSubmit={submitManual}>
        <h3>Manual code</h3>
        <p>For older phones, or when the camera will not cooperate.</p>
        <div className="field" style={{ marginTop: 14 }}>
          <label htmlFor="table">Table</label>
          <select id="table" value={manualId} onChange={(e) => setManualId(e.target.value)}>
            <option value="">Choose a table…</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>{t.space.replace(' Demo', '')} · {t.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="code">Code</label>
          <input id="code" type="text" value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="12-character code" autoComplete="off" />
        </div>
        <button className="btn btn-block" type="submit" disabled={busy} style={{ marginTop: 4 }}>
          Check in or sit here
        </button>
        <p className="hint" style={{ marginTop: 10 }}>
          Check-in only works for the host or a joined guest of the live session, before the 15-minute deadline.
        </p>
      </form>
    </>
  );
}
