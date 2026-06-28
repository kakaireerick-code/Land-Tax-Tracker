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
    let fallbackTimer = 0;
    let finished = false;

    const dismiss = () => {
      if (cancelled || finished) return;
      finished = true;

      const remaining = Math.max(0, MIN_LOAD_MS - (performance.now() - startedRef.current));
      fadeTimer = window.setTimeout(() => {
        if (cancelled) return;
        setFading(true);
        hideTimer = window.setTimeout(() => {
          if (!cancelled) setLoading(false);
        }, FADE_MS);
      }, remaining);
    };

    // DOMContentLoaded is enough — do not wait for every subresource (images, tiles, etc.)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', dismiss, { once: true });
    } else {
      dismiss();
    }

    // Never block the app indefinitely if an event is missed (e.g. StrictMode remount)
    fallbackTimer = window.setTimeout(dismiss, MAX_LOAD_MS);

    return () => {
      cancelled = true;
      document.removeEventListener('DOMContentLoaded', dismiss);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  return (
    <>
      {loading && <LoadingScreen fading={fading} />}
      <div
        style={{
          visibility: loading ? 'hidden' : 'visible',
          minHeight: '100vh',
        }}
        aria-hidden={loading}
      >
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </div>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRoot />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
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
