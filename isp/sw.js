/* IS Teaching Timetable — service worker.
   Lets the tool install as an app on a phone or on Windows and keep working offline.
   Still a plain static site: this file only caches the files the page already loads; nothing is uploaded.
   Online, the network always wins (so the ?v= cache tag keeps working); offline, the cached copy is served. */
'use strict';
var TAG = '20261031a';                 // bump together with the cache tag in index.html
var CACHE = 'isp-' + TAG;
var START = new URL('./', self.location).href;
var SHELL = [
  './', 'index.html?v=' + TAG,
  'styles.css?v=' + TAG,
  'i18n.js?v=' + TAG, 'defaults.js?v=' + TAG, 'engine.js?v=' + TAG, 'export.js?v=' + TAG, 'app.js?v=' + TAG,
  'vendor/jszip.min.js', 'vendor/exceljs.min.js',
  'manifest.webmanifest?v=' + TAG,
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable.png', 'icons/icon.svg',
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // add each on its own so one missing file does not abort the install
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function put(req, res) {
  if (!res) return;
  caches.open(CACHE).then(function (c) { c.put(req, res).catch(function () {}); }).catch(function () {});
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var sameOrigin = new URL(req.url).origin === self.location.origin;
  if (req.mode === 'navigate') {
    // the page itself: fresh when online, the saved page when offline
    e.respondWith(fetch(req).then(function (r) { put(req, r.clone()); return r; })
      .catch(function () { return caches.match(req).then(function (m) { return m || caches.match(START); }); }));
    return;
  }
  if (sameOrigin) {
    // app files: network first so a new ?v= always wins; cache is the offline fallback
    e.respondWith(fetch(req).then(function (r) { if (r && r.ok) put(req, r.clone()); return r; })
      .catch(function () { return caches.match(req); }));
  } else {
    // fonts and other cross-origin files: cache first (they do not change)
    e.respondWith(caches.match(req).then(function (m) {
      return m || fetch(req).then(function (r) { put(req, r.clone()); return r; }).catch(function () { return m; });
    }));
  }
});
