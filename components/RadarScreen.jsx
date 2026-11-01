'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { fmtClock, fmtRange, mmss, useApp, useMounted } from './AppState';
import { Sheet, Status } from './Sheet';
import {
  IconChat,
  IconCheck,
  IconChevron,
  IconHeadphones,
  IconMinus,
  IconPlus,
  IconQr,
  IconScan,
} from './Icons';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'free', label: 'Free' },
  { key: 'open', label: 'Open' },
  { key: 'deep_work', label: 'Deep work' },
  { key: 'networking', label: 'Networking' },
  { key: 'seats4', label: '4+ seats' },
];

const MODE_ICON = { deep_work: IconHeadphones, networking: IconChat };

function Scope({ spaces, onPick }) {
  return (
    <div className="scope">
      <svg className="scope-svg" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0.14" />
          </linearGradient>
        </defs>
        <g stroke="var(--line-strong)" fill="none">
          <circle cx="50" cy="50" r="45" />
          <circle cx="50" cy="50" r="32" strokeDasharray="1.6 3" opacity="0.8" />
          <circle cx="50" cy="50" r="18" strokeDasharray="1.6 3" opacity="0.6" />
          <path d="M50 3v6M50 91v6M3 50h6M91 50h6" opacity="0.7" />
          <path d="M50 5v90M5 50h90" opacity="0.18" />
        </g>
        <g className="scope-sweep">
          <path d="M50 50 L50 5 A45 45 0 0 1 81 19 Z" fill="url(#sweep)" />
          <line x1="50" y1="50" x2="50" y2="5" stroke="var(--accent)" strokeWidth="0.5" opacity="0.5" />
        </g>
      </svg>

      <div className="scope-label">
        <span className="mono">Campus scope</span>
        <span className="mono" style={{ color: 'var(--dim)' }}>{spaces.length} rooms · schematic</span>
      </div>

      <div className="scope-center" aria-hidden="true">
        <b />
      </div>

      <span className="mono" style={{ position: 'absolute', right: 18, bottom: 14, color: 'var(--dim)' }}>
        tap a room
      </span>

      {spaces.map((space) => {
        const left = 16 + (space.map_x ?? 50) * 0.66;
        const top = 14 + (space.map_y ?? 50) * 0.64;
        return (
          <button
            key={space.id}
            className={`contact ${space.status}`}
            style={{ left: `${left}%`, top: `${top}%` }}
            onClick={() => onPick(space.id)}
            aria-label={`${space.name}: ${space.tables_free} of ${space.tables_total} tables free`}
          >
            <span className="contact-leader" aria-hidden="true" />
            <span className="contact-dot" aria-hidden="true" />
            <span className="contact-name">{space.name.replace(' Demo', '')}</span>
            <span className="contact-meta">
              {space.tables_free}/{space.tables_total} free
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TableRow({ table, onPick }) {
  return (
    <button className="row" onClick={() => onPick(table)}>
      <div className="row-main">
        <div className="row-title">
          Table {table.label}
          {table.is_priority && <span className="badge badge-star">Priority</span>}
          {table.busy && <span className="badge badge-alert">Reported busy</span>}
        </div>
        <div className="row-meta">
          <span>{table.capacity} seats</span>
          {table.mode && <span>· {table.mode === 'deep_work' ? 'Deep work' : 'Networking'}</span>}
          {table.status === 'open' && <span>· {table.seats_free} free</span>}
          {table.topic_tag && <span>· {table.topic_tag}</span>}
        </div>
      </div>
      <div className="row-right">
        <Status status={table.status} />
      </div>
      <span className="row-chev" aria-hidden="true">
        <IconChevron width={16} height={16} />
      </span>
    </button>
  );
}

function TableDetail({ space, table, onClose, onBook, onJoin }) {
  const { act, showToast, config } = useApp();
  const [busy, setBusy] = useState(false);
  const ModeIcon = MODE_ICON[table.mode] || IconChat;

  async function report() {
    setBusy(true);
    const res = await act('report_busy', { tableId: table.id });
    setBusy(false);
    if (res.ok) {
      showToast(res.flagged ? 'Reported. The table now shows a busy badge.' : 'Reported. One more report adds the badge.');
      onClose();
    }
  }

  return (
    <Sheet
      kicker={`${space.name} · floor ${space.floor}`}
      title={`Table ${table.label}`}
      meta={`${table.capacity} seats${table.is_priority ? ' · priority' : ''}`}
      onClose={onClose}
      actions={
        <>
          {table.status === 'empty' && (
            <button className="btn btn-primary btn-block" onClick={() => onBook(table)}>
              Book now
            </button>
          )}
          {table.status === 'open' && (
            <button className="btn btn-primary btn-block" onClick={() => onJoin(table)}>
              Join open table
            </button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <a className="btn btn-sm" style={{ flex: 1 }} href={`/api/qr/${table.id}`} target="_blank" rel="noreferrer">
              <IconQr width={16} height={16} /> Table QR
            </a>
            {table.status === 'empty' && (
              <button className="btn btn-sm" style={{ flex: 1 }} onClick={report} disabled={busy}>
                Someone is here
              </button>
            )}
          </div>
          {table.status === 'full' && <p className="hint">Taken. The nearest free table is in the room list.</p>}
        </>
      }
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Status status={table.status} />
        <div className="chips">
          {table.is_priority && <span className="badge badge-star">Priority</span>}
          {table.busy && <span className="badge badge-alert">Reported busy</span>}
        </div>
      </div>

      {table.host && (
        <div>
          <div className="kv">
            <span className="k">Host</span>
            <span className="v">{table.host.name} · {table.host.program} {table.host.year}</span>
          </div>
          {table.mode && (
            <div className="kv">
              <span className="k">Mode</span>
              <span className="v" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ModeIcon width={15} height={15} /> {config?.modes?.[table.mode]?.label}
              </span>
            </div>
          )}
          {table.topic_tag && (
            <div className="kv"><span className="k">Topic</span><span className="v">{table.topic_tag}</span></div>
          )}
          {table.note && <div className="kv"><span className="k">Note</span><span className="v">{table.note}</span></div>}
          {table.status === 'open' && (
            <div className="kv"><span className="k">Seats open</span><span className="v">{table.seats_free}</span></div>
          )}
          <div className="kv"><span className="k">Ends</span><span className="v">{fmtRange(null, table.ends_at)}</span></div>
        </div>
      )}

      {table.status === 'empty' && (
        <p className="hint">Booking holds the table for 15 minutes while you walk over. Cancel any time before check-in — free.</p>
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
          ? 'Open table published. Check in within 15:00 — +15 when your first guest arrives.'
          : 'Booked. Check in within 15:00 — +10 on check-in.',
        async () => {
          await act('cancel', { bookingId: res.booking_id });
        },
      );
      onClose();
    }
  }

  return (
    <Sheet
      kicker={`${space.name} · table ${table.label}`}
      title="Book this table"
      meta={`${table.capacity} seats · starts now`}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>
            {busy
              ? 'Working…'
              : openTable
                ? `Publish · ${seats} seat${seats === 1 ? '' : 's'} open`
                : `Confirm · ${duration} min`}
          </button>
          <p className="hint" style={{ textAlign: 'center' }}>
            {openTable ? 'The table turns amber for everyone within seconds.' : 'Cancelling before check-in is free.'}
          </p>
        </>
      }
    >
      <div className="field">
        <span className="field-label">Duration</span>
        <div className="seg">
          {(config?.durations || [30, 60, 90, 120]).map((d) => (
            <button key={d} type="button" aria-pressed={duration === d} onClick={() => setDuration(d)}>
              {d}m
            </button>
          ))}
        </div>
        <span className="mono" style={{ color: 'var(--dim)' }}>
          ends {fmtClock(new Date(Date.now() + duration * 60000).toISOString())}
        </span>
      </div>

      <div className="field">
        <span className="field-label">Mode</span>
        {Object.entries(config?.modes || {}).map(([key, m]) => {
          const ModeIcon = MODE_ICON[key] || IconChat;
          return (
            <button
              key={key}
              type="button"
              className="mode-option"
              aria-pressed={mode === key}
              onClick={() => setMode(key)}
            >
              <ModeIcon width={20} height={20} />
              <span>
                <strong>{m.label}</strong>
                <small>{key === 'deep_work' ? 'Silent study together — headphones, typing, no talking.' : 'Discussion welcome — talk, explain, quiz each other.'}</small>
              </span>
              {mode === key && <IconCheck width={18} height={18} style={{ marginLeft: 'auto', flex: 'none', color: 'var(--accent)' }} />}
            </button>
          );
        })}
      </div>

      <button type="button" className="switch-row" onClick={() => setOpenTable(!openTable)} aria-pressed={openTable}>
        <span>
          <strong>Open table</strong>
          <span>
            {openTable
              ? `${seats} seat${seats === 1 ? '' : 's'} open · ${config?.modes?.[mode]?.label || 'Deep work'}`
              : 'Let others take the spare seats.'}
          </span>
        </span>
        <span className="switch" aria-checked={openTable} role="switch" aria-label="Open table" />
      </button>

      {openTable && (
        <>
          <div className="field">
            <span className="field-label">Seats to open</span>
            <div className="stepper">
              <button type="button" onClick={() => setSeats(Math.max(1, seats - 1))} aria-label="Fewer seats">
                <IconMinus width={18} height={18} />
              </button>
              <output>{seats}</output>
              <button type="button" onClick={() => setSeats(Math.min(maxSeats, seats + 1))} aria-label="More seats">
                <IconPlus width={18} height={18} />
              </button>
              <span className="hint" style={{ paddingRight: 12 }}>of {maxSeats}</span>
            </div>
          </div>
          <div className="field">
            <label htmlFor="topic">Topic</label>
            <input id="topic" type="text" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={40} placeholder="Calculus" />
          </div>
          <div className="field">
            <label htmlFor="note">Note</label>
            <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="Group problem set, beginners welcome." />
          </div>
        </>
      )}
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
      showToast('Joined. Scan the table QR within 15 minutes — +10 on check-in.');
      onClose();
    }
  }

  return (
    <Sheet
      kicker={table.host ? `Hosted by ${table.host.name} · ${table.host.program} ${table.host.year}` : 'Open table'}
      title={mode?.label || 'Open table'}
      meta={`${table.seats_free} seat${table.seats_free === 1 ? '' : 's'} free · ends ${fmtRange(null, table.ends_at)}`}
      onClose={onClose}
      actions={
        <button className="btn btn-primary btn-block" onClick={join} disabled={busy}>
          {busy ? 'Joining…' : 'Accept the norms — join'}
        </button>
      }
    >
      <p className="norms">{mode?.norms}</p>
      {table.topic_tag && <div className="kv"><span className="k">Topic</span><span className="v">{table.topic_tag}</span></div>}
      {table.note && <div className="kv"><span className="k">Note</span><span className="v">{table.note}</span></div>}
      <p className="hint">Leave quietly at any time. No explanation, no penalty.</p>
    </Sheet>
  );
}

export default function RadarScreen() {
  const { state, me, session, config } = useApp();
  const mounted = useMounted();
  const [spaceId, setSpaceId] = useState(null);
  const [table, setTable] = useState(null);
  const [bookingFor, setBookingFor] = useState(null);
  const [joinFor, setJoinFor] = useState(null);
  const [filter, setFilter] = useState('all');

  const spaces = state.spaces || [];
  const space = spaces.find((s) => s.id === spaceId) || null;

  const free = spaces.reduce((n, s) => n + s.tables_free, 0);
  const open = spaces.reduce((n, s) => n + s.open_tables, 0);
  const seats = spaces.reduce((n, s) => n + s.tables.reduce((m, t) => m + (t.status === 'open' ? t.seats_free : 0), 0), 0);

  const openTables = useMemo(
    () =>
      spaces.flatMap((s) =>
        s.tables.filter((t) => t.status === 'open').map((t) => ({ table: t, space: s })),
      ),
    [spaces],
  );

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

  return (
    <>
      <div className="screen-head">
        <div>
          <h1>Radar</h1>
          <span className="mono">live availability · {spaces.length === 1 ? '1 room' : `${spaces.length} rooms`}</span>
        </div>
        {config?.peak_now && <span className="badge badge-star">Peak hours</span>}
      </div>

      {session && (
        <Link
          href="/session"
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: 12, borderColor: 'color-mix(in srgb, var(--accent) 45%, transparent)' }}
        >
          <span className="status open" style={{ color: 'var(--accent)' }}>
            <i aria-hidden="true" style={{ background: 'var(--accent)' }} />
            {session.checked_in ? 'checked in' : 'hold'}
          </span>
          <span style={{ flex: 1, fontSize: '0.9rem' }}>
            {session.space.replace(' Demo', '')} · table {session.table}
            <span className="mono" style={{ display: 'block' }}>
              {session.checked_in
                ? `ends ${fmtRange(null, session.ends_at)}`
                : `${mounted ? mmss(session.checkin_deadline) : '15:00'} to check in`}
            </span>
          </span>
          <IconChevron width={16} height={16} />
        </Link>
      )}

      {spaces.length > 0 ? (
        <Scope spaces={spaces} onPick={setSpaceId} />
      ) : (
        <div className="empty">
          <IconScan width={30} height={30} />
          <h2>No rooms yet</h2>
          <p>Ask an administrator to seed the campus spaces.</p>
        </div>
      )}

      <div className="stats-row">
        <div className="stat">
          <b>{free}</b>
          <span>{free === 1 ? 'Empty table' : 'Empty tables'}</span>
        </div>
        <div className="stat">
          <b>{open}</b>
          <span>{open === 1 ? 'Shared table' : 'Shared tables'}</span>
        </div>
        <div className="stat">
          <b>{seats}</b>
          <span>Seats to join</span>
        </div>
      </div>

      <div className="list">
        <div className="list-head">
          <span className="mono">Rooms</span>
          <span className="mono">{spaces.length}</span>
        </div>
        {spaces.map((s) => (
          <button key={s.id} className="row" onClick={() => setSpaceId(s.id)}>
            <div className="row-main">
              <div className="row-title">{s.name.replace(' Demo', '')}</div>
              <div className="row-meta">
                <span>Floor {s.floor}</span>
                <span>· {s.tables_total} tables</span>
              </div>
            </div>
            <div className="row-right">
              <Status status={s.status} room />
              <span className="mono" style={{ color: 'var(--dim)' }}>{s.tables_free} free</span>
            </div>
          </button>
        ))}
      </div>

      {openTables.length > 0 && (
        <div className="list">
          <div className="list-head">
            <span className="mono">Open tables now</span>
            <span className="mono">{openTables.length}</span>
          </div>
          {openTables.map(({ table: t, space: s }) => (
            <button key={t.id} className="row" onClick={() => { setSpaceId(s.id); setTable(t); }}>
              <div className="row-main">
                <div className="row-title">
                  {s.name.replace(' Demo', '')} · {t.label}
                  {t.is_priority && <span className="badge badge-star">Priority</span>}
                </div>
                <div className="row-meta">
                  <span>{t.mode === 'deep_work' ? 'Deep work' : 'Networking'}</span>
                  <span>· {t.seats_free} free</span>
                  {t.topic_tag && <span>· {t.topic_tag}</span>}
                  <span>· ends {fmtRange(null, t.ends_at)}</span>
                </div>
              </div>
              <span className="badge badge-mode">Join</span>
              <span className="row-chev" aria-hidden="true">
                <IconChevron width={16} height={16} />
              </span>
            </button>
          ))}
        </div>
      )}

      {me?.paused && (
        <p className="hint">
          Priority perks paused until{' '}
          {new Date(me.paused_until).toLocaleDateString('en-GB', { timeZone: 'Asia/Jakarta' })}. Booking still works; no points were deducted.
        </p>
      )}

      {space && !table && (
        <Sheet
          kicker={`Floor ${space.floor} · ${space.tables_free} of ${space.tables_total} free`}
          title={space.name.replace(' Demo', '')}
          onClose={() => setSpaceId(null)}
        >
          <div className="chips">
            {FILTERS.map((f) => (
              <button key={f.key} className="chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
          <div>
            {tables.map((t) => (
              <TableRow key={t.id} table={t} onPick={setTable} />
            ))}
            {!tables.length && <p className="hint" style={{ padding: '16px 0' }}>Nothing matches that filter in this room.</p>}
          </div>
        </Sheet>
      )}

      {space && table && !bookingFor && !joinFor && (
        <TableDetail
          space={space}
          table={table}
          onClose={() => setTable(null)}
          onBook={setBookingFor}
          onJoin={setJoinFor}
        />
      )}

      {space && bookingFor && (
        <BookingSheet
          table={bookingFor}
          space={space}
          onClose={() => {
            setBookingFor(null);
            setTable(null);
            setSpaceId(null);
          }}
        />
      )}

      {space && joinFor && (
        <JoinSheet
          table={joinFor}
          onClose={() => {
            setJoinFor(null);
            setTable(null);
            setSpaceId(null);
          }}
        />
      )}
    </>
  );
}
