const VERSION = '8be99b69007abdba';
const PREFIX = `rotwelsch:${self.registration.scope}:`;
const CACHE = PREFIX + VERSION;

async function fetchOfflineFile(url, filename) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
    } catch (error) {
      lastError = new Error(`Download fehlgeschlagen: ${filename} (${error.name === 'TimeoutError' ? 'Zeitüberschreitung' : error.message})`);
      continue;
    }
    if (response.ok) return response;
    lastError = new Error(`Download fehlgeschlagen: ${filename} (HTTP ${response.status})`);
    if (![408, 429].includes(response.status) && response.status < 500) throw lastError;
  }
  throw lastError;
}

async function checkOfflineData(response, asset) {
  if (!['data/dictionary.json', 'data/sources.json', 'data/lessons.json', 'data/texts.json'].includes(asset)) return;
  let data;
  try { data = await response.clone().json(); }
  catch { throw new Error(`Inhaltsdatei ist kein lesbares JSON: ${asset}`); }
  const valid = asset === 'data/dictionary.json'
    ? data && typeof data.version === 'string' && Array.isArray(data.historical) && Array.isArray(data.secondary) && (!data.collections || Array.isArray(data.collections)) && data.currentReferences && typeof data.currentReferences === 'object' && !Array.isArray(data.currentReferences)
    : Array.isArray(data) && data.length > 0;
  if (!valid) throw new Error(`Inhaltsdatei hat eine ungültige Grundstruktur: ${asset}`);
}

self.addEventListener('install', event => event.waitUntil((async () => {
  const stagingName = CACHE + ':install';
  const existingCache = await caches.has(CACHE);
  try {
    const response = await fetchOfflineFile(new URL('assets/precache.json', self.registration.scope), 'assets/precache.json');
    const manifest = await response.json();
    if (manifest.version !== VERSION) throw new Error('Versionskonflikt zwischen sw.js und assets/precache.json. Build abschließen und Seite neu laden.');
    if (!Array.isArray(manifest.assets) || !manifest.assets.length) throw new Error('Die Offline-Dateiliste fehlt.');
    await caches.delete(stagingName);
    const staging = await caches.open(stagingName);
    for (const asset of manifest.assets) {
      const url = new URL(asset, self.registration.scope);
      const result = await fetchOfflineFile(url, asset);
      await checkOfflineData(result, asset);
      await staging.put(url, result);
    }
    const cache = await caches.open(CACHE);
    for (const request of await staging.keys()) await cache.put(request, await staging.match(request));
    await caches.delete(stagingName);
    if (!self.registration.active) await self.skipWaiting();
  } catch (error) {
    await caches.delete(stagingName);
    if (!existingCache) await caches.delete(CACHE);
    const message = error.name === 'QuotaExceededError' ? 'Browser-Speicher voll. Lernstand sichern und freien Speicher schaffen.' : error.message;
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) if (client.url.startsWith(self.registration.scope)) client.postMessage({ type: 'OFFLINE_ERROR', message });
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