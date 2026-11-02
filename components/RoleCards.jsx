'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ROLES = [
  {
    persona: 'admin',
    title: 'Admin',
    who: 'Campus operator',
    body: 'Watch detection live, override a table, reset the demo.',
    points: ['live camera + mock fallback', 'event log from real writes', 'override and reset controls'],
    href: '/admin',
    cta: 'Open dashboard',
  },
  {
    persona: 'seeker',
    title: 'User',
    who: 'Student',
    body: 'One screen: what is free now, book it, check in with a QR.',
    points: ['free count, no digging', 'book + 15 min hold', 'points after check-in'],
    href: '/radar',
    cta: 'Open table view',
  },
];

const EXTRA = [
  ['host', 'Host'],
  ['guest', 'Guest'],
  ['navigator', 'Navigator'],
];

export default function RoleCards() {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  async function enter(persona, href) {
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
      router.push(href || (persona === 'admin' ? '/admin' : '/radar'));
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  }

  return (
    <>
      <p className="mono-label l4-enter">enter as</p>
      {ROLES.map((r) => (
        <button
          key={r.persona}
          type="button"
          className="l4-role"
          onClick={() => enter(r.persona, r.href)}
          disabled={Boolean(busy)}
        >
          <span className="l4-role-head">
            <b>{r.title}</b>
            <span className="mono-label">{r.who}</span>
          </span>
          <span className="l4-role-body">{r.body}</span>
          <span className="l4-role-list">
            {r.points.map((p) => <span key={p}>{p}</span>)}
          </span>
          <span className="l4-role-cta">{busy === r.persona ? 'Opening…' : `${r.cta} ›`}</span>
        </button>
      ))}
      <div className="l4-extra">
        {EXTRA.map(([persona, label]) => (
          <button key={persona} type="button" onClick={() => enter(persona, '/radar')} disabled={Boolean(busy)}>
            demo {label}
          </button>
        ))}
      </div>
      {error && <p className="u4-fine" role="alert">{error}</p>}
    </>
  );
}
