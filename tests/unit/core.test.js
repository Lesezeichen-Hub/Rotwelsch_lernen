import test from 'node:test';
import assert from 'node:assert/strict';
import { newCard, schedule, dueCards, cardKey } from '../../js/scheduler.js';
import { createProfile, applyReview, undoReview, makeBackup, validateBackup, mergeProfiles, csv } from '../../js/storage.js';
import { normalize, accepts, distractors } from '../../js/content.js';

const now = new Date('2026-11-08T12:00:00.000Z');
const entry = { id: 'acheln', word: 'acheln', meaning: 'essen', variants: ['Acheln'], answers: ['speisen'] };

test('FSRS: vier Bewertungen, Datum nach JSON-Roundtrip und Richtungsisolation', () => {
  for (const rating of [1, 2, 3, 4]) {
    const result = schedule(newCard(now), rating, now);
    assert.equal(result.card.reps, 1);
    assert.ok(result.card.due > now);
    const next = schedule(JSON.parse(JSON.stringify(result.card)), 3, result.card.due);
    assert.equal(next.card.reps, 2);
    assert.ok(next.card.due > result.card.due);
  }
  assert.notEqual(cardKey('acheln', 'rw-de'), cardKey('acheln', 'de-rw'));
  assert.throws(() => schedule(newCard(now), 0, now));
});

test('Bewertung rücknehmbar, konkurrierende Bewertung wird abgewiesen', () => {
  const profile = createProfile();
  applyReview(profile, entry.id, 'rw-de', 3, 0, now);
  assert.throws(() => applyReview(profile, entry.id, 'rw-de', 3, 0, now), /anderen Tab/);
  undoReview(profile, profile.reviews.at(-1).id);
  assert.equal(profile.reviews.length, 0);
  assert.equal(Object.keys(profile.cards).length, 0);
});

test('Neue Karten respektieren Tageslimit und pausierte Wörter', () => {
  const profile = createProfile();
  profile.settings.newLimit = 1;
  const entries = [entry, { ...entry, id: 'alchen' }];
  assert.equal(dueCards(profile, entries, 'rw-de', now).length, 1);
  applyReview(profile, 'acheln', 'rw-de', 3, 0, now);
  assert.equal(dueCards(profile, entries, 'rw-de', now).length, 0);
  profile.suspended.push('acheln');
  assert.equal(dueCards(profile, entries, 'rw-de', new Date('2026-11-09T12:00:00Z')).length, 1);
});

test('Sicherung validiert Roundtrip, ungültige Daten und Merge', () => {
  const profile = createProfile();
  applyReview(profile, 'acheln', 'rw-de', 3, 0, now);
  const backup = makeBackup([profile]);
  const restored = validateBackup(backup);
  assert.equal(restored[0].cards['acheln:rw-de'].reps, 1);
  assert.equal(restored[0].reviews.length, 1);
  assert.equal(mergeProfiles([profile], restored)[0].reviews.length, 1);
  backup.profiles[0].cards['acheln:rw-de'].due = 'bad';
  assert.throws(() => validateBackup(backup), /Kartendatum/);
  assert.throws(() => validateBackup({ ...makeBackup([profile]), schema: 2 }));
});

test('Normalisierung und plausible Ablenkantworten', () => {
  assert.equal(normalize('Grüße, ſo!'), normalize('Gruesse so'));
  assert.ok(accepts('SPEISEN', entry, 'rw-de'));
  assert.ok(!accepts('Essen gehen', entry, 'rw-de'));
  const pool = [entry, { ...entry, id: 'synonym', meaning: 'speisen' }, { ...entry, id: 'gehen', meaning: 'gehen', answers: [] }];
  assert.deepEqual(distractors(entry, pool, 'rw-de', () => 0.5).map(item => item.id), ['gehen']);
  assert.match(csv([{ ...entry, word: '=evil', source: 'test', locator: '1' }]), /'=evil/);
});