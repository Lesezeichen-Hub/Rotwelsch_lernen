export function normalize(value) {
  return String(value).toLocaleLowerCase('de').replace(/ſ/g, 's').replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ').trim();
}

export function accepts(answer, entry, direction = 'de-rw') {
  const choices = direction === 'de-rw' ? [entry.word, ...entry.variants] : [entry.meaning, ...entry.answers];
  return choices.some(choice => normalize(choice) === normalize(answer));
}

export function searchEntries(entries, { query = '', topic = '', period = '', usage = '', source = '', collection = null } = {}) {
  const words = normalize(query).split(' ').filter(Boolean);
  return entries.filter(entry => (!topic || entry.topic === topic) && (!period || entry.period === period) && (!usage || (usage === 'current' ? entry.current : !entry.current)) && (!source || entry.source === source) && (!collection || collection.includes(entry.id)) && words.every(word => normalize([entry.word, entry.meaning, ...entry.variants, ...entry.answers, entry.note, entry.region, entry.topic].join(' ')).includes(word)));
}

export function validateContent(content) {
  const errors = [];
  const ids = new Set();
  const sourceIds = new Set(content.sources.map(source => source.id));
  for (const entry of content.entries) {
    if (!/^[a-z0-9-]+$/.test(entry.id) || ids.has(entry.id)) errors.push(`Doppelte/ungültige ID: ${entry.id}`);
    ids.add(entry.id);
    if (!entry.word || !entry.meaning || !entry.evidence || !sourceIds.has(entry.source) || !entry.locator) errors.push(`Fehlender Beleg: ${entry.id}`);
    if (!['scan-reviewed', 'secondary-referenced', 'private'].includes(entry.status)) errors.push(`Ungeprüfter Status: ${entry.id}`);
    if (entry.status === 'scan-reviewed' && !entry.scan) errors.push(`Fehlender Scan: ${entry.id}`);
    if (!Array.isArray(entry.variants) || !Array.isArray(entry.answers)) errors.push(`Ungültige Varianten: ${entry.id}`);
  }
  for (const lesson of content.lessons) {
    if (lesson.entries.length < 3) errors.push(`Zu wenig Lernmaterial: ${lesson.id}`);
    if (lesson.entries.some(id => !ids.has(id))) errors.push(`Ungültiger Lektionsverweis: ${lesson.id}`);
  }
  for (const text of content.texts) {
    if (!['original', 'literary', 'exercise'].includes(text.kind) || !text.body || text.entries.some(id => !ids.has(id))) errors.push(`Ungültiger Text: ${text.id}`);
    if (text.kind !== 'exercise' && (!sourceIds.has(text.source) || !text.locator || !text.scan)) errors.push(`Fehlende Textquelle: ${text.id}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  const headwordKey = word => word.normalize('NFC').toLocaleLowerCase('de').replace(/\s+/g, ' ').trim();
  const headwords = new Set(content.entries.map(entry => headwordKey(entry.word)));
  const phraseHeadwords = new Set(content.entries.filter(entry => entry.word.includes(' ')).map(entry => headwordKey(entry.word)));
  return {
    entries: ids.size,
    headwords: headwords.size,
    phrases: content.entries.filter(entry => entry.word.includes(' ')).length,
    phraseHeadwords: phraseHeadwords.size,
    variants: new Set(content.entries.flatMap(entry => entry.variants.map(headwordKey)).filter(word => !headwords.has(word))).size,
    lessons: content.lessons.length,
    texts: content.texts.length,
    originalTexts: content.texts.filter(text => text.kind === 'original').length,
  };
}

export function distractors(entry, entries, direction = 'rw-de', random = Math.random) {
  const rightAnswers = new Set((direction === 'rw-de' ? [entry.meaning, ...entry.answers] : [entry.word, ...entry.variants]).map(normalize));
  const seen = new Set(rightAnswers);
  return [...entries].sort(() => random() - 0.5).filter(candidate => {
    const value = direction === 'rw-de' ? candidate.meaning : candidate.word;
    const synonyms = direction === 'rw-de' ? [candidate.meaning, ...candidate.answers] : [candidate.word, ...candidate.variants];
    if (candidate.id === entry.id || synonyms.some(answer => rightAnswers.has(normalize(answer))) || seen.has(normalize(value))) return false;
    seen.add(normalize(value));
    return true;
  }).slice(0, 3);
}