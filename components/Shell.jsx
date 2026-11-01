'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useApp, useMounted } from './AppState';

const NAV = [
  { href: '/radar', label: 'Radar', glyph: '◎' },
  { href: '/navigator', label: 'Navigator', glyph: '✳' },
  { href: '/scan', label: 'Scan', glyph: '⌗', scan: true },
  { href: '/session', label: 'Session', glyph: '◷' },
  { href: '/points', label: 'Points', glyph: '★' },
];

const TITLES = {
  '/radar': 'Radar',
  '/navigator': 'OASIS Navigator',
  '/scan': 'Scan',
  '/session': 'Session',
  '/points': 'OASIS Points',
};

export default function Shell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, toast, dismissToast, online, lastSync, state } = useApp();
  const mounted = useMounted();
  const secondsAgo = Math.max(0, Math.round((Date.now() - lastSync) / 1000));

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  return (
    <div className="app-shell">
      {me?.is_demo && <div className="demo-banner">Demo mode · simulated campus data</div>}
      {!online && <div className="demo-banner" style={{ color: 'var(--red)' }}>Offline: showing last known state</div>}

      <header className="topbar">
        <div>
          <h1>{TITLES[pathname] || 'OASIS'}</h1>
          <span className="who">
            {me?.first_name} · {me?.tier} · {me?.points} pts · updated {mounted ? `${secondsAgo}s ago` : 'just now'}
          </span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {me?.is_demo && (
            <button className="btn btn-sm btn-ghost" onClick={async () => {
              const res = await fetch('/api/act', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'reset_demo' }),
              });
              const data = await res.json();
              if (data.state) window.location.reload();
            }}>
              Reset demo
            </button>
          )}
          <button className="btn btn-sm btn-ghost" onClick={logout} aria-label="Sign out">↪</button>
        </div>
      </header>

      <main className="screen">{children}</main>

      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          {toast.undo && (
            <button onClick={() => { toast.undo(); dismissToast(); }}>Undo</button>
          )}
        </div>
      )}

      <nav className="nav" aria-label="Primary">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={item.scan ? 'scan' : undefined}
            aria-current={pathname === item.href ? 'page' : undefined}
          >
            <span className="glyph" aria-hidden="true">{item.glyph}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      {state?.config?.peak_now && <span className="sr-only">Peak hours now</span>}
    </div>
  );
}
