import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { initCrashReporter } from './services/crashReporter.js';

// Initialize Slack Crash Reporter for unhandled runtime exceptions & unhandled promises
initCrashReporter();
// Auto-recover from outdated chunks on new deployment without error boundary popup
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    if (typeof event?.preventDefault === 'function') {
      event.preventDefault();
    }
    const attemptKey = 'sunvine_preload_attempt';
    const attempts = Number(sessionStorage.getItem(attemptKey) || 0);
    if (attempts < 1) {
      sessionStorage.setItem(attemptKey, '1');
      console.warn('[Vite] Preload chunk error caught. Refreshing application...');
      if ('caches' in window) {
        caches.keys().then(names => names.forEach(n => caches.delete(n))).catch(() => {});
      }
      window.location.reload();
    }
  });

  window.addEventListener('load', () => {
    registerSW({ immediate: true });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
