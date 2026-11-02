'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApp, useMounted } from './AppState';
import {
  IconCompass,
  IconLogout,
  IconMore,
  IconRadar,
  IconRefresh,
  IconScan,
  IconStar,
  IconTimer,
  Logo,
} from './Icons';

const NAV_USER = [
  { href: '/radar', label: 'Tables', Icon: IconRadar },
  { href: '/session', label: 'Session', Icon: IconTimer },
  { href: '/points', label: 'Points', Icon: IconStar },
  { href: '/navigator', label: 'Ask', Icon: IconCompass },
];

const NAV_ADMIN = [
  { href: '/admin', label: 'Dashboard', Icon: IconRadar },
];

export default function Shell({ children }) {
  const { me, toast, dismissToast, online, lastSync, act } = useApp();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const mounted = useMounted();
  const seconds = Math.max(0, Math.round((Date.now() - lastSync) / 1000));
  const isAdmin = me?.role === 'admin';
  const NAV = isAdmin ? NAV_ADMIN : NAV_USER;

  useEffect(() => setOpen(false), [pathname]);

  async function resetDemo() {
    setOpen(false);
    const res = await act('reset_demo');
    if (res.ok) window.location.reload();
  }

  async function signOut() {
    setOpen(false);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  return (
    <div className="shell">
      {me?.is_demo && <div className="tape">Demo mode · simulated campus data</div>}
      {!online && (
        <div className="tape" style={{ color: 'var(--red)', background: 'rgba(255,111,97,.08)', borderColor: 'rgba(255,111,97,.25)' }}>
          Offline · showing last known state
        </div>
      )}

      <header className="hud">
        <Link href={isAdmin ? '/admin' : '/radar'} className="hud-brand" aria-label="OASIS home">
          <Logo size={22} />
          <span className="mono">OASIS</span>
          <span className="mono hud-crumb">{isAdmin ? 'admin · library' : 'library · floor 2'}</span>
        </Link>
        <div className="hud-meta">
          <span className="live" title="Seconds since the last sync">
            <i aria-hidden="true" />
            {mounted ? (seconds < 2 ? 'state · live' : `state · ${seconds}s`) : 'state · live'}
          </span>
          {!isAdmin && (
            <span className="tier-chip" title="Your tier and points balance">
              {me?.points} pts · {me?.tier}
            </span>
          )}
          <button className="icon-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <IconMore width={18} height={18} />
          </button>
        </div>
      </header>

      {open && (
        <div className="menu" role="menu">
          {me?.is_demo && (
            <button role="menuitem" onClick={resetDemo}>
              <IconRefresh width={17} height={17} /> Reset demo
            </button>
          )}
          <button role="menuitem" onClick={signOut}>
            <IconLogout width={17} height={17} /> Sign out
          </button>
        </div>
      )}

      <main className="screen">{children}</main>

      {isAdmin ? (
        <nav className="nav nav-admin" aria-label="Primary">
          <Link href="/admin" aria-current="page">
            <IconScan />
            <span>Dashboard</span>
          </Link>
          <button type="button" className="nav-signout" onClick={signOut}>Sign out</button>
        </nav>
      ) : (
        <nav className="nav" aria-label="Primary">
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>
              <Icon />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      )}

      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          {toast.undo && (
            <button
              onClick={async () => {
                await toast.undo();
                dismissToast();
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
