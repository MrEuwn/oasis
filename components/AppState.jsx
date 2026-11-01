'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const Ctx = createContext(null);

const TZ = 'Asia/Jakarta';

export function fmtClock(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
}

export function fmtRange(startIso, endIso) {
  return `${fmtClock(startIso)}–${fmtClock(endIso)}`;
}

export function minutesLeft(iso, now = Date.now()) {
  if (!iso) return 0;
  return Math.max(0, Math.round((Date.parse(iso) - now) / 60000));
}

export function mmss(iso, now = Date.now()) {
  const ms = Math.max(0, Date.parse(iso) - now);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function statusText(status) {
  return status === 'empty' ? 'Empty' : status === 'open' ? 'Open Table' : 'Full';
}

export function statusIcon(status) {
  return status === 'empty' ? '○' : status === 'open' ? '◐' : '●';
}

export function AppProvider({ initial, children }) {
  const [state, setState] = useState(initial);
  const [lastSync, setLastSync] = useState(Date.now());
  const [toast, setToast] = useState(null);
  const [online, setOnline] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.state) {
        setState(data.state);
        setLastSync(Date.now());
        setOnline(true);
      }
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, 2000);
    const onOnline = () => refresh();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', () => setOnline(false));
    return () => {
      clearInterval(id);
      window.removeEventListener('online', onOnline);
    };
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const act = useCallback(async (action, payload = {}) => {
    try {
      const res = await fetch('/api/act', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await res.json();
      if (data.state) {
        setState(data.state);
        setLastSync(Date.now());
      }
      if (!data.ok && data.error) setToast({ text: data.error });
      return data;
    } catch {
      setToast({ text: 'Network error — try again.' });
      return { ok: false };
    }
  }, []);

  const value = useMemo(
    () => ({
      state,
      me: state.me,
      session: state.my_session,
      config: state.config,
      lastSync,
      now: Date.now(),
      online,
      toast,
      showToast: (text, undo) => setToast({ text, undo }),
      dismissToast: () => setToast(null),
      act,
      refresh,
      tick,
    }),
    [state, lastSync, online, toast, act, refresh, tick],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Time-sensitive strings must not render during SSR: the server's clock and the
// browser's differ, which React reports as a hydration mismatch.
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp outside AppProvider');
  return ctx;
}
