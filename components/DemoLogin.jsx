'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconChevron } from './Icons';

const PERSONAS = [
  { key: 'seeker', label: 'Seeker', note: 'Shallows · 20 pts' },
  { key: 'host', label: 'Host', note: 'Reef · open table' },
  { key: 'guest', label: 'Guest', note: 'Shallows · 35 pts' },
  { key: 'navigator', label: 'Navigator', note: 'Deep Blue · 180 pts' },
];

export default function DemoLogin({ primary = true, chips = true, redirect = '/radar' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  async function enter(persona) {
    setBusy(persona);
    setError('');
    try {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ persona }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Could not sign in');
      router.push(redirect);
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  }

  return (
    <div>
      {primary && (
        <button className="btn btn-primary btn-block" onClick={() => enter('seeker')} disabled={Boolean(busy)}>
          {busy === 'seeker' ? 'Opening…' : 'Enter as Demo Seeker'}
          {busy !== 'seeker' && <IconChevron width={16} height={16} />}
        </button>
      )}
      {chips && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: primary ? 10 : 0 }}>
          {PERSONAS.map((p) => (
            <button
              key={p.key}
              className="btn"
              style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2, height: 'auto', padding: '10px 12px' }}
              onClick={() => enter(p.key)}
              disabled={Boolean(busy)}
            >
              <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{busy === p.key ? '…' : `Demo ${p.label}`}</span>
              <span className="mono" style={{ fontSize: '0.5625rem' }}>{p.note}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
      <p className="hint" style={{ marginTop: 12 }}>
        Demo campus · simulated data. No password.
      </p>
    </div>
  );
}
