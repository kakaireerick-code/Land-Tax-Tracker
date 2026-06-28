import { StrictMode, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { hideHtmlSplash, LoadingScreen } from './components/LoadingScreen.tsx';
import './index.css';

const MIN_LOAD_MS = 2000;
const FADE_MS = 500;
let loadTimerStarted = false;

function AppRoot() {
  const [loading, setLoading] = useState(true);
  const [fading, setFading] = useState(false);
  const startedRef = useRef(performance.now());
  const doneRef = useRef(false);

  useLayoutEffect(() => {
    hideHtmlSplash();
  }, []);

  useLayoutEffect(() => {
    if (loadTimerStarted) return;
    loadTimerStarted = true;

    if (doneRef.current) return;

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      const remaining = Math.max(0, MIN_LOAD_MS - (performance.now() - startedRef.current));
      window.setTimeout(() => {
        setFading(true);
        window.setTimeout(() => setLoading(false), FADE_MS);
      }, remaining);
    };

    if (document.readyState === 'complete') {
      finish();
    } else {
      window.addEventListener('load', finish, { once: true });
      return () => window.removeEventListener('load', finish);
    }
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
