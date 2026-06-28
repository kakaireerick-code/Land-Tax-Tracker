import { StrictMode, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { hideHtmlSplash, LoadingScreen } from './components/LoadingScreen.tsx';
import './index.css';

const MIN_LOAD_MS = 1600;
const FADE_MS = 450;
const MAX_LOAD_MS = 6000;

function AppRoot() {
  const [loading, setLoading] = useState(true);
  const [fading, setFading] = useState(false);
  const startedRef = useRef(performance.now());

  useLayoutEffect(() => {
    hideHtmlSplash();

    let cancelled = false;
    let fadeTimer = 0;
    let hideTimer = 0;

    const dismiss = () => {
      if (cancelled) return;
      const remaining = Math.max(0, MIN_LOAD_MS - (performance.now() - startedRef.current));
      fadeTimer = window.setTimeout(() => {
        if (cancelled) return;
        setFading(true);
        hideTimer = window.setTimeout(() => {
          if (!cancelled) setLoading(false);
        }, FADE_MS);
      }, remaining);
    };

    dismiss();
    const fallbackTimer = window.setTimeout(dismiss, MAX_LOAD_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  return (
    <>
      {loading && <LoadingScreen fading={fading} />}
      <ErrorBoundary>
        <div
          style={{
            visibility: loading ? 'hidden' : 'visible',
            minHeight: '100vh',
          }}
          aria-hidden={loading}
        >
          <App />
        </div>
      </ErrorBoundary>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    // Dev HMR breaks when a service worker caches module responses
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => void r.unregister());
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('SW registered successfully');
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' &&
                  navigator.serviceWorker.controller) {
                console.log('New version available');
              }
            });
          });
        })
        .catch((error) => {
          console.log('SW registration failed:', error);
        });
    });
  }
}
