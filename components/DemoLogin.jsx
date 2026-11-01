'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const PERSONAS = [
  { key: 'seeker', label: 'Seeker' },
  { key: 'host', label: 'Host' },
  { key: 'guest', label: 'Guest' },
  { key: 'navigator', label: 'Navigator' },
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
          {busy === 'seeker' ? 'Opening…' : 'One-Click Demo Login'}
        </button>
      )}
      {chips && (
        <div className="chips" style={{ marginTop: 12 }}>
          {PERSONAS.map((p) => (
            <button key={p.key} className="chip" onClick={() => enter(p.key)} disabled={Boolean(busy)}>
              {busy === p.key ? '…' : `Demo ${p.label}`}
            </button>
          ))}
        </div>
      )}
      {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
      <p className="hint" style={{ marginTop: 10 }}>
        Demo mode · simulated campus data. No password, no Google account.
      </p>
    </div>
  );
}
