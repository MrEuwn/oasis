'use client';

import { useState } from 'react';
import Link from 'next/link';
import { fmtRange, mmss, useApp, useMounted } from './AppState';
import { IconChat, IconSend } from './Icons';

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
      <div className="screen-head">
        <div>
          <h1>Navigator</h1>
          <span className="mono">{config?.ai ? 'gemini · allowed tools only' : 'offline parser · deterministic'}</span>
        </div>
      </div>

      {log.length === 0 && (
        <div className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconChat width={17} height={17} /> One request, one booking
          </h3>
          <p>
            Say what you need in English or Bahasa Indonesia. The Navigator searches the same tables you see, books
            one, and opens the spare seats — at most one question back.
          </p>
        </div>
      )}

      <div className="chips">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="chip" onClick={() => send(s)} disabled={busy} style={{ whiteSpace: 'normal', textAlign: 'left' }}>
            {s}
          </button>
        ))}
      </div>

      {session && (
        <Link href="/session" className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="status open" style={{ color: 'var(--accent)' }}>
            <i aria-hidden="true" style={{ background: 'var(--accent)' }} />
            hold
          </span>
          <span style={{ flex: 1, fontSize: '0.9rem' }}>
            {session.space.replace(' Demo', '')} · table {session.table}
            <span className="mono" style={{ display: 'block' }}>
              {session.checked_in ? 'checked in' : `${mounted ? mmss(session.checkin_deadline) : '15:00'} to check in`}
            </span>
          </span>
        </Link>
      )}

      <div className="chat">
        {log.loading && <div className="skeleton" />}
        {log.map((entry, i) =>
          entry.role === 'me' ? (
            <div className="bubble-user" key={i}>{entry.text}</div>
          ) : (
            <AgentReply
              key={i}
              data={entry.data}
              onOption={(opt) => send(opt.label, { ...opt, source: entry.data.source })}
              onAlternative={(alt) => send(alt.label, { label: alt.label, value: alt.value, source: entry.data.source })}
              act={act}
              showToast={showToast}
            />
          ),
        )}
        {busy && (
          <div className="trace" aria-live="polite">
            <div className="trace-step">
              <b>Working…</b>
              <small>understanding · searching · booking</small>
            </div>
          </div>
        )}
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
          placeholder="Ask for a table…"
          aria-label="Ask the Navigator"
          maxLength={400}
        />
        <button type="submit" disabled={busy} aria-label="Send">
          <IconSend width={20} height={20} />
        </button>
      </form>

      <p className="hint">
        {config?.ai
          ? 'Gemini parses the request; every action runs server-side with your own permissions. Prompts carry no personal data.'
          : 'No Gemini key configured, so the labelled offline parser handles these requests deterministically.'}
      </p>
    </>
  );
}

function AgentReply({ data, onOption, onAlternative, act, showToast }) {
  if (!data) return null;
  const { steps = [], result, clarification, alternatives, error, source, latency_ms } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {steps.length > 0 && (
        <div className="trace">
          {steps.map((s) => (
            <div className="trace-step" key={s.key}>
              <b>{s.label}</b>
              <small>{s.detail}</small>
            </div>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {clarification && (
        <div className="card">
          <p style={{ color: 'var(--text)', marginBottom: 12 }}>{clarification.question}</p>
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
        <div className="result">
          <div className="result-head">
            <div>
              <span className="mono">Booked</span>
              <h3>{result.space.replace(' Demo', '')} · table {result.table}</h3>
            </div>
            <span className="badge badge-mode">{result.mode_label || 'Standard'}</span>
          </div>
          <div className="result-time">{fmtRange(result.starts_at, result.ends_at)}</div>
          <div className="kv"><span className="k">Check in by</span><span className="v">{new Date(result.checkin_deadline).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}</span></div>
          <div className="kv"><span className="k">Seats open</span><span className="v">{result.open_seats} of {result.capacity - 1}</span></div>
          {result.qr_token && (
            <div className="qr-box" style={{ marginTop: 14 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/qr/${result.table_id}`} alt={`QR code for ${result.space} table ${result.table}`} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <a
              className="btn btn-sm btn-primary"
              style={{ flex: 1 }}
              href={result.qr_token ? `/scan?t=${result.table_id}&k=${result.qr_token}` : `/scan?t=${result.table_id}`}
            >
              Open scanner
            </a>
            <button
              className="btn btn-sm"
              style={{ flex: 1 }}
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
