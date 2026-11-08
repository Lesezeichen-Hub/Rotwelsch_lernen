import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';

const template = await readFile(new URL('../../tools/sw-template.js', import.meta.url), 'utf8');

async function install({ status = 200, failures = 0, corrupt = false, existing = false } = {}) {
  const scope = 'https://localhost/modules/7/';
  const bytes = 'body';
  const manifest = { version: 'test', assets: ['css/app.css'], digests: { 'css/app.css': corrupt ? 'bad' : createHash('sha256').update(bytes).digest('hex') } };
  const stores = new Map();
  const messages = [];
  const handlers = {};
  let calls = 0;
  const key = request => String(request.url || request);
  const cacheName = `rotwelsch:${scope}:test`;
  if (existing) stores.set(cacheName, new Map([[scope + 'index.html', new Response('old version')]]));
  const caches = {
    has: async name => stores.has(name),
    delete: async name => stores.delete(name),
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return { put: async (request, response) => store.set(key(request), response.clone()), keys: async () => [...store.keys()], match: async request => store.get(key(request))?.clone() };
    },
  };
  const context = vm.createContext({
    self: { registration: { scope, active: existing }, addEventListener: (name, handler) => { handlers[name] = handler; }, skipWaiting: async () => {}, clients: { matchAll: async () => [{ url: scope + 'index.html', postMessage: message => messages.push(message) }, { url: 'https://localhost/other/', postMessage: () => assert.fail('Fremdes Modul erhält Fehlermeldung') }] } },
    caches, crypto: webcrypto, AbortSignal, URL, Response, Uint8Array,
    fetch: async url => {
      if (String(url).endsWith('precache.json')) return Response.json(manifest);
      calls++;
      if (calls <= failures) throw new TypeError('Connection reset');
      return new Response(bytes, { status });
    },
  });
  vm.runInContext(template.replace('__BUILD_VERSION__', 'test'), context);
  let promise;
  handlers.install({ waitUntil: value => { promise = value; } });
  let error;
  try { await promise; } catch (failure) { error = failure; }
  return { stores, messages, calls, error, cacheName, scope };
}

test('Offlineinstallation wiederholt vorübergehende Downloadfehler', async () => {
  const result = await install({ failures: 1 });
  assert.equal(result.calls, 2);
  assert.equal(result.error, undefined);
  assert.ok(result.stores.has(result.cacheName));
  assert.ok(!result.stores.has(result.cacheName + ':install'));
});

test('Dauerhafter Downloadfehler meldet konkrete Datei und lässt alten Cache bestehen', async () => {
  const result = await install({ failures: 3, existing: true });
  assert.equal(result.calls, 3);
  assert.match(result.messages[0].message, /css\/app.css/);
  assert.equal(await result.stores.get(result.cacheName).get(result.scope + 'index.html').text(), 'old version');
  assert.ok(!result.stores.has(result.cacheName + ':install'));
});

test('Fehlende Datei und falsche Prüfsumme werden nicht als Offlinebereitschaft ausgegeben', async () => {
  const missing = await install({ status: 404 });
  assert.equal(missing.calls, 1);
  assert.match(missing.messages[0].message, /HTTP 404/);
  assert.ok(!missing.stores.has(missing.cacheName));
  const corrupt = await install({ corrupt: true });
  assert.match(corrupt.messages[0].message, /Prüfsumme.*css\/app.css/);
  assert.ok(!corrupt.stores.has(corrupt.cacheName));
});