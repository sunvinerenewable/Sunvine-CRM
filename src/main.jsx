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
    console.warn('[Vite] Preload chunk error caught. Auto-reloading application...');
    window.location.reload();
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
