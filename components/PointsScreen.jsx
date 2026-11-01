'use client';

import { useApp } from './AppState';

export default function PointsScreen() {
  const { me, config, state } = useApp();
  if (!me) return <div className="skeleton" />;

  const tiers = config?.tiers || [];
  const next = me.next_tier;
  const prevMin = [...tiers].reverse().find((t) => t.min <= me.points)?.min || 0;
  const pct = next ? Math.round(((me.points - prevMin) / (next.at - prevMin)) * 100) : 100;

  return (
    <>
      <div className="card">
        <div className="ring" style={{ '--p': `${Math.max(3, Math.min(100, pct))}%` }}>
          <div className="ring-content">
            <strong>{me.points}</strong>
            <span>OASIS Points</span>
          </div>
        </div>
        <div className="row between" style={{ marginTop: 8 }}>
          <strong>{me.tier}</strong>
          <span className="hint">
            {next ? `${next.at - me.points} to ${next.name}` : 'Top tier reached'}
          </span>
        </div>
        <div className="kv"><span>Check-in streak</span><span>{me.streak} in a row</span></div>
        <div className="kv"><span>Advance booking</span><span>{me.advance} minutes</span></div>
        <div className="kv"><span>Priority tables</span><span>{me.priority ? 'Unlocked at peak hours' : 'Reef tier and above'}</span></div>
        {me.paused && <p className="hint" style={{ marginTop: 10 }}>Priority perks paused until {new Date(me.paused_until).toLocaleDateString('en-GB', { timeZone: 'Asia/Jakarta' })}. No points were deducted.</p>}
      </div>

      <div className="card">
        <h3>How points are earned</h3>
        <ul className="list-plain">
          <li><span>Check in on time</span><span>+{config?.points?.CHECKIN ?? 10}</span></li>
          <li><span>Complete a session</span><span>+{config?.points?.COMPLETE ?? 5}</span></li>
          <li><span>Host a successful Open Table</span><span>+{config?.points?.HOST_SUCCESS ?? 15}</span></li>
          <li><span>Good Neighbour (leave 10+ min early)</span><span>+{config?.points?.GOOD_NEIGHBOUR ?? 2}</span></li>
          <li><span>Confirm the mode was respected</span><span>+{config?.points?.MODE_RESPECTED ?? 3}</span></li>
        </ul>
        <p className="hint" style={{ marginTop: 10 }}>
          Daily cap {config?.daily_cap ?? 50} points. Points are never deducted; a missed check-in simply earns nothing.
        </p>
      </div>

      <div className="card">
        <h3>Tiers and perks</h3>
        <ul className="list-plain">
          {tiers.map((t) => (
            <li key={t.name}>
              <span>{t.name} <span className="hint">({t.min}+)</span></span>
              <span className="hint">
                {t.name === 'Shallows' ? 'Standard tables' : t.name === 'Reef' ? 'Priority + 60 min ahead' : 'Priority + 120 min ahead + extend'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>Recent events</h3>
        {state.points_history.length === 0 && <p>Nothing yet. Check in to a table to start.</p>}
        <ul className="list-plain">
          {state.points_history.map((e) => (
            <li key={e.id}>
              <span>{e.label}</span>
              <span>+{e.points} · {new Date(e.at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Jakarta' })}</span>
            </li>
          ))}
        </ul>
        <p className="hint" style={{ marginTop: 10 }}>
          The ledger is append-only and every award happens server-side. Host points require a different guest to show
          up; the same pair earns at most twice a day.
        </p>
      </div>
    </>
  );
}
