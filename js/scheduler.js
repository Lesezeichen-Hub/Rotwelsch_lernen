import { createEmptyCard, fsrs, generatorParameters, Rating } from 'ts-fsrs';

export const ratings = [
  { value: Rating.Again, label: 'Nochmal' },
  { value: Rating.Hard, label: 'Schwer' },
  { value: Rating.Good, label: 'Gut' },
  { value: Rating.Easy, label: 'Leicht' },
];
const engine = fsrs(generatorParameters({ enable_fuzz: false, request_retention: 0.9 }));

export function restoreCard(card) {
  return { ...card, due: new Date(card.due), ...(card.last_review ? { last_review: new Date(card.last_review) } : {}) };
}

export function newCard(now = new Date()) {
  return createEmptyCard(now);
}

export function schedule(card, rating, now = new Date()) {
  if (!ratings.some(item => item.value === rating)) throw new Error('Ungültige Lernbewertung.');
  return engine.repeat(restoreCard(card), now)[rating];
}

export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function cardKey(entryId, direction) {
  return `${entryId}:${direction}`;
}

export function dueCards(profile, entries, direction, now = new Date(), extra = {}) {
  const reviewedToday = new Set(profile.reviews.filter(review => review.day === dayKey(now) && review.wasNew).map(review => review.key));
  const allowance = Math.max(0, profile.settings.newLimit - reviewedToday.size);
  const pool = entries.filter(entry => !profile.suspended.includes(entry.id) && (!profile.settings.onlyCollection || profile.collection.includes(entry.id)));
  const due = pool.filter(entry => {
    const card = profile.cards[cardKey(entry.id, direction)];
    return card && new Date(card.due) <= now;
  }).sort((first, second) => new Date(profile.cards[cardKey(first.id, direction)].due) - new Date(profile.cards[cardKey(second.id, direction)].due));
  const unseen = pool.filter(entry => !profile.cards[cardKey(entry.id, direction)]).slice(0, extra.allNew ? pool.length : allowance);
  return [...due, ...unseen];
}

export function intervalLabel(date, now = new Date()) {
  const minutes = Math.max(1, Math.round((new Date(date) - now) / 60000));
  if (minutes < 60) return `${minutes} Min.`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} Std.`;
  return `${Math.round(minutes / 1440)} Tage`;
}