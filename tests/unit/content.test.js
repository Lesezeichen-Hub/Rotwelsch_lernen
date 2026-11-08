import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assembleData } from '../../js/data.js';
import { validateContent, accepts } from '../../js/content.js';

const load = async name => JSON.parse(await readFile(new URL(`../../data/${name}.json`, import.meta.url), 'utf8'));

test('Zusätzliche Originalsammlungen behalten Quelle, Region, Zeit und Varianten', () => {
  const raw = { version: 'test', historical: [], secondary: [], currentReferences: {}, collections: [{ source: 'kluge-1901', title: 'Oberhessen', period: '1885', region: 'Oberhessen', note: 'Quellenfassung', entries: [['hessen-dippeln', 'dippeln', 'wandern', 'Unterwegs', 422, 'dippeln, dappeln wandern.', [], ['dappeln']]] }] };
  const result = assembleData(raw, [], [], []);
  assert.equal(result.entries[0].period, '1885');
  assert.equal(result.entries[0].region, 'Oberhessen');
  assert.deepEqual(result.entries[0].variants, ['dappeln']);
  assert.equal(result.entries[0].scan, './assets/sources/kluge-p422.jpg');
});

test('Releasebestand hat eindeutige IDs, Quellen, lokale Scans und gültige Übungsverweise', async () => {
  const content = assembleData(await load('dictionary'), await load('sources'), await load('lessons'), await load('texts'));
  assert.ok(validateContent(content).entries >= 177);
  for (const scan of new Set(content.entries.map(entry => entry.scan).filter(Boolean))) {
    const image = await readFile(new URL(`../../${scan}`, import.meta.url));
    assert.ok(image.length > 10000);
    assert.equal(image[0], 0xff);
    assert.equal(image[1], 0xd8);
  }
});

test('Zahlwortlesungen und Ligaturen werden nicht als erfundene Varianten gespeichert', async () => {
  const content = assembleData(await load('dictionary'), await load('sources'), await load('lessons'), await load('texts'));
  for (const [id, word, number] of [['pf-fof', 'föf', '6'], ['pf-jut', 'jüt', '10'], ['pf-kaff', 'kaff', '20'], ['pf-schwaenem', 'schwänem', '80']]) {
    const entry = content.entries.find(item => item.id === id);
    assert.equal(entry.word, word);
    assert.ok(accepts(number, entry, 'rw-de'));
  }
  const hair = content.entries.find(item => item.id === 'kt-haelmle');
  assert.ok(accepts('haelmle', hair, 'de-rw'));
  assert.ok(!hair.variants.includes('haelmle'));
});