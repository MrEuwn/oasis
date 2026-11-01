'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fmtRange, mmss, statusIcon, statusText, useApp, useMounted } from './AppState';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'free', label: 'Free now' },
  { key: 'open', label: 'Open tables' },
  { key: 'deep_work', label: 'Deep Work' },
  { key: 'networking', label: 'Networking' },
  { key: 'seats4', label: '4+ seats' },
];

export function StatusPill({ status }) {
  return (
    <span className={`status-pill ${status}`}>
      <span aria-hidden="true">{statusIcon(status)}</span> {statusText(status)}
    </span>
  );
}

export function Sheet({ title, subtitle, onClose, children, labelledBy = 'sheet-title' }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        <div className="sheet-handle" aria-hidden="true" />
        <header className="sheet-head">
          <div>
            <h2 id={labelledBy}>{title}</h2>
            {subtitle && <span className="hint">{subtitle}</span>}
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>
        {children}
      </section>
    </>
  );
}

function RadarMap({ spaces, onPick }) {
  return (
    <svg className="room-map" viewBox="0 0 100 100" role="group" aria-label="Campus map with room status">
      {[25, 50, 75].map((n) => (
        <g key={n} stroke="var(--line)" strokeWidth="0.2" opacity="0.5">
          <line x1={n} y1="0" x2={n} y2="100" />
          <line x1="0" y1={n} x2="100" y2={n} />
        </g>
      ))}
      <path d="M0 78 H100" stroke="var(--line)" strokeWidth="1.2" opacity="0.7" />
      <text x="48" y="83">corridor</text>
      {spaces.map((space) => {
        const fill =
          space.status === 'empty' ? 'var(--green)' : space.status === 'open' ? 'var(--yellow)' : 'var(--red)';
        return (
          <g key={space.id} onClick={() => onPick(space.id)} style={{ cursor: 'pointer' }} role="button" tabIndex={0}
             aria-label={`${space.name}: ${statusText(space.status)}, ${space.tables_free} of ${space.tables_total} tables free`}
             onKeyDown={(e) => {
               if (e.key === 'Enter' || e.key === ' ') onPick(space.id);
             }}>
            <circle cx={space.map_x} cy={space.map_y} r="13" fill={fill} opacity="0.16" />
            <circle cx={space.map_x} cy={space.map_y} r="13" fill="none" stroke={fill} strokeWidth="0.7" />
            <circle cx={space.map_x} cy={space.map_y} r="3.4" fill={fill} />
            <text x={space.map_x} y={space.map_y + 6.5} textAnchor="middle" style={{ fontSize: 3.4 }}>
              {space.name.replace(' Demo', '')} · {statusText(space.status)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function TableRow({ table, onPick }) {
  return (
    <button className="table-row" onClick={() => onPick(table)}>
      <div>
        <strong>Table {table.label}</strong>
        <div className="meta">
          <span className="badge">{table.capacity} seats</span>
          {table.mode && <span className="badge mode">{table.mode === 'deep_work' ? '🎧 Deep Work' : '💬 Networking'}</span>}
          {table.is_priority && <span className="badge priority">★ Priority</span>}
          {table.busy && <span className="badge busy">Reported busy</span>}
          {table.status === 'open' && <span className="badge">{table.seats_free} of {table.open_seats ?? table.seats_free} open</span>}
          {table.topic_tag && <span className="badge">{table.topic_tag}</span>}
        </div>
      </div>
      <StatusPill status={table.status} />
    </button>
  );
}

function TableDetail({ space, table, onClose, onBook, onJoin }) {
  const { act, showToast, config, session } = useApp();
  const [busy, setBusy] = useState(false);
  const live = config?.modes?.[table.mode];

  async function report() {
    setBusy(true);
    const res = await act('report_busy', { tableId: table.id });
    setBusy(false);
    if (res.ok) {
      showToast(res.flagged ? 'Reported. This table now shows a “Reported busy” badge.' : 'Reported. One more report adds the badge.');
      onClose();
    }
  }

  return (
    <Sheet title={`Table ${table.label} · ${space.name}`} subtitle={`${table.capacity} seats · floor ${space.floor}`} onClose={onClose}>
      <div className="row between" style={{ marginBottom: 12 }}>
        <StatusPill status={table.status} />
        <div className="row" style={{ gap: 6 }}>
          {table.is_priority && <span className="badge priority">★ Priority</span>}
          {table.busy && <span className="badge busy">Reported busy</span>}
        </div>
      </div>

      {table.host && (
        <div className="card" style={{ marginBottom: 12, background: 'var(--navy-850)' }}>
          <div className="kv"><span>Host</span><span>{table.host.name} · {table.host.program} {table.host.year}</span></div>
          {table.mode && <div className="kv"><span>Mode</span><span>{live?.label}</span></div>}
          {table.topic_tag && <div className="kv"><span>Topic</span><span>{table.topic_tag}</span></div>}
          {table.note && <div className="kv"><span>Note</span><span>{table.note}</span></div>}
          {table.status === 'open' && <div className="kv"><span>Seats open</span><span>{table.seats_free}</span></div>}
          <div className="kv"><span>Ends</span><span>{fmtRange(table.checkin_deadline || table.ends_at, table.ends_at)}</span></div>
        </div>
      )}

      {table.status === 'empty' && (
        <>
          <button className="btn btn-primary btn-block" onClick={() => onBook(table)}>Book now</button>
          <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <a className="btn btn-sm" href={`/api/qr/${table.id}`} target="_blank" rel="noreferrer">Show QR</a>
            <button className="btn btn-sm" onClick={report} disabled={busy}>Someone is here</button>
          </div>
          {session && (
            <p className="hint" style={{ marginTop: 10 }}>You already hold a session — finish or leave it first.</p>
          )}
        </>
      )}

      {table.status === 'open' && (
        <>
          <button className="btn btn-primary btn-block" onClick={() => onJoin(table)}>Join Open Table</button>
          <a className="btn btn-sm btn-block" href={`/api/qr/${table.id}`} target="_blank" rel="noreferrer" style={{ marginTop: 8 }}>Show QR</a>
          <p className="hint" style={{ marginTop: 10 }}>
            You will accept the {live?.label} norms before joining. Leave quietly at any time, no explanation needed.
          </p>
        </>
      )}

      {table.status === 'full' && (
        <>
          <p className="hint">This table is taken. The Radar shows the nearest free table in the room list.</p>
          <a className="btn btn-sm btn-block" href={`/api/qr/${table.id}`} target="_blank" rel="noreferrer" style={{ marginTop: 8 }}>Show QR</a>
        </>
      )}
    </Sheet>
  );
}

function BookingSheet({ table, space, onClose }) {
  const { act, showToast, config } = useApp();
  const remembered = typeof window === 'undefined' ? {} : JSON.parse(window.localStorage.getItem('oasis_defaults') || '{}');
  const [duration, setDuration] = useState(remembered.duration || 60);
  const [mode, setMode] = useState(remembered.mode || 'deep_work');
  const [openTable, setOpenTable] = useState(false);
  const [seats, setSeats] = useState(2);
  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const maxSeats = Math.max(1, table.capacity - 1);

  async function submit() {
    setBusy(true);
    const res = await act('create_booking', {
      tableId: table.id,
      duration,
      mode,
      openSeats: openTable ? seats : 0,
      topic,
      note,
    });
    setBusy(false);
    if (res.ok) {
      window.localStorage.setItem('oasis_defaults', JSON.stringify({ duration, mode }));
      showToast(
        openTable
          ? `Open Table published. Check in within 15:00 — +15 when your first guest shows up.`
          : `Booked. Check in within 15:00 — +10 on check-in.`,
        async () => {
          await act('cancel', { bookingId: res.booking_id });
        },
      );
      onClose();
    }
  }

  return (
    <Sheet title="Book this table" subtitle={`${space.name} · table ${table.label} · ${table.capacity} seats`} onClose={onClose}>
      <div className="field">
        <span className="label">Duration</span>
        <div className="chips">
          {(config?.durations || [30, 60, 90, 120]).map((d) => (
            <button key={d} className="chip" aria-pressed={duration === d} onClick={() => setDuration(d)}>{d} min</button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="label">Mode</span>
        <div className="chips">
          {Object.entries(config?.modes || {}).map(([key, m]) => (
            <button key={key} className="chip" aria-pressed={mode === key} onClick={() => setMode(key)}>
              {key === 'deep_work' ? '🎧' : '💬'} {m.label}
            </button>
          ))}
        </div>
      </div>

      <button className="toggle" aria-pressed={openTable} onClick={() => setOpenTable(!openTable)}>
        <span>
          <strong>Open Table</strong>
          <br />
          <span className="hint">Let other students take the spare seats.</span>
        </span>
        <span className="badge mode">{openTable ? 'On' : 'Off'}</span>
      </button>

      {openTable && (
        <>
          <div className="field">
            <span className="label">Seats to open</span>
            <div className="stepper">
              <button onClick={() => setSeats(Math.max(1, seats - 1))} aria-label="Fewer seats">−</button>
              <strong>{seats}</strong>
              <button onClick={() => setSeats(Math.min(maxSeats, seats + 1))} aria-label="More seats">+</button>
              <span className="hint">of {maxSeats} spare</span>
            </div>
          </div>
          <div className="field">
            <label htmlFor="topic">Course or topic tag (optional)</label>
            <input id="topic" type="text" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={40} placeholder="Calculus" />
          </div>
          <div className="field">
            <label htmlFor="note">Note (optional, 140 characters)</label>
            <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="Group problem set, beginners welcome." />
          </div>
        </>
      )}

      <button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>
        {busy ? 'Working…' : openTable ? 'Publish Open Table' : 'Confirm booking'}
      </button>
      <p className="hint" style={{ marginTop: 10 }}>
        {openTable ? 'The table turns yellow for everyone within seconds.' : 'The table turns red for everyone within seconds.'} Cancelling before check-in is free.
      </p>
    </Sheet>
  );
}

function JoinSheet({ table, onClose }) {
  const { act, showToast, config } = useApp();
  const [busy, setBusy] = useState(false);
  const mode = config?.modes?.[table.mode];

  async function join() {
    setBusy(true);
    const res = await act('join', { bookingId: table.booking_id, normsAccepted: true });
    setBusy(false);
    if (res.ok) {
      showToast('Joined. Scan the table QR within 15 minutes — +10 when you check in.');
      onClose();
    }
  }

  return (
    <Sheet title={`Join ${mode?.label || 'Open Table'}`} subtitle={`${table.host?.name} · ${table.host?.program} ${table.host?.year}`} onClose={onClose}>
      <div className="card" style={{ background: 'var(--navy-850)', marginBottom: 14 }}>
        <p style={{ color: 'var(--ink)' }}>{mode?.norms}</p>
      </div>
      <div className="kv"><span>Seats left</span><span>{table.seats_free}</span></div>
      <div className="kv"><span>Ends</span><span>{fmtRange(null, table.ends_at)}</span></div>
      {table.topic_tag && <div className="kv"><span>Topic</span><span>{table.topic_tag}</span></div>}
      {table.note && <div className="kv"><span>Note</span><span>{table.note}</span></div>}
      <button className="btn btn-primary btn-block" onClick={join} disabled={busy} style={{ marginTop: 14 }}>
        {busy ? 'Joining…' : 'I accept the norms — join'}
      </button>
      <p className="hint" style={{ marginTop: 10 }}>Leave quietly at any time. No explanation, no penalty.</p>
    </Sheet>
  );
}

export default function RadarScreen() {
  const { state, me, session, config, lastSync } = useApp();
  const mounted = useMounted();
  const [spaceId, setSpaceId] = useState(null);
  const [table, setTable] = useState(null);
  const [bookingFor, setBookingFor] = useState(null);
  const [joinFor, setJoinFor] = useState(null);
  const [filter, setFilter] = useState('all');

  const spaces = state.spaces || [];
  const space = spaces.find((s) => s.id === spaceId) || null;

  const tables = useMemo(() => {
    if (!space) return [];
    return space.tables.filter((t) => {
      if (filter === 'free') return t.status === 'empty';
      if (filter === 'open') return t.status === 'open';
      if (filter === 'deep_work' || filter === 'networking') return t.mode === filter;
      if (filter === 'seats4') return t.capacity >= 4;
      return true;
    });
  }, [space, filter]);

  const seconds = Math.max(0, Math.round((Date.now() - lastSync) / 1000));

  return (
    <>
      {session && (
        <Link href="/session" className="card" style={{ display: 'block', borderColor: 'var(--teal)' }}>
          <div className="row between">
            <strong>You hold {session.space} · {session.table}</strong>
            <span className="badge mode">{session.checked_in ? 'Checked in' : 'Check in'}</span>
          </div>
          <p style={{ marginTop: 6 }}>
            {session.checked_in
              ? `Session ends ${fmtRange(null, session.ends_at)}`
              : `Check in within ${mounted ? mmss(session.checkin_deadline) : '15:00'}`} · tap to manage
          </p>
        </Link>
      )}

      <RadarMap spaces={spaces} onPick={setSpaceId} />

      <div className="row between">
        <div className="legend">
          <span><i className="dot empty" aria-hidden="true" /> Empty</span>
          <span><i className="dot open" aria-hidden="true" /> Open Table</span>
          <span><i className="dot full" aria-hidden="true" /> Full</span>
        </div>
        <span className="hint">updated {mounted ? `${seconds}s ago` : 'just now'}</span>
      </div>

      <div>
        {spaces.map((s) => (
          <button key={s.id} className="room-row" onClick={() => setSpaceId(s.id)}>
            <span>
              <strong>{s.name}</strong>
              <small>Floor {s.floor} · {s.tables_free} of {s.tables_total} tables free · {s.open_tables} open</small>
            </span>
            <StatusPill status={s.status} />
          </button>
        ))}
        {!spaces.length && <p className="hint">No rooms yet. Ask an administrator to seed the campus.</p>}
      </div>

      {me?.paused && (
        <p className="hint">
          Priority perks are paused until {new Date(me.paused_until).toLocaleDateString('en-GB', { timeZone: 'Asia/Jakarta' })}.
          Booking, the Radar and the Navigator still work, and no points were deducted.
        </p>
      )}
      {config?.peak_now && <p className="hint">Peak hours now: ★ priority tables need Reef tier or above.</p>}

      {space && !table && (
        <Sheet title={space.name} subtitle={`${space.tables_free} of ${space.tables_total} tables free`} onClose={() => setSpaceId(null)}>
          <div className="chips" style={{ marginBottom: 14 }}>
            {FILTERS.map((f) => (
              <button key={f.key} className="chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          {tables.map((t) => (
            <TableRow key={t.id} table={t} onPick={setTable} />
          ))}
          {!tables.length && <p className="hint">Nothing matches that filter in this room.</p>}
        </Sheet>
      )}

      {space && table && !bookingFor && !joinFor && (
        <TableDetail
          space={space}
          table={table}
          onClose={() => setTable(null)}
          onBook={(t) => setBookingFor(t)}
          onJoin={(t) => setJoinFor(t)}
        />
      )}

      {space && bookingFor && (
        <BookingSheet table={bookingFor} space={space} onClose={() => { setBookingFor(null); setTable(null); setSpaceId(null); }} />
      )}

      {space && joinFor && (
        <JoinSheet table={joinFor} onClose={() => { setJoinFor(null); setTable(null); setSpaceId(null); }} />
      )}
    </>
  );
}
