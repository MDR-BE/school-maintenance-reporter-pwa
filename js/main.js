// main.js - Main entry point for the Maintenance PWA (ES Module)

import { hasValidAuthToken, requireAuth } from './auth.js';

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./js/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registered:', registration.scope);
      })
      .catch(error => {
        console.log('ServiceWorker registration failed:', error);
      });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const staffBtn = document.getElementById('staff-btn');
  const workerBtn = document.getElementById('worker-btn');

  if (staffBtn) {
    staffBtn.addEventListener('click', () => {
      window.location.href = './staff.html';
    });
  }

  if (workerBtn) {
    workerBtn.addEventListener('click', () => {
      window.location.href = './worker.html';
    });
  }

  // Check if the app is installed in standalone mode (PWA)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    // App is running as a standalone PWA
    document.documentElement.classList.add('standalone');
  }
  
  // For index.html, we don't require auth - user chooses role first
  // Auth is required on staff.html and worker.html
});