const CACHE_NAME = 'sat-sprint-shell-v1';
const APP_SHELL = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/js/audio.js',
    '/js/config.js',
    '/js/highScores.js',
    '/js/satSprint.js',
    '/js/installApp.js',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-512.png',
    '/icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('sat-sprint-') && key !== CACHE_NAME).map(key => caches.delete(key))))
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

    if (request.mode === 'navigate') {
        event.respondWith(fetch(request).then(response => {
            if (response.ok) {
                const copy = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
            }
            return response;
        }).catch(async () => (await caches.match('/index.html')) || (await caches.match('/'))));
        return;
    }

    event.respondWith(fetch(request).then(response => {
        if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
    }).catch(async () => (await caches.match(request)) || Response.error()));
});
