const VERSION = '__BUILD_VERSION__';
const PREFIX = `rotwelsch:${self.registration.scope}:`;
const CACHE = PREFIX + VERSION;

self.addEventListener('install', event => event.waitUntil((async () => {
  try {
    const response = await fetch(new URL('assets/precache.json', self.registration.scope), { cache: 'no-store' });
    if (!response.ok) throw new Error('Cachemanifest fehlt');
    const manifest = await response.json();
    if (manifest.version !== VERSION) throw new Error('Buildversion passt nicht');
    const cache = await caches.open(CACHE);
    for (const asset of manifest.assets) {
      const url = new URL(asset, self.registration.scope);
      const result = await fetch(url, { cache: 'no-store' });
      if (!result.ok) throw new Error(`Datei fehlt: ${asset}`);
      const bytes = await result.clone().arrayBuffer();
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
      if (hash !== manifest.digests[asset]) throw new Error(`Datei verändert: ${asset}`);
      await cache.put(url, result);
    }
    if (!self.registration.active) await self.skipWaiting();
  } catch (error) {
    await caches.delete(CACHE);
    throw error;
  }
})()));

self.addEventListener('message', event => {
  if (event.data === 'ACTIVATE') self.skipWaiting();
});

self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const canonical = new URL(url);
    canonical.search = '';
    if (canonical.href === self.registration.scope) canonical.pathname += 'index.html';
    const cached = await cache.match(canonical);
    if (cached) return cached;
    try { return await fetch(event.request); }
    catch { return new Response('Diese Ressource ist nicht offline verfügbar.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
  })());
});