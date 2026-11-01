'use client';

import { useState } from 'react';
import Link from 'next/link';
import { fmtRange, mmss, useApp, useMounted } from './AppState';

const SUGGESTIONS = [
  'Find a quiet table for 4 people in the library',
  'Book a table for our Calculus group, discussion is fine',
  'I need a spot right now, anywhere',
];

export default function NavigatorScreen() {
  const { state, act, showToast, config, session, refresh } = useApp();
  const mounted = useMounted();
  const [log, setLog] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(prompt, override = null) {
    if (busy) return;
    if (!override && !prompt.trim()) return;
    setBusy(true);
    setLog((prev) => [...prev, { role: 'me', text: override ? override.label : prompt }]);
    setInput('');
    try {
      const res = await fetch('/api/navigator', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(override ? { intent: override.value, source: override.source, prompt: override.label } : { prompt }),
      });
      const data = await res.json();
      refresh();
      setLog((prev) => [...prev, { role: 'agent', data }]);
      if (data.ok && data.result) {
        showToast(`Booked ${data.result.space} · ${data.result.table}. Check in within 15:00.`, async () => {
          await act('cancel', { bookingId: data.result.booking_id });
        });
      }
    } catch {
      setLog((prev) => [...prev, { role: 'agent', data: { error: 'The Navigator could not reach the server.' } }]);
    }
    setBusy(false);
  }

  return (
    <>
      <p className="hint">
        Ask in English or Bahasa Indonesia. The Navigator searches the same tables you see, books one and opens the
        spare seats — one tapped answer at most.
      </p>

      <div className="chips">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="chip" onClick={() => send(s)} disabled={busy} style={{ textAlign: 'left' }}>
            {s}
          </button>
        ))}
      </div>

      {session && (
        <Link href="/session" className="card" style={{ display: 'block', borderColor: 'var(--teal)' }}>
          <strong>Active session: {session.space} · {session.table}</strong>
          <p style={{ marginTop: 4 }}>{session.checked_in ? 'Checked in' : `Check in within ${mounted ? mmss(session.checkin_deadline) : '15:00'}`}</p>
        </Link>
      )}

      <div className="chat-log">
        {log.length === 0 && <div className="skeleton" aria-hidden="true" />}
        {log.map((entry, i) =>
          entry.role === 'me' ? (
            <div className="bubble me" key={i}>{entry.text}</div>
          ) : (
            <AgentReply key={i} data={entry.data} onOption={(opt) => send(opt.label, { ...opt, source: entry.data.source })} onAlternative={(alt) => send(alt.label, { label: alt.label, value: alt.value, source: entry.data.source })} act={act} showToast={showToast} />
          ),
        )}
        {busy && <div className="trace" aria-live="polite"><div className="trace-step"><span className="mark">…</span><span>Navigator is working<small>Understanding → Searching → Booking</small></span></div></div>}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Quiet table for 4 in the library"
          aria-label="Ask the Navigator"
          maxLength={400}
        />
        <button className="btn btn-primary" type="submit" disabled={busy}>Send</button>
      </form>

      <p className="hint">
        {config?.ai
          ? 'Gemini parses your request; every tool runs server-side with your own permissions. Prompts carry no personal data.'
          : 'No Gemini key configured: the labelled offline parser handles these requests deterministically.'}
      </p>
    </>
  );
}

function AgentReply({ data, onOption, onAlternative, act, showToast }) {
  if (!data) return null;
  const { steps = [], result, clarification, alternatives, error, source, latency_ms } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {steps.length > 0 && (
        <div className="trace">
          {steps.map((s) => (
            <div className="trace-step" key={s.key}>
              <span className="mark" aria-hidden="true">✓</span>
              <span>
                {s.label}
                <small>{s.detail}</small>
              </span>
            </div>
          ))}
          <span className="hint">
            {source === 'gemini' ? 'Gemini' : 'Offline parser'} · {Math.round((latency_ms || 0) / 100) / 10}s
          </span>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {clarification && (
        <div className="card" style={{ background: 'var(--navy-850)' }}>
          <p style={{ color: 'var(--ink)', marginBottom: 10 }}>{clarification.question}</p>
          <div className="chips">
            {clarification.options.map((opt) => (
              <button key={opt.label} className="chip" onClick={() => onOption(opt)}>{opt.label}</button>
            ))}
          </div>
        </div>
      )}

      {alternatives?.length > 0 && (
        <div className="chips">
          {alternatives.map((alt) => (
            <button key={alt.label} className="chip" onClick={() => onAlternative(alt)}>{alt.label}</button>
          ))}
        </div>
      )}

      {data.offer_now && data.intent && (
        <div className="chips">
          <button
            className="chip"
            onClick={() => onAlternative({ label: 'Book now instead', value: { ...data.intent, startAt: null, ambiguous: false } })}
          >
            Book now instead
          </button>
        </div>
      )}

      {result && (
        <div className="card" style={{ borderColor: 'var(--teal)' }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <strong>{result.space} · table {result.table}</strong>
            <span className="badge mode">{result.mode_label || 'No mode'}</span>
          </div>
          <div className="kv"><span>Time</span><span>{fmtRange(result.starts_at, result.ends_at)}</span></div>
          <div className="kv"><span>Seats open</span><span>{result.open_seats} of {result.capacity - 1} spare</span></div>
          <div className="kv"><span>Check in by</span><span>{new Date(result.checkin_deadline).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}</span></div>
          {result.qr_token && (
            <div className="qr-box" style={{ marginTop: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/qr/${result.table_id}`} alt={`QR code for ${result.space} table ${result.table}`} />
            </div>
          )}
          <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <a
              className="btn btn-sm btn-primary"
              href={result.qr_token ? `/scan?t=${result.table_id}&k=${result.qr_token}` : `/scan?t=${result.table_id}`}
            >
              Open scanner
            </a>
            <button
              className="btn btn-sm"
              onClick={async () => {
                const res = await act('cancel', { bookingId: result.booking_id });
                if (res.ok) showToast('Booking cancelled. No points lost.');
              }}
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
