// Service Worker for School Maintenance PWA
const CACHE_NAME = 'maintenance-pwa-v3';
const urlsToCache = [
  './',
  './index.html',
  './staff.html',
  './worker.html',
  './css/styles.css',
  './js/main.js',
  './js/staff.js',
  './js/worker.js',
  './js/utils.js',
  './js/api.js',
  './js/auth.js',
  './manifest.json'
];

// Apps Script URL pattern - exclude from caching
const API_URL_PATTERN = /script\.google\.com\/macros\/s\/.*\/exec/;

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip non-GET requests (POST, PUT, DELETE, etc.)
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip API requests - never cache API responses
  if (API_URL_PATTERN.test(event.request.url)) {
    // Network only for API requests
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Network-first for HTML/JS/CSS files to avoid stale code
  const isHtmlOrJsOrCss = event.request.destination === 'document' || 
                          event.request.destination === 'script' ||
                          event.request.destination === 'style';
  
  if (isHtmlOrJsOrCss) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // Cache-first for other assets (images, fonts, etc.)
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached response if found
        if (response) {
          return response;
        }
        // Otherwise, fetch from network
        return fetch(event.request);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});