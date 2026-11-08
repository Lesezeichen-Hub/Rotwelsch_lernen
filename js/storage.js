import { newCard, dayKey, cardKey, schedule } from './scheduler.js';

export const defaults = { dailyGoal: 20, newLimit: 10, direction: 'rw-de', theme: 'light', gamification: true, motion: true, onlyCollection: false, voice: '' };

export function createProfile(name = 'Mein Lernplatz', id = crypto.randomUUID()) {
  return { id, name, revision: 0, updatedAt: new Date().toISOString(), settings: { ...defaults }, cards: {}, reviews: [], lessons: {}, favorites: [], collection: [], suspended: [], notes: {}, custom: [], writing: {}, games: [], session: null };
}

export function applyReview(profile, entryId, direction, rating, expectedReps, now = new Date()) {
  const key = cardKey(entryId, direction);
  const previous = profile.cards[key] || null;
  if ((previous?.reps || 0) !== expectedReps) throw new Error('Diese Karte wurde in einem anderen Tab bewertet. Bitte Sitzung neu öffnen.');
  const result = schedule(previous || newCard(now), rating, now);
  profile.cards[key] = result.card;
  profile.reviews.push({ id: crypto.randomUUID(), key, entryId, direction, rating, day: dayKey(now), time: now.toISOString(), wasNew: !previous, previous, log: result.log });
  return result;
}

export function undoReview(profile, expectedId) {
  const last = profile.reviews.at(-1);
  if (!last || last.id !== expectedId) throw new Error('Die letzte Bewertung hat sich inzwischen geändert.');
  if (last.previous) profile.cards[last.key] = last.previous;
  else delete profile.cards[last.key];
  profile.reviews.pop();
  profile.session = null;
}

const plainObject = value => value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const validText = (value, max = 20000) => typeof value === 'string' && value.length <= max;
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const finiteRange = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export function validateBackup(input) {
  if (!plainObject(input) || input.app !== 'rotwelsch-lernen' || input.schema !== 1 || !Array.isArray(input.profiles) || !input.profiles.length || input.profiles.length > 50) throw new Error('Keine unterstützte Rotwelsch-Sicherung (Schema 1).');
  const ids = new Set();
  const profiles = input.profiles.map(source => {
    if (!plainObject(source) || !validText(source.id, 100) || !source.id || ids.has(source.id) || !validText(source.name, 100) || !source.name.trim() || !validDate(source.updatedAt)) throw new Error('Ungültiger oder doppelter Lernplatz.');
    ids.add(source.id);
    const profile = createProfile(source.name.trim(), source.id);
    profile.updatedAt = source.updatedAt;
    if (!plainObject(source.settings) || !finiteRange(source.settings.dailyGoal, 1, 200) || !finiteRange(source.settings.newLimit, 0, 100) || !['rw-de', 'de-rw'].includes(source.settings.direction) || !['light', 'dark'].includes(source.settings.theme)) throw new Error('Ungültige Lerneinstellungen.');
    profile.settings = { ...defaults, dailyGoal: Math.round(source.settings.dailyGoal), newLimit: Math.round(source.settings.newLimit), direction: source.settings.direction, theme: source.settings.theme, gamification: source.settings.gamification !== false, motion: source.settings.motion !== false, onlyCollection: source.settings.onlyCollection === true, voice: validText(source.settings.voice, 500) ? source.settings.voice : '' };
    for (const list of ['favorites', 'collection', 'suspended']) {
      if (!Array.isArray(source[list]) || source[list].length > 50000 || source[list].some(id => !validText(id, 120))) throw new Error('Ungültige Vokabelsammlung.');
      profile[list] = [...new Set(source[list])];
    }
    if (!plainObject(source.cards) || Object.keys(source.cards).length > 50000) throw new Error('Ungültige Lernkarten.');
    for (const [key, card] of Object.entries(source.cards)) {
      if (!/^[a-z0-9-]+:(rw-de|de-rw)$/.test(key) || !plainObject(card) || !validDate(card.due) || (card.last_review && !validDate(card.last_review))) throw new Error('Ungültiges Kartendatum.');
      for (const field of ['stability', 'difficulty', 'elapsed_days', 'scheduled_days', 'learning_steps', 'reps', 'lapses', 'state']) {
        if (!finiteRange(card[field], 0, 1000000)) throw new Error('Ungültiger Kartenwert.');
      }
      if (!Number.isInteger(card.state) || card.state > 3 || card.difficulty > 10) throw new Error('Ungültiger Kartenstatus.');
      profile.cards[key] = Object.fromEntries(['due', 'last_review', 'stability', 'difficulty', 'elapsed_days', 'scheduled_days', 'learning_steps', 'reps', 'lapses', 'state'].filter(field => card[field] !== undefined).map(field => [field, card[field]]));
    }
    if (!Array.isArray(source.reviews) || source.reviews.length > 200000) throw new Error('Ungültiger Wiederholungsverlauf.');
    profile.reviews = source.reviews.map(review => {
      if (!plainObject(review) || !validText(review.id, 100) || !validText(review.entryId, 120) || !['rw-de', 'de-rw'].includes(review.direction) || ![1, 2, 3, 4].includes(review.rating) || !validDate(review.time) || !/^\d{4}-\d{2}-\d{2}$/.test(review.day) || review.key !== cardKey(review.entryId, review.direction)) throw new Error('Ungültige Lernbewertung.');
      return { id: review.id, key: review.key, entryId: review.entryId, direction: review.direction, rating: review.rating, time: review.time, day: review.day, wasNew: review.wasNew === true, previous: null, log: null };
    });
    for (const field of ['notes', 'writing']) {
      if (!plainObject(source[field]) || Object.entries(source[field]).some(([key, value]) => !/^[a-z0-9-]+$/.test(key) || !validText(value))) throw new Error('Ungültige Notizen.');
      profile[field] = Object.fromEntries(Object.entries(source[field]));
    }
    if (!plainObject(source.lessons) || Object.entries(source.lessons).some(([key, value]) => !/^[a-z0-9-]+$/.test(key) || !plainObject(value) || !finiteRange(value.score, 0, 100) || !validDate(value.time))) throw new Error('Ungültiger Lektionsfortschritt.');
    profile.lessons = Object.fromEntries(Object.entries(source.lessons).map(([key, value]) => [key, { score: value.score, time: value.time }]));
    if (!Array.isArray(source.custom) || source.custom.length > 5000) throw new Error('Ungültige eigene Vokabeln.');
    const customIds = new Set();
    profile.custom = source.custom.map(entry => {
      if (!plainObject(entry) || !/^own-[a-z0-9-]+$/.test(entry.id) || customIds.has(entry.id) || !validText(entry.word, 200) || !entry.word.trim() || !validText(entry.meaning, 500) || !entry.meaning.trim() || !validText(entry.evidence, 2000)) throw new Error('Ungültiger eigener Ausdruck.');
      customIds.add(entry.id);
      return privateEntry(entry.word, entry.meaning, entry.evidence, entry.id);
    });
    if (!Array.isArray(source.games) || source.games.length > 100000) throw new Error('Ungültiger Spielverlauf.');
    profile.games = source.games.map(game => {
      if (!plainObject(game) || !validText(game.id, 100) || !validText(game.mode, 100) || !validDate(game.time) || !finiteRange(game.score, 0, 100) || !finiteRange(game.total, 1, 100)) throw new Error('Ungültiges Spielergebnis.');
      return { id: game.id, mode: game.mode, time: game.time, score: game.score, total: game.total };
    });
    return profile;
  });
  return profiles;
}

export function privateEntry(word, meaning, evidence = '', id = `own-${crypto.randomUUID()}`) {
  return { id, word: word.trim(), meaning: meaning.trim(), evidence: evidence.trim() || 'Eigener Eintrag; nicht redaktionell geprüft.', variants: [], answers: [], topic: 'Eigene Wörter', period: 'Privat', region: 'Nicht angegeben', source: 'private', locator: 'Eigene Sammlung', status: 'private', current: false, note: 'Privater Eintrag, kein geprüfter Wörterbuchbeleg.' };
}

export function makeBackup(profiles) {
  return { app: 'rotwelsch-lernen', schema: 1, createdAt: new Date().toISOString(), scheduler: 'ts-fsrs 5.2.3 / retention 0.9 / fuzz false', profiles: JSON.parse(JSON.stringify(profiles)) };
}

export function mergeProfiles(existing, incoming) {
  const result = new Map(existing.map(profile => [profile.id, structuredClone(profile)]));
  for (const imported of incoming) {
    const current = result.get(imported.id);
    if (!current) { result.set(imported.id, imported); continue; }
    const newer = new Date(imported.updatedAt) > new Date(current.updatedAt) ? imported : current;
    const older = newer === imported ? current : imported;
    const merged = { ...structuredClone(older), ...structuredClone(newer), session: null };
    for (const field of ['favorites', 'collection', 'suspended']) merged[field] = [...new Set([...current[field], ...imported[field]])];
    merged.cards = { ...older.cards, ...newer.cards };
    for (const [key, card] of Object.entries(older.cards)) {
      if (newer.cards[key] && new Date(card.last_review || 0) > new Date(newer.cards[key].last_review || 0)) merged.cards[key] = card;
    }
    for (const field of ['notes', 'writing', 'lessons']) merged[field] = { ...older[field], ...newer[field] };
    for (const field of ['reviews', 'custom', 'games']) merged[field] = [...new Map([...older[field], ...newer[field]].map(item => [item.id, item])).values()];
    merged.reviews.sort((first, second) => new Date(first.time) - new Date(second.time));
    result.set(imported.id, merged);
  }
  return [...result.values()];
}

export function csv(entries) {
  const cell = value => `"${(/^[=+\-@\t\r]/.test(String(value)) ? "'" : '') + String(value).replaceAll('"', '""')}"`;
  return '\ufeff' + [['Rotwelsch', 'Deutsch', 'Quelle', 'Fundstelle'], ...entries.map(entry => [entry.word, entry.meaning, entry.source, entry.locator])].map(row => row.map(cell).join(';')).join('\r\n');
}