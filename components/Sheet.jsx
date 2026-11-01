'use client';

import { useEffect } from 'react';
import { IconClose } from './Icons';

const LABELS = { empty: 'Empty', open: 'Open Table', full: 'Full', in_use: 'Seen occupied' };
const ROOM_LABELS = { empty: 'Free', open: 'Open', full: 'Full', in_use: 'Occupied' };

export function Status({ status, room = false }) {
  return (
    <span className={`status ${status}`}>
      <i aria-hidden="true" />
      {(room ? ROOM_LABELS : LABELS)[status]}
    </span>
  );
}

export function Sheet({ kicker, title, meta, onClose, children, actions }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div className="grabber" aria-hidden="true" />
        <header className="sheet-head">
          <div>
            {kicker && <span className="mono">{kicker}</span>}
            <h2 id="sheet-title">{title}</h2>
            {meta && <span className="mono" style={{ display: 'block', marginTop: 4 }}>{meta}</span>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose width={18} height={18} />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {actions && <div className="sheet-actions">{actions}</div>}
      </section>
    </>
  );
}
