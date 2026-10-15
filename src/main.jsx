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
    const sessionKey = 'sunvine_preload_reload';
    const lastReload = sessionStorage.getItem(sessionKey);
    const now = Date.now();
    if (!lastReload || (now - Number(lastReload) > 15000)) {
      sessionStorage.setItem(sessionKey, String(now));
      window.location.reload();
    } else {
      console.warn('[Vite] Chunk preload error repeated within 15s, skipping reload.');
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
