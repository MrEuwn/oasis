'use client';

import { useApp } from './AppState';
import { IconCheck, IconLock } from './Icons';

export default function PointsScreen() {
  const { me, config, state } = useApp();
  if (!me) return <div className="skeleton" />;

  const tiers = config?.tiers || [];
  const next = me.next_tier;
  const prevMin = [...tiers].reverse().find((t) => t.min <= me.points)?.min || 0;
  const pct = next ? Math.round(((me.points - prevMin) / (next.at - prevMin)) * 100) : 100;

  return (
    <>
      <div className="screen-head">
        <div>
          <h1>Points</h1>
          <span className="mono">balance, perks & ledger</span>
        </div>
        {me.streak > 0 && <span className="tier-chip">{me.streak} streak</span>}
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <span className="mono">Balance</span>
            <div style={{ fontFamily: 'var(--mono)', fontSize: '2.75rem', lineHeight: 1, letterSpacing: '-0.04em', marginTop: 8 }}>
              {me.points}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="mono">Tier</span>
            <div style={{ fontSize: '1rem', fontWeight: 600, marginTop: 6 }}>{me.tier}</div>
            <span className="hint">{next ? `${next.at - me.points} to ${next.name}` : 'Top tier'}</span>
          </div>
        </div>
        <div className="tier-progress" role="progressbar" aria-valuenow={Math.max(0, Math.min(100, pct))} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${Math.max(3, Math.min(100, pct))}%` }} />
        </div>
        {me.paused && (
          <p className="hint" style={{ marginTop: 10 }}>
            Priority perks paused until {new Date(me.paused_until).toLocaleDateString('en-GB', { timeZone: 'Asia/Jakarta' })}. No points were deducted.
          </p>
        )}
      </div>

      <div className="card">
        <h3>Perks</h3>
        <div className="perk-row on">
          <span>Book a table now</span>
          <span className="state"><IconCheck width={12} height={12} /> Unlocked</span>
        </div>
        <div className={`perk-row ${me.priority ? 'on' : ''}`}>
          <span>Priority tables at peak hours</span>
          <span className="state">
            {me.priority ? <><IconCheck width={12} height={12} /> Unlocked</> : <><IconLock width={12} height={12} /> Reef · 50 pts</>}
          </span>
        </div>
        <div className={`perk-row ${me.advance > 0 ? 'on' : ''}`}>
          <span>Book ahead · {me.advance > 0 ? `${me.advance} min` : '60 min at Reef'}</span>
          <span className="state">
            {me.advance > 0 ? <><IconCheck width={12} height={12} /> Unlocked</> : <><IconLock width={12} height={12} /> Reef · 50 pts</>}
          </span>
        </div>
        <div className={`perk-row ${me.tier === 'Deep Blue' ? 'on' : ''}`}>
          <span>Extend a session when nobody waits</span>
          <span className="state">
            {me.tier === 'Deep Blue' ? <><IconCheck width={12} height={12} /> Unlocked</> : <><IconLock width={12} height={12} /> Deep Blue · 150 pts</>}
          </span>
        </div>
      </div>

      <div className="card">
        <h3>How points are earned</h3>
        <div className="ledger">
          <div className="ledger-row"><span>Check in on time</span><span className="pts">+{config?.points?.CHECKIN ?? 10}</span></div>
          <div className="ledger-row"><span>Complete a session</span><span className="pts">+{config?.points?.COMPLETE ?? 5}</span></div>
          <div className="ledger-row"><span>Host a successful open table</span><span className="pts">+{config?.points?.HOST_SUCCESS ?? 15}</span></div>
          <div className="ledger-row"><span>Leave 10+ minutes early</span><span className="pts">+{config?.points?.GOOD_NEIGHBOUR ?? 2}</span></div>
          <div className="ledger-row"><span>Confirm the mode was respected</span><span className="pts">+{config?.points?.MODE_RESPECTED ?? 3}</span></div>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          Daily cap {config?.daily_cap ?? 50}. Nothing is ever deducted; a missed check-in simply earns nothing.
        </p>
      </div>

      <div className="list">
        <div className="list-head">
          <span className="mono">Recent activity</span>
          <span className="mono">{state.points_history.length}</span>
        </div>
        {state.points_history.length === 0 && <p className="hint" style={{ padding: '14px 0' }}>Nothing yet. Check in to a table to start.</p>}
        {state.points_history.map((e) => (
          <div className="ledger-row" key={e.id}>
            <span>
              {e.label}
              <span className="when">
                {new Date(e.at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Jakarta' })}
              </span>
            </span>
            <span className="pts">+{e.points}</span>
          </div>
        ))}
      </div>

      <p className="hint">
        The ledger is append-only and every award happens server-side. Host points need a different guest to show up.
      </p>
    </>
  );
}
