import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { UgandaCoatOfArms } from './UgandaCoatOfArms';

const STATUS_MESSAGES = [
  'Initializing platform…',
  'Loading enforcement data…',
  'Preparing dashboard…',
  'Securing session…',
];

type LoadingScreenProps = {
  fading?: boolean;
};

export function LoadingScreen({ fading = false }: LoadingScreenProps) {
  const [progress, setProgress] = useState(8);
  const [statusIndex, setStatusIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const progressTimer = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p;
        const step = p < 40 ? 4 : p < 75 ? 2.5 : 0.8;
        return Math.min(p + step, 92);
      });
    }, 80);

    const statusTimer = window.setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 900);

    return () => {
      window.clearInterval(progressTimer);
      window.clearInterval(statusTimer);
    };
  }, []);

  useEffect(() => {
    if (fading) setProgress(100);
  }, [fading]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`ultt-loading-screen ${fading ? 'ultt-loading-screen--exit' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Loading Uganda Land Tax Tracker"
    >
      <div className="ultt-loading-stripes" aria-hidden="true">
        <span /><span /><span /><span /><span /><span />
      </div>

      <div className="ultt-loading-content">
        <div className="ultt-loading-emblem">
          <UgandaCoatOfArms size={96} className="ultt-loading-flag" />
          <div className="ultt-loading-ring" aria-hidden="true" />
        </div>

        <h1 className="ultt-loading-title">Uganda Land Tax Tracker</h1>
        <p className="ultt-loading-subtitle">Official Enforcement Platform</p>

        <div className="ultt-loading-badge">ULTT</div>

        <div className="ultt-loading-bar-track">
          <div
            className="ultt-loading-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="ultt-loading-status">{STATUS_MESSAGES[statusIndex]}</p>
      </div>

      <p className="ultt-loading-footer">Republic of Uganda · Local Governments Rating Act 2005</p>
    </div>,
    document.body,
  );
}

export function hideHtmlSplash() {
  const splash = document.getElementById('ultt-splash');
  if (!splash) return;
  splash.classList.add('ultt-splash--hide');
  window.setTimeout(() => splash.remove(), 450);
}
