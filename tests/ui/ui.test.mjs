import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startServer } from '../../tools/serve.mjs';
import { readFile } from 'node:fs/promises';
import { assembleData } from '../../js/data.js';

const load = async name => JSON.parse(await readFile(new URL(`../../data/${name}.json`, import.meta.url), 'utf8'));
const data = assembleData(await load('dictionary'), await load('sources'), await load('lessons'), await load('texts'));
const entryById = id => data.entries.find(entry => entry.id === id);

let running = await startServer();
const browser = await chromium.launch({ headless: true });
const output = new URL('./output/', import.meta.url);
await mkdir(output, { recursive: true });
try {
  for (const prefix of ['/', '/modules/7/']) {
    if (!running) running = await startServer();
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'allow' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('Browserfehler:', error.message); });
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) console.log('Navigation:', new URL(frame.url()).pathname + new URL(frame.url()).hash); });
    await page.goto(running.url + prefix + 'index.html');
    await page.getByRole('heading', { name: 'Mein Lernplatz', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Wörterbuch', exact: true }).click();
    await page.getByRole('searchbox').fill('Kohldampf');
    await page.getByRole('button', { name: 'Kohldampf', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    assert.match(await page.getByRole('dialog').textContent(), /Hunger/);
    await page.getByRole('button', { name: 'Schließen', exact: true }).click();
    await page.getByRole('link', { name: 'Mein Lernplatz', exact: true }).click();
    await page.getByRole('heading', { name: 'Mein Lernplatz', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Karten lernen', exact: true }).click();
    await page.getByRole('button', { name: 'Antwort zeigen' }).click();
    await page.locator('[data-rating="3"]').click();
    await page.waitForFunction(() => document.querySelector('.page-heading')?.textContent.includes('2 / 10'));
    await page.reload();
    await page.getByRole('heading', { name: 'Karten lernen', exact: true }).waitFor();
    assert.match(await page.locator('.page-heading').textContent(), /2 \/ 10/);
    await page.getByRole('button', { name: 'Sitzung pausieren' }).click();
    await page.getByRole('heading', { name: 'Mein Lernplatz', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Lehrgang', exact: true }).click();
    await page.getByRole('button', { name: 'Lektion öffnen: Erste Wörter, erste Unterschiede', exact: true }).click();
    await page.getByRole('button', { name: 'Abschlussprüfung starten' }).click();
    await page.getByRole('button', { name: 'Ein besonderer Wortschatz', exact: true }).click();
    await page.getByRole('button', { name: 'Weiter', exact: true }).click();
    for (const id of data.lessons[0].entries) {
      const entry = entryById(id);
      await page.getByRole('button', { name: entry.meaning, exact: true }).click();
      await page.getByRole('button', { name: id === data.lessons[0].entries.at(-1) ? 'Ergebnis ansehen' : 'Weiter', exact: true }).click();
    }
    await page.getByRole('heading', { name: 'Übung abgeschlossen' }).waitFor();
    assert.match(await page.locator('main').textContent(), /100%/);
    await page.getByRole('button', { name: 'Zurück', exact: true }).click();
    await page.getByRole('link', { name: 'Texte', exact: true }).click();
    await page.getByRole('button', { name: 'Text öffnen: Am Tisch', exact: true }).click();
    await page.locator('.text-body').getByRole('button', { name: 'Lehem', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: 'Schließen', exact: true }).click();
    await page.getByRole('textbox', { name: 'Deine Antwort', exact: true }).fill('Brot und ein Ei; Wasser.');
    await page.getByRole('button', { name: 'Antwort speichern', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#notification')?.textContent === 'Antwort gespeichert.');
    await page.reload();
    assert.equal(await page.getByRole('textbox', { name: 'Deine Antwort', exact: true }).inputValue(), 'Brot und ein Ei; Wasser.');
    for (const mode of ['Bedeutung wählen', 'Wörter schreiben', 'Originalbeleg ergänzen']) {
      await page.getByRole('link', { name: 'Spiele', exact: true }).click();
      await page.getByLabel('Wortschatz', { exact: true }).selectOption('current');
      await page.getByLabel('Richtung', { exact: true }).selectOption('rw-de');
      await page.locator('.game-item').filter({ has: page.getByRole('heading', { name: mode, exact: true }) }).getByRole('button', { name: 'Starten' }).click();
      for (;;) {
        const question = page.locator('h2[data-entry-id]');
        await question.waitFor();
        const entry = entryById(await question.getAttribute('data-entry-id'));
        if (mode === 'Bedeutung wählen') await page.getByRole('button', { name: entry.meaning, exact: true }).click();
        else {
          await page.getByRole('textbox', { name: 'Antwort eingeben' }).fill(mode === 'Originalbeleg ergänzen' ? entry.word : entry.meaning);
          await page.getByRole('button', { name: 'Antwort prüfen', exact: true }).click();
        }
        const end = page.getByRole('button', { name: 'Ergebnis ansehen', exact: true });
        if (await end.count()) { await end.click(); break; }
        await page.getByRole('button', { name: 'Weiter', exact: true }).click();
      }
      await page.getByRole('heading', { name: 'Übung abgeschlossen' }).waitFor();
      assert.match(await page.locator('main').textContent(), /100%/);
    }
    await page.getByRole('link', { name: 'Spiele', exact: true }).click();
    await page.locator('.game-item').filter({ has: page.getByRole('heading', { name: 'Paare finden', exact: true }) }).getByRole('button', { name: 'Starten' }).click();
    const pairIds = await page.locator('.matching-column').first().locator('button').evaluateAll(elements => elements.map(element => element.dataset.id));
    for (const id of pairIds) {
      await page.locator('.matching-column').first().locator(`[data-id="${id}"]`).click();
      await page.locator('.matching-column').last().locator(`[data-id="${id}"]`).click();
      await page.waitForFunction(id => document.querySelector(`.matching-column:last-child [data-id="${id}"]`).disabled, id);
    }
    await page.getByRole('button', { name: 'Neue Runde' }).waitFor();
    await page.getByRole('link', { name: 'Einstellungen', exact: true }).click();
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Sicherung exportieren', exact: true }).click();
    const backupDownload = await downloadEvent;
    const backupPath = await backupDownload.path();
    const backup = JSON.parse(await readFile(backupPath, 'utf8'));
    assert.equal(backup.profiles[0].reviews.length, 1);
    assert.equal(backup.profiles[0].lessons.grundlagen.score, 100);
    await page.getByRole('button', { name: 'Farbschema wechseln' }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.getByRole('button', { name: 'Farbschema wechseln' }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await page.getByRole('textbox', { name: 'Neuer Lernplatz', exact: true }).fill('Zweiter Lernplatz');
    await page.getByRole('button', { name: 'Anlegen', exact: true }).click();
    await page.getByLabel('Lernplatz', { exact: true }).selectOption({ label: 'Mein Lernplatz' });
    await page.getByRole('heading', { name: 'Einstellungen & Sicherung', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Lernstand-Sicherung auswählen' }).count();
    await page.getByLabel('Lernstand-Sicherung auswählen', { exact: true }).setInputFiles(backupPath);
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: 'Zusammenführen', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.querySelector('#offline-state')?.textContent === 'Offline bereit');
    const scope = running.url + prefix;
    await page.evaluate(async scope => { const foreign = await caches.open('anderes-hub-modul'); await foreign.put(scope + 'foreign-marker', new Response('behalten')); }, scope);
    await running.close();
    await context.setOffline(true);
    await page.reload();
    await page.getByRole('heading', { name: 'Einstellungen & Sicherung', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Wörterbuch', exact: true }).click();
    await page.getByRole('searchbox').fill('Flebbe');
    assert.ok(await page.getByRole('button', { name: 'Flebbe', exact: true }).count());
    const responseStatus = await page.evaluate(async scope => ({ missing: (await fetch(scope + 'missing.json')).status, foreign: await caches.has('anderes-hub-modul') }), scope);
    assert.equal(responseStatus.missing, 503);
    assert.equal(responseStatus.foreign, true);
    await page.getByRole('link', { name: 'Mein Lernplatz', exact: true }).click();
    await page.getByRole('heading', { name: 'Mein Lernplatz', exact: true }).waitFor();
    await page.screenshot({ path: new URL(prefix === '/' ? 'desktop.png' : 'hub.png', output).pathname.replace(/^\/(?=[A-Z]:)/, ''), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: new URL(prefix === '/' ? 'mobile.png' : 'hub-mobile.png', output).pathname.replace(/^\/(?=[A-Z]:)/, ''), fullPage: true });
    await page.setViewportSize({ width: 320, height: 740 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    assert.deepEqual(errors, []);
    await context.close();
    running = null;
    console.log(`Browsercheck bestanden: ${prefix}`);
  }
} finally {
  await browser.close();
  if (running) await running.close();
}