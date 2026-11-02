'use client';

import { useEffect, useRef, useState } from 'react';

const MODE_LABEL = { deep_work: 'deep work', networking: 'networking' };

const CAMS = [
  { key: 'library', space: 'Library', id: 'cam-library-1', mae: '/cam/mae-library.json' },
  { key: 'canteen', space: 'Student Centre', id: 'cam-canteen-1' },
];

function ago(seconds) {
  if (seconds == null) return 'never';
  if (seconds < 60) return `${seconds} s ago`;
  return `${Math.round(seconds / 60)} min ago`;
}

export default function AdminScreen({ initial }) {
  const [data, setData] = useState(initial);
  const [paused, setPaused] = useState(false);
  const [mock, setMock] = useState(initial?.source === 'mock');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cams, setCams] = useState({});
  const [mae, setMae] = useState({});
  const [camKey, setCamKey] = useState('library');
  const [camTime, setCamTime] = useState(0);
  const videoRef = useRef(null);

  useEffect(() => {
    Promise.all(
      CAMS.map((c) => fetch(`/cam/${c.key}.json`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => [c.key, d])
        .catch(() => [c.key, null])),
    ).then((pairs) => setCams(Object.fromEntries(pairs.filter(([, d]) => d))));
    Promise.all(
      CAMS.filter((c) => c.mae).map((c) => fetch(c.mae, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => [c.key, d])
        .catch(() => [c.key, null])),
    ).then((pairs) => setMae(Object.fromEntries(pairs.filter(([, d]) => d))));
  }, []);

  // Skip the empty opening seconds once both the player and the timeline exist.
  useEffect(() => {
    const first = cams[camKey]?.samples?.find((s2) => s2.people > 0);
    const v = videoRef.current;
    if (!v) return;
    if (first && v.readyState >= 1) v.currentTime = first.t;
  }, [cams, camKey]);

  useEffect(() => {
    if (paused) return undefined;
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/admin/state', { cache: 'no-store' });
        const body = await res.json();
        if (body.ok) {
          setData(body.state);
          setError('');
        } else setError(body.error || 'Admin feed unavailable');
      } catch {
        setError('Admin feed unreachable');
      }
    }, 2000);
    return () => clearInterval(id);
  }, [paused]);

  async function reset() {
    setBusy(true);
    await fetch('/api/act', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'reset_demo', payload: {} }),
    });
    setBusy(false);
    window.location.reload();
  }

  if (!data) return <p className="u4-fine">No admin data.</p>;

  const { kpis, spaces, cameras, feed, model, source } = data;
  const stale = source !== 'live';
  const cam = cams[camKey] || null;
  const activeCam = CAMS.find((c) => c.key === camKey) || CAMS[0];
  const replaying = Boolean(cam?.samples?.length);

  const sample = cam?.samples?.length
    ? cam.samples.reduce((best, s2) =>
        Math.abs(s2.t - camTime) < Math.abs(best.t - camTime) ? s2 : best, cam.samples[0])
    : null;
  const zoneOf = (label) => sample?.zones?.[label] || null;
  // When the replay is present, its sample is the camera truth; the API reading
  // may be a minute old and would contradict the picture on screen.
  const camOf = (t) => (cam ? zoneOf(t.label) : t.camera);
  const k = cam && sample
    ? {
        ...kpis,
        people: sample.people,
        cameras_live: Math.max(kpis.cameras_live, Object.keys(cams).length),
      }
    : kpis;

  const roomTables = spaces
    .filter((space) => space.name.toLowerCase().startsWith(activeCam.space.toLowerCase()))
    .flatMap((space) => space.tables);
  const detections = roomTables
    .map((t) => ({ label: t.label, ...(camOf(t) || {}) }))
    .filter((d) => (d.people || 0) > 0)
    .sort((a, b) => b.people - a.people)
    .slice(0, 6);

  return (
    <div className="a4">
      <div className="a4-kpis">
        <div className="a4-kpi">
          <b>{kpis.free} / {kpis.total}</b>
          <span>free tables · campus</span>
        </div>
        <div className="a4-kpi">
          <b>{k.people}</b>
          <span>{cam ? 'people in frame' : 'people detected'}</span>
        </div>
        <div className="a4-kpi">
          <b>{k.cameras_live} / {kpis.cameras_total}</b>
          <span>{replaying ? 'cameras replaying' : 'cameras live'}</span>
        </div>
        <div className={`a4-kpi ${kpis.alerts ? 'is-alert' : ''}`}>
          <b>{kpis.alerts}</b>
          <span>stale cameras</span>
        </div>
      </div>

      {stale && !replaying && (
        <div className="a4-banner" role="status">
          <b>{kpis.cameras_live === 0 && data.cameras.every((c) => c.age_s == null)
            ? 'No camera readings yet'
            : source === 'stale' ? 'Camera stream is stale' : 'Camera stream lost'}</b>
          <span>
            Booking data still updates every 2 s. Sensor numbers show the last camera value and are tagged stale;
            run cv/detect.py or POST /api/sensor to feed the camera.
          </span>
        </div>
      )}

      <section className="a4-hero" aria-label="Live camera">
        <header>
          <div>
            <h2>{activeCam.space}</h2>
            <p className="mono-note">
              {cam ? `${activeCam.id} · recorded replay` : 'no camera attached'}
              {' · '}conf {cam && sample ? sample.confidence.toFixed(2) : '—'}
            </p>
          </div>
          <div className="a4-cam-tabs" role="tablist" aria-label="Camera">
            {CAMS.map((c) => (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={c.key === camKey}
                className={c.key === camKey ? 'is-on' : ''}
                onClick={() => { setCamTime(0); setCamKey(c.key); }}
              >
                {c.space}
              </button>
            ))}
          </div>
          <span className={`a4-live ${stale && !replaying ? 'is-stale' : ''}`}>
            {replaying ? 'replay' : stale ? 'stale' : 'live'}
          </span>
        </header>

        <figure className="a4-feed">
          {/* recorded footage with the detector's output baked in (cv/README.md) */}
          <video
            ref={videoRef}
            key={camKey}
            src={`/cam/${camKey}.mp4`}
            autoPlay
            muted
            loop
            playsInline
            poster={`/cam/${camKey}.jpg`}
            onTimeUpdate={(e) => setCamTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => {
              const first = cam?.samples?.find((s2) => s2.people > 0);
              if (first && e.currentTarget.currentTime < 1) e.currentTarget.currentTime = first.t;
            }}
          />
          <figcaption>
            <span>{cam ? `replay · ${cam.fps} fps · loop` : 'replay · loading'}</span>
            <span>{sample ? `${sample.people}p · conf ${Number(sample.confidence).toFixed(2)}` : 'no sample'}</span>
          </figcaption>
          {!cam && <span className="a4-feed-empty">recording unavailable</span>}
        </figure>

        <div className="a4-hero-foot">
          <div className="a4-hero-badges">
            {cam?.zones_method && (
              <span className="a4-chip">zones · {cam.zones_method}</span>
            )}
            {mae[camKey] && (
              <span className="a4-chip a4-chip--mae">
                error vs annotations <b>±{Number(mae[camKey].mae_per_table).toFixed(1)}</b> p/table
                <span className="mono-note"> · {mae[camKey].samples} samples</span>
              </span>
            )}
            <span className="a4-chip">
              {model.latency}{cam ? ` · ${cam.fps} fps` : ''}
              {sample ? ` · unassigned ${sample.unassigned ?? 0}` : ''}
            </span>
          </div>
          {cam?.note && <p className="a4-feed-note">{cam.note}</p>}
        </div>
      </section>

      <div className="a4-analysis">
        <section className="a4-plan">
          <p className="mono-label">{activeCam.space} · {roomTables.length} tables · per-table count</p>
          <div className="a4-tables">
            {roomTables.map((t) => (
              <div className={`a4-table t-${t.status}`} key={t.id}>
                <b>{t.label}{camOf(t)?.id ? ` · ${camOf(t).id}` : ''}</b>
                <span>{t.capacity} seats</span>
                <span className="a4-state">
                  {t.status === 'empty' ? 'available' : t.status === 'open' ? 'open table' : t.status === 'in_use' ? 'seen occupied' : 'full'}
                </span>
                {camOf(t) && camOf(t).capacity > 0 && (
                  <span className="a4-bar" aria-hidden="true">
                    <i style={{ width: `${Math.min(100, (camOf(t).people / camOf(t).capacity) * 100)}%` }} />
                  </span>
                )}
                {camOf(t) && (
                  <span className="a4-cam">
                    {camOf(t).people}p · {camOf(t).people > 0 ? 'seen' : 'clear'}
                    {(camOf(t).over_capacity ?? (camOf(t).capacity && camOf(t).people > camOf(t).capacity))
                      ? ' · over seats' : ''}
                    {camOf(t).confidence > 0 ? ` · ${camOf(t).confidence.toFixed(2)}` : ''}
                  </span>
                )}
                {t.mode && <span className="a4-cam">{MODE_LABEL[t.mode] || t.mode}</span>}
              </div>
            ))}
          </div>
        </section>

        <section className="a4-rail">
          <p className="mono-label">detections</p>
          {detections.map((d) => (
            <div className="a4-det" key={d.label}>
              <b>person</b>
              <span>{d.label} · {d.people}p</span>
              <em>{d.confidence.toFixed(2)}</em>
            </div>
          ))}
          {detections.length === 0 && (
            <p className="u4-fine">
              {cam ? 'No person in this frame.' : 'No readings yet. POST /api/sensor or run cv/detect.py.'}
            </p>
          )}
          <p className="mono-note a4-rail-foot">
            conf ≥ 0.35 · {model.latency}
            {cam ? ` · ${cam.fps} fps` : ''}
            {sample ? ` · unassigned ${sample.unassigned ?? 0}` : ''}
          </p>
        </section>
      </div>

      <div className="a4-side">
        <section className="a4-panel">
          <p className="mono-label">pipeline</p>
          <dl className="u4-kv">
            <dt>model</dt><dd>{model.name}</dd>
            <dt>input</dt><dd>{model.input}</dd>
            <dt>latency</dt><dd>{model.latency}</dd>
            <dt>val mAP50</dt><dd>{model.map50} · recall {model.recall}</dd>
            <dt>last frame</dt><dd>{ago(cameras.find((c) => c.age_s != null)?.age_s)}</dd>
          </dl>
        </section>

        <section className="a4-panel">
          <p className="mono-label">controls</p>
          <div className="u4-seg" role="group" aria-label="Source">
            <button type="button" className={!mock ? 'is-on' : ''} onClick={() => setMock(false)}>live</button>
            <button type="button" className={mock ? 'is-on' : ''} onClick={() => setMock(true)}>mock</button>
          </div>
          <div className="a4-controls">
            <button type="button" onClick={() => setPaused((v) => !v)}>
              {paused ? 'Resume feed' : 'Pause feed'}
            </button>
            <button type="button" onClick={reset} disabled={busy}>
              {busy ? 'Resetting…' : 'Reset demo'}
            </button>
          </div>
          {mock && <p className="u4-fine">Mock source: numbers come from bookings only. Nothing here is labelled live.</p>}
          {error && <p className="u4-fine" role="alert">{error}</p>}
        </section>

        <section className="a4-panel">
          <p className="mono-label">coverage</p>
          {cameras.map((c) => {
            const match = CAMS.find((k2) => c.space.toLowerCase().startsWith(k2.space.toLowerCase()));
            const replayHere = Boolean(match && cams[match.key]);
            const up = replayHere || c.status === 'live';
            return (
              <div className="a4-cam-row" key={c.space}>
                <i className={up ? 'is-on' : ''} aria-hidden="true" />
                <div>
                  <b>{c.space}</b>
                  <span className="mono-note">
                    {replayHere ? `${match.id} · recorded replay` : c.id || 'no camera installed'}
                  </span>
                </div>
                <em>{replayHere ? 'replay' : c.status}</em>
              </div>
            );
          })}
        </section>
      </div>

      <section className="a4-log">
        <header>
          <p className="mono-label">event log · today</p>
          <span className="mono-note">derived from bookings, check-ins, points and sensor reads</span>
        </header>
        {feed.length === 0 && <p className="u4-fine">No events yet. Reset the demo to repopulate.</p>}
        {feed.slice(0, 4).map((e, i) => (
          <div className="a4-log-row" key={`${e.at}-${i}`}>
            <time>{e.clock}</time>
            <span className="mono-note">{e.who}</span>
            <p>{e.text}</p>
            <i className={`t-${e.tone}`} aria-hidden="true" />
          </div>
        ))}
      </section>
    </div>
  );
}
