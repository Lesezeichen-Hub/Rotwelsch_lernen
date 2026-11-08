export function assembleData(raw, sources, lessons, texts) {
  const historical = raw.historical.map(([id, word, meaning, topic, page, evidence, answers]) => ({ id, word, meaning, topic, evidence, answers, variants: [], source: 'kluge-1901', period: '1510', region: 'Hochdeutsche Glossarfassung; Einzelregion nicht gesichert', locator: `S. ${page}, Glossar s.v. ${word}`, scan: `./assets/sources/kluge-p${page}.jpg`, status: 'scan-reviewed', current: false, note: 'Historischer Sinn im Liber-Vagatorum-Glossar. Beleg normalisiert transkribiert; Bedeutungsangabe modern erläutert.' }));
  const secondary = raw.secondary.map(([id, word, meaning, topic, variants, answers, note]) => ({ id, word, meaning, topic, variants, answers, note, source: 'wikipedia-rotwelsch', period: 'Überblick / unterschiedliche Zeiten', region: 'Überregionaler Überblick; Verbreitung unterschiedlich', locator: `Abschnitt Beispiele aus dem Vokabular, s.v. ${word}`, evidence: `${word}: ${meaning}. Sinngemäße, ausgewählte Bedeutungsangabe nach dem referenzierten Artikel.`, status: 'secondary-referenced', current: Boolean(raw.currentReferences[id]), currentUrl: raw.currentReferences[id] || '' }));
  const collections = (raw.collections || []).flatMap(collection => collection.entries.map(([id, word, meaning, topic, page, evidence, answers = [], variants = [], note = '']) => ({
    id, word, meaning, topic, evidence, answers, variants, source: collection.source,
    period: collection.period, region: collection.region,
    locator: `S. ${page}, ${collection.title}, s.v. ${word}`,
    scan: `./assets/sources/kluge-p${page}.jpg`, status: 'scan-reviewed', current: false,
    note: [collection.note, note].filter(Boolean).join(' '),
  })));
  return { version: raw.version, entries: [...historical, ...secondary, ...collections], sources, lessons, texts };
}