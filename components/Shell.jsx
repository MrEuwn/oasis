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

const NAV = [
  { href: '/radar', label: 'Radar', Icon: IconRadar },
  { href: '/navigator', label: 'Navigator', Icon: IconCompass },
  { href: '/scan', label: 'Scan', Icon: IconScan, scan: true },
  { href: '/session', label: 'Session', Icon: IconTimer },
  { href: '/points', label: 'Points', Icon: IconStar },
];

export default function Shell({ children }) {
  const { me, toast, dismissToast, online, lastSync, act } = useApp();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const mounted = useMounted();
  const seconds = Math.max(0, Math.round((Date.now() - lastSync) / 1000));

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
        <Link href="/radar" className="hud-brand" aria-label="OASIS radar">
          <Logo size={24} />
          <span className="mono">OASIS</span>
        </Link>
        <div className="hud-meta">
          <span className="live" title="Seconds since the last sync">
            <i aria-hidden="true" />
            {mounted ? (seconds < 2 ? 'live' : `live · ${seconds}s`) : 'live'}
          </span>
          <span className="tier-chip" title="Your tier and points balance">
            {me?.tier} · {me?.points} pts
          </span>
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

      <nav className="nav" aria-label="Primary">
        {NAV.map(({ href, label, Icon, scan }) => (
          <Link
            key={href}
            href={href}
            className={scan ? 'scan-tab' : undefined}
            aria-current={pathname === href ? 'page' : undefined}
          >
            {scan ? (
              <span className="scan-fab">
                <Icon />
              </span>
            ) : (
              <Icon />
            )}
            <span>{label}</span>
          </Link>
        ))}
      </nav>

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
