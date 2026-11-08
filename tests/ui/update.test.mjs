import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from '../../tools/serve.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = await mkdtemp(path.join(os.tmpdir(), 'rotwelsch-offline-test-'));
let running;
let browser;
try {
  for (const filename of ['index.html', 'manifest.webmanifest', 'assets', 'css', 'data', 'js', 'sw.js']) await cp(path.join(root, filename), path.join(fixture, filename), { recursive: true });
  const template = await readFile(path.join(root, 'tools/sw-template.js'), 'utf8');
  const original = JSON.parse(await readFile(path.join(fixture, 'data/dictionary.json'), 'utf8'));
  async function rebuild(version, corrupt = false) {
    await writeFile(path.join(fixture, 'data/dictionary.json'), JSON.stringify({ ...original, version }));
    const manifest = JSON.parse(await readFile(path.join(fixture, 'assets/precache.json'), 'utf8'));
    for (const asset of manifest.assets) manifest.digests[asset] = createHash('sha256').update(await readFile(path.join(fixture, asset))).digest('hex');
    manifest.version = createHash('sha256').update(JSON.stringify(manifest.digests)).digest('hex').slice(0, 16);
    if (corrupt) manifest.digests['data/dictionary.json'] = 'invalid-hash';
    await writeFile(path.join(fixture, 'assets/precache.json'), JSON.stringify(manifest));
    await writeFile(path.join(fixture, 'sw.js'), template.replace('__BUILD_VERSION__', manifest.version));
    return manifest.version;
  }
  running = await startServer({ root: fixture });
  browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();
  const missingAsset = 'assets/sources/kluge-p440.jpg';
  await rm(path.join(fixture, missingAsset));
  await page.goto(running.url + '/modules/12/index.html');
  await page.getByRole('heading', { name: 'Mein Lernplatz', exact: true }).waitFor();
  await page.waitForFunction(asset => document.querySelector('#notification')?.textContent.includes(asset), missingAsset);
  assert.match(await page.locator('#notification').textContent(), /HTTP 404/);
  await page.getByRole('button', { name: 'Karten lernen', exact: true }).click();
  await page.getByRole('button', { name: 'Antwort zeigen', exact: true }).click();
  await page.locator('[data-rating="3"]').click();
  await page.waitForFunction(() => document.querySelector('.page-heading')?.textContent.includes('2 / 10'));
  await cp(path.join(root, missingAsset), path.join(fixture, missingAsset));
  await page.getByRole('button', { name: 'Erneut versuchen', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#offline-state')?.textContent === 'Offline bereit');
  assert.match(await page.locator('.page-heading').textContent(), /2 \/ 10/);
  assert.equal(await page.getByRole('button', { name: 'Erneut versuchen', exact: true }).count(), 0);
  console.log('Erstinstallationsprüfung bestanden: konkrete fehlende Datei gemeldet, Wiederholung erfolgreich, Lernstand erhalten.');
  const url = running.url + '/modules/13/index.html';
  await page.goto(url);
  await page.getByRole('heading', { name: 'Mein Lernplatz', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('#offline-state')?.textContent === 'Offline bereit');
  await page.getByRole('button', { name: 'Karten lernen', exact: true }).click();
  await page.getByRole('button', { name: 'Antwort zeigen', exact: true }).waitFor();
  const goodVersion = await rebuild('1.1.0-update-test');
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await page.getByRole('button', { name: 'Aktualisierung laden', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Aktualisierung laden', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#notification')?.textContent.includes('Lernsitzung erst abschließen'));
  assert.ok(await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting)));
  for (let index = 0; index < 10; index++) {
    await page.getByRole('button', { name: 'Antwort zeigen', exact: true }).click();
    await page.locator('[data-rating="3"]').click();
    if (index < 9) await page.waitForFunction(number => document.querySelector('.page-heading')?.textContent.includes(`${number} / 10`), index + 2);
  }
  await page.getByRole('heading', { name: 'Sitzung abgeschlossen', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Zum Lernplatz', exact: true }).click();
  await page.getByRole('heading', { name: 'Mein Lernplatz', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Aktualisierung laden', exact: true }).click();
  await page.waitForFunction(async expected => (await (await fetch('./data/dictionary.json')).json()).version === expected, '1.1.0-update-test');
  await page.getByRole('heading', { name: 'Mein Lernplatz', exact: true }).waitFor();
  const cacheNames = await page.evaluate(() => caches.keys());
  assert.ok(cacheNames.some(name => name.endsWith(goodVersion)));
  assert.equal(await page.locator('.metric').last().locator('strong').textContent(), '10');
  const brokenVersion = await rebuild('1.1.0-broken-update', true);
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    window.brokenUpdateFinished = false;
    registration.addEventListener('updatefound', () => {
      registration.installing?.addEventListener('statechange', event => {
        if (event.target.state === 'redundant') window.brokenUpdateFinished = true;
      });
    });
    await registration.update();
  });
  await page.waitForFunction(() => window.brokenUpdateFinished);
  assert.ok(!(await page.evaluate(() => caches.keys())).some(name => name.endsWith(brokenVersion)));
  await running.close();
  running = null;
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('heading', { name: 'Mein Lernplatz', exact: true }).waitFor();
  assert.equal(await page.locator('.metric').last().locator('strong').textContent(), '10');
  assert.equal(await page.evaluate(async () => (await (await fetch('./data/dictionary.json')).json()).version), '1.1.0-update-test');
  console.log('Updateprüfung bestanden: laufende Sitzung geschützt, Lernstand erhalten, defektes Update verworfen, Offline-Neustart ohne Server.');
  await context.close();
} finally {
  await browser?.close();
  if (running) await running.close();
  await rm(fixture, { recursive: true, force: true });
}