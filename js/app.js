import { h, button, tool, icon, link, external, select, modal, notify, guarded, download, shuffle } from './dom.js';
import { openDatabase, allProfiles, getProfile, activeId, selectProfile, mutateProfile, addProfile, importProfiles, removeProfile } from './db.js';
import { assembleData } from './data.js';
import { validateContent, searchEntries, accepts, distractors, normalize } from './content.js';
import { dueCards, dayKey, cardKey, ratings, schedule, newCard, intervalLabel } from './scheduler.js';
import { createProfile, applyReview, undoReview, makeBackup, validateBackup, privateEntry, csv } from './storage.js';
import { localVoices, speak, stopSpeech } from './audio.js';

let content;
let profile;
let profiles;
let main;
let counts;
let registration;
let offlineReady = false;
let offlineError = '';
let cleanup = () => {};
const routes = [ ['home', 'Mein Lernplatz', 'GraduationCap'], ['dictionary', 'Wörterbuch', 'LibraryBig'], ['lessons', 'Lehrgang', 'BookOpen'], ['texts', 'Texte', 'FileText'], ['games', 'Spiele', 'Puzzle'], ['progress', 'Lernstand', 'ChartNoAxesColumnIncreasing'], ['settings', 'Einstellungen', 'Settings'], ['sources', 'Quellen', 'ShieldCheck'] ];
const entries = () => [...content.entries, ...profile.custom];
const findEntry = id => entries().find(entry => entry.id === id);
const heading = (title, subtitle = '', actions = []) => h('div', { class: 'page-heading' }, h('div', {}, h('p', { class: 'eyebrow' }, 'Rotwelsch lernen'), h('h1', {}, title), subtitle && h('p', { class: 'muted' }, subtitle)), h('div', { class: 'row' }, actions));
const badge = entry => h('span', { class: `badge ${entry.current ? 'current' : ''}` }, entry.status === 'private' ? 'Eigener Eintrag' : entry.current ? 'Heute dokumentiert' : entry.period);
const toggle = (list, id) => { const position = list.indexOf(id); if (position < 0) list.push(id); else list.splice(position, 1); };

async function change(update) {
  profile = await mutateProfile(profile.id, update);
  profiles = await allProfiles();
  applyTheme();
}

function applyTheme() {
  document.documentElement.dataset.theme = profile.settings.theme;
  document.documentElement.dataset.motion = profile.settings.motion ? 'on' : 'off';
  try { localStorage.setItem(`rotwelsch-theme:${new URL('./', document.baseURI).pathname}`, profile.settings.theme); } catch {}
}

function navigate(route) {
  if (location.hash === `#${route}`) render();
  else location.hash = route;
}

function render() {
  cleanup();
  cleanup = () => {};
  stopSpeech();
  const [route, id] = (location.hash.slice(1) || 'home').split('/');
  document.querySelectorAll('.navigation a').forEach(anchor => anchor.setAttribute('aria-current', anchor.hash === `#${route}` || (route === 'review' && anchor.hash === '#home') ? 'page' : 'false'));
  main.replaceChildren();
  const view = { home: homeView, dictionary: dictionaryView, lessons: lessonsView, texts: textsView, sources: sourcesView, review: reviewView, games: gamesView, progress: progressView, settings: settingsView }[route];
  if (view) view(id); else homeView();
  document.title = `${main.querySelector('h1')?.textContent || 'Mein Lernplatz'} · Rotwelsch lernen`;
  main.focus({ preventScroll: true });
}

function shell() {
  const profileSelect = select('Lernplatz', profiles.map(item => ({ value: item.id, label: item.name })), profile.id, guarded(async event => {
    await selectProfile(event.target.value);
    profile = await getProfile(event.target.value);
    applyTheme();
    shell();
    render();
  }));
  const status = h('span', { id: 'offline-state', class: 'online-state' }, icon('RefreshCw'), 'Offline-Cache wird vorbereitet');
  const theme = tool('Farbschema wechseln', 'Moon', async () => { await change(current => { current.settings.theme = current.settings.theme === 'dark' ? 'light' : 'dark'; }); });
  const sidebar = h('aside', { class: 'sidebar' }, h('a', { class: 'brand', href: '#home' }, icon('BookOpen'), h('span', {}, 'Rotwelsch', h('small', {}, 'Wörter. Quellen. Lernwege.'))),
    h('nav', { class: 'navigation', 'aria-label': 'Hauptnavigation' }, routes.map(([route, label, symbol]) => h('a', { href: `#${route}`, onclick: event => { event.preventDefault(); navigate(route); } }, icon(symbol), label))),
    h('div', { class: 'sidebar-bottom' }, `${counts.headwords} Hauptformen · ${counts.variants} Nebenformen`, location.pathname.startsWith('/modules/') && link('Zum Lesezeichen-Hub', '/'), link('Quellen & Herkunft', '#sources')));
  main = h('main', { id: 'main', class: 'main', tabindex: '-1' });
  document.querySelector('#app').replaceChildren(h('div', { class: 'shell' }, sidebar, h('div', { class: 'workspace' }, h('header', { class: 'topbar' }, profileSelect, h('div', { class: 'row' }, status, theme)), main)));
  updateOfflineState();
}

function updateOfflineState() {
  const state = document.querySelector('#offline-state');
  if (!state) return;
  state.replaceChildren(icon(offlineReady ? 'ShieldCheck' : offlineError ? 'WifiOff' : 'RefreshCw'), offlineReady ? (navigator.onLine ? 'Offline bereit' : 'Offline') : offlineError ? 'Offline-Einrichtung fehlgeschlagen' : 'Offline-Cache wird vorbereitet');
  state.title = offlineError;
  if (offlineError && !document.querySelector('#retry-offline')) state.after(button('Erneut versuchen', 'RefreshCw', retryOffline, { id: 'retry-offline' }));
  if (!offlineError) document.querySelector('#retry-offline')?.remove();
}

async function retryOffline() {
  if (!registration?.active) { location.reload(); return; }
  offlineError = '';
  updateOfflineState();
  await registration.update();
}

function homeView() {
  const today = profile.reviews.filter(review => review.day === dayKey()).length;
  const queue = dueCards(profile, entries(), profile.settings.direction);
  const learned = new Set(profile.reviews.map(review => review.entryId)).size;
  const next = content.lessons.find(lesson => !profile.lessons[lesson.id]) || content.lessons[0];
  const daily = content.entries[Math.floor(Date.now() / 86400000) % content.entries.length];
  main.append(heading('Mein Lernplatz', new Intl.DateTimeFormat('de', { dateStyle: 'full' }).format(new Date())),
    h('div', { class: 'metrics' }, [[today, `von ${profile.settings.dailyGoal} Wiederholungen heute`], [queue.length, 'Karten zum Lernen'], [learned, 'Wörter im Lernverlauf']].map(([number, text]) => h('div', { class: 'metric' }, h('strong', {}, number), h('span', {}, text)))),
    h('div', { class: 'actions' }, button(profile.session ? 'Lernsitzung fortsetzen' : 'Karten lernen', 'Play', () => profile.session ? navigate('review') : startReview(), { class: 'primary' }), button('Meine Sammlung', 'Layers', () => navigate('dictionary')), h('span', { class: 'small muted' }, profile.settings.direction === 'rw-de' ? 'Rotwelsch → Deutsch' : 'Deutsch → Rotwelsch')),
    h('div', { class: 'two-columns' }, h('section', {}, h('p', { class: 'eyebrow' }, 'Dein nächster Schritt'), h('h2', {}, next.title), h('p', { class: 'muted' }, `${next.stage} · ${next.entries.length} Wörter · ca. ${next.minutes} Minuten`), h('div', { class: 'actions' }, link('Lektion öffnen', `#lessons/${next.id}`, { class: 'button primary' })), h('h3', {}, 'Dein Lehrgang'), content.lessons.slice(0, 4).map(lessonRow), link('Alle zwölf Einheiten', '#lessons')),
      h('aside', {}, h('p', { class: 'eyebrow' }, 'Wort des Tages'), h('div', { class: 'word-day' }, h('p', { class: 'serif' }, daily.word), h('p', {}, daily.meaning), badge(daily), button('Beleg ansehen', 'ArrowRight', () => entryDialog(daily))), h('h3', {}, 'Ein Blick in die Quelle'), h('img', { class: 'source-thumb', src: './assets/sources/kluge-p53.jpg', alt: 'Originalseite 53 aus Kluges Rotwelsch-Quellenbuch von 1901', width: 1000, height: 1500 }), h('p', { class: 'small muted' }, 'Kluge, Quellenbuch 1901 · Glossar von 1510'))));
}

function lessonRow(lesson, index = content.lessons.indexOf(lesson)) {
  return h('div', { class: 'lesson-row' }, h('span', { class: 'lesson-number' }, profile.lessons[lesson.id] ? icon('Check') : index + 1), h('div', {}, h('h3', {}, lesson.title), h('p', { class: 'small muted' }, `${lesson.entries.length} Wörter · ${lesson.stage}${profile.lessons[lesson.id] ? ` · ${profile.lessons[lesson.id].score}%` : ''}`)), tool(`Lektion öffnen: ${lesson.title}`, 'ChevronRight', () => navigate(`lessons/${lesson.id}`)));
}

function dictionaryView() {
  main.append(heading('Wörterbuch', `${counts.entries} Quellenbedeutungen · ${counts.headwords} Hauptformen`, [tool('Drucken', 'Printer', () => window.print()), tool('Vokabeln als CSV exportieren', 'Download', () => download('rotwelsch-woerter.csv', csv(visible), 'text/csv;charset=utf-8'))]));
  let visible = [];
  let page = 0;
  const query = h('input', { type: 'search', placeholder: 'Rotwelsch oder Deutsch', 'aria-label': 'Wörterbuch durchsuchen' });
  const topic = select('Thema', [{ value: '', label: 'Alle Themen' }, ...[...new Set(entries().map(entry => entry.topic))].sort().map(value => ({ value, label: value }))], '', () => { page = 0; results(); });
  const source = select('Quelle', [{ value: '', label: 'Alle Quellen' }, ...content.sources.filter(item => content.entries.some(entry => entry.source === item.id)).map(item => ({ value: item.id, label: item.title })), { value: 'private', label: 'Eigene Einträge' }], '', () => { page = 0; results(); });
  const usage = select('Zeitraum / Gebrauch', [{ value: '', label: 'Alle Belege' }, { value: 'current', label: 'Heute dokumentiert' }, { value: 'historical', label: 'Historisch / ohne Gegenwartsbeleg' }], '', () => { page = 0; results(); });
  const collection = select('Auswahl', [{ value: '', label: 'Gesamtes Wörterbuch' }, { value: 'favorites', label: 'Favoriten' }, { value: 'collection', label: 'Meine Lernsammlung' }, { value: 'suspended', label: 'Pausierte Wörter' }], '', () => { page = 0; results(); });
  const direction = select('Sortierung', [{ value: 'word', label: 'Rotwelsch → Deutsch' }, { value: 'meaning', label: 'Deutsch → Rotwelsch' }], 'word', () => { page = 0; results(); });
  const resultRegion = h('div');
  query.addEventListener('input', () => { page = 0; results(); });
  main.append(h('div', { class: 'filters' }, h('label', { class: 'field search-field' }, 'Suche', query), topic, source, usage, collection, direction), resultRegion);
  function results() {
    const selected = collection.querySelector('select').value;
    visible = searchEntries(entries(), { query: query.value, topic: topic.querySelector('select').value, source: source.querySelector('select').value, usage: usage.querySelector('select').value, collection: selected ? profile[selected] : null });
    const sort = direction.querySelector('select').value;
    visible.sort((first, second) => first[sort].localeCompare(second[sort], 'de'));
    const pages = Math.max(1, Math.ceil(visible.length / 40));
    page = Math.min(page, pages - 1);
    const table = h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Rotwelsch'), h('th', {}, 'Deutsch'), h('th', { class: 'desktop-column' }, 'Beleg'), h('th', {}, 'Sammlung'))), h('tbody', {}, visible.slice(page * 40, page * 40 + 40).map(entry => h('tr', {}, h('td', {}, button(entry.word, null, () => entryDialog(entry), { class: 'word-link' })), h('td', {}, entry.meaning, h('div', { class: 'small muted' }, entry.topic)), h('td', { class: 'desktop-column' }, badge(entry)), h('td', {}, tool(profile.favorites.includes(entry.id) ? 'Favorit entfernen' : 'Als Favorit merken', 'Star', async () => { await change(current => toggle(current.favorites, entry.id)); results(); }, { 'aria-pressed': String(profile.favorites.includes(entry.id)) }))))));
    resultRegion.replaceChildren(h('div', { class: 'row spread small muted', 'aria-live': 'polite' }, `${visible.length} Treffer`, `Seite ${page + 1} / ${pages}`), visible.length ? h('div', { class: 'table-scroll' }, table) : h('p', { class: 'empty' }, 'Keine passenden Einträge.'), h('div', { class: 'actions' }, tool('Vorherige Seite', 'ArrowLeft', () => { page--; results(); }, { disabled: page === 0 }), tool('Nächste Seite', 'ArrowRight', () => { page++; results(); }, { disabled: page >= pages - 1 })));
  }
  results();
}

function entryDialog(entry) {
  const source = content.sources.find(item => item.id === entry.source);
  const notes = h('textarea', { value: profile.notes[entry.id] || '', maxlength: 20000, 'aria-label': 'Eigene Notiz' });
  const dialog = modal(entry.word, h('p', { class: 'definition' }, entry.meaning), badge(entry), h('p', { class: 'small muted' }, entry.region), h('p', {}, entry.note), entry.variants.length && h('p', {}, `Belegte Nebenformen: ${entry.variants.join(', ')}`), h('blockquote', { class: 'evidence' }, entry.evidence), h('p', { class: 'small' }, entry.locator), source && external(source.title, source.url), entry.currentUrl && h('p', {}, external('Gegenwartsreferenz', entry.currentUrl)), entry.scan && h('details', {}, h('summary', {}, 'Originalscan'), h('img', { class: 'source-full', src: entry.scan, alt: entry.locator })),
    h('div', { class: 'actions' }, button('Diese Karte lernen', 'Play', async () => { dialog.close(); await startReview([entry], true); }), button(profile.collection.includes(entry.id) ? 'Aus Lernsammlung entfernen' : 'Zur Lernsammlung', 'Plus', async () => { await change(current => toggle(current.collection, entry.id)); dialog.close(); entryDialog(entry); }), button(profile.suspended.includes(entry.id) ? 'Lernen fortsetzen' : 'Wort pausieren', 'Pause', async () => { await change(current => toggle(current.suspended, entry.id)); dialog.close(); entryDialog(entry); }), tool('Mit lokaler Stimme vorlesen', 'Volume2', () => speak(entry.word, profile.settings.voice), { disabled: !localVoices().length })), h('label', { class: 'field' }, 'Eigene Notiz', notes), button('Notiz speichern', 'Check', async () => { await change(current => { current.notes[entry.id] = notes.value; }); notify('Notiz gespeichert.'); }));
}

function lessonsView(id) {
  const lesson = content.lessons.find(item => item.id === id);
  if (!lesson) { main.append(heading('Lehrgang', 'Zwölf Einheiten vom ersten Wort bis zur Quellenlektüre.'), ...content.lessons.map(lessonRow)); return; }
  main.append(heading(lesson.title, `${lesson.stage} · ca. ${lesson.minutes} Minuten`, [tool('Zum Lehrgang', 'ArrowLeft', () => navigate('lessons'))]), h('div', { class: 'prose' }, lesson.intro.map(paragraph => h('p', {}, paragraph))), h('section', { class: 'section' }, h('h2', {}, 'Wörter dieser Einheit'), h('div', { class: 'row' }, lesson.entries.map(entryId => { const entry = findEntry(entryId); return button(`${entry.word} · ${entry.meaning}`, null, () => entryDialog(entry)); }))));
  main.append(h('div', { class: 'actions' }, button('Abschlussprüfung starten', 'GraduationCap', () => {
    const questions = [{ title: lesson.question, answer: lesson.options[lesson.correct], choices: lesson.options, explanation: lesson.explanation }, ...lesson.entries.map(entryId => questionFor(findEntry(entryId), 'choice'))];
    quiz(lesson.title, questions, async score => {
      await change(current => { current.lessons[lesson.id] = { score, time: new Date().toISOString() }; });
    }, `lessons/${lesson.id}`);
  }, { class: 'primary' }), button('Lektionskarten wiederholen', 'Play', () => startReview(lesson.entries.map(findEntry)))));
}

function textsView(id) {
  const text = content.texts.find(item => item.id === id);
  if (!text) { main.append(heading('Texte & Quellenlektüre', `${content.texts.length} Texte · ${counts.originalTexts} Originalauszüge`), ...content.texts.map((item, index) => h('div', { class: 'lesson-row' }, h('span', { class: 'lesson-number' }, index + 1), h('div', {}, h('h3', {}, item.title), h('p', { class: 'small muted' }, item.kind === 'original' ? 'Überlieferter Originalauszug' : 'Didaktisch neu erstellt')), tool(`Text öffnen: ${item.title}`, 'ChevronRight', () => navigate(`texts/${item.id}`))))); return; }
  main.append(heading(text.title, text.kind === 'original' ? 'Überlieferter Originalauszug' : 'Didaktisch neu erstellt', [tool('Zu den Texten', 'ArrowLeft', () => navigate('texts'))]), h('p', { class: 'small muted' }, text.note), h('div', { class: 'text-body' }, text.body), h('details', {}, h('summary', {}, 'Verständnishilfe'), h('p', {}, text.translation)), h('section', { class: 'section' }, h('h2', {}, 'Wörter im Text'), h('div', { class: 'row' }, text.entries.map(entryId => { const entry = findEntry(entryId); return button(entry.word, null, () => entryDialog(entry)); }))), text.scan && h('details', {}, h('summary', {}, text.locator), h('img', { class: 'source-full', src: text.scan, alt: text.locator })));
  const textBody = main.querySelector('.text-body');
  const glossary = text.entries.map(findEntry).flatMap(entry => [entry.word, ...entry.variants].map(word => ({ word, entry }))).sort((first, second) => second.word.length - first.word.length);
  const escaped = word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(${glossary.map(item => escaped(item.word)).join('|')})`, 'gi');
  textBody.replaceChildren(...text.body.split(pattern).filter(Boolean).map(part => {
    const match = glossary.find(item => item.word.toLocaleLowerCase('de') === part.toLocaleLowerCase('de'));
    return match ? button(part, null, () => entryDialog(match.entry), { class: 'text-word' }) : document.createTextNode(part);
  }));
  const writing = h('textarea', { value: profile.writing[text.id] || '', maxlength: 20000, 'aria-label': 'Deine Antwort' });
  main.append(h('section', { class: 'section prose' }, h('h2', {}, 'Textverständnis'), h('p', {}, text.prompt), h('label', { class: 'field' }, 'Deine Antwort', writing), button('Antwort speichern', 'Check', async () => { await change(current => { current.writing[text.id] = writing.value; }); notify('Antwort gespeichert.'); }), h('details', {}, h('summary', {}, 'Musterantwort zur Selbstkontrolle'), h('p', {}, text.model)), h('div', { class: 'actions' }, button('Wörter üben', 'Puzzle', () => quiz(text.title, text.entries.map(entryId => questionFor(findEntry(entryId), 'input')), () => {}, `texts/${text.id}`)), tool('Text vorlesen', 'Volume2', () => speak(text.body, profile.settings.voice), { disabled: !localVoices().length }), tool('Text drucken', 'Printer', () => window.print()))));
}

function sourcesView() {
  main.append(heading('Quellen & Herkunft', `${counts.headwords} Hauptformen · ${counts.entries} Quellenbedeutungen · ${counts.variants} belegte Nebenformen`), h('div', { class: 'prose' }, h('p', {}, 'Rotwelsch umfasst historische und regionale Sonderwortschätze. Beleg, Zeitraum und soziale Situation gehören zu jeder Bedeutung.'), h('p', {}, 'Die historischen Einträge wurden mit den archivierten Originalseiten verglichen. Das ist keine unabhängige Fachbegutachtung und kein vollständiger Atlas aller Rotwelsch-Varietäten.')), ...content.sources.map(source => h('section', { class: 'section' }, h('h2', {}, source.title), h('p', { class: 'muted' }, `${source.author} · ${source.year}`), h('p', {}, source.note), h('p', { class: 'small' }, source.license), h('div', { class: 'row' }, external('Quelle öffnen', source.url), external('Rechte', source.licenseUrl), source.history && external('Autorinnen und Autoren', source.history)), source.local && h('p', {}, link('Lokal archivierte Quelle', source.local, { target: '_blank' })))));
}

async function startReview(pool = entries(), force = false) {
  if (profile.session) {
    const dialog = modal('Lernsitzung läuft', h('p', {}, 'Der gespeicherte Lernstand bleibt erhalten.'), h('div', { class: 'actions' }, button('Fortsetzen', 'Play', () => { dialog.close(); navigate('review'); }), button('Neue Sitzung beginnen', 'RefreshCw', async () => { await change(current => { current.session = null; }); dialog.close(); await startReview(pool, force); })));
    return;
  }
  const queue = force ? pool : dueCards(profile, pool, profile.settings.direction);
  if (!queue.length) {
    notify('Gerade keine fälligen oder neuen Karten. Tageslimit und Auswahl stehen in den Einstellungen.');
    return;
  }
  await change(current => { current.session = { id: crypto.randomUUID(), ids: queue.slice(0, 30).map(entry => entry.id), direction: current.settings.direction, index: 0, started: new Date().toISOString() }; });
  navigate('review');
}

function reviewView() {
  const session = profile.session;
  if (!session) { main.append(heading('Lernsitzung', 'Keine gespeicherte Sitzung.'), button('Karten lernen', 'Play', () => startReview(), { class: 'primary' })); return; }
  const entry = findEntry(session.ids[session.index]);
  if (!entry) { main.append(heading('Sitzung abgeschlossen'), h('p', {}, `${session.ids.length} Karten wiederholt.`), button('Zum Lernplatz', 'Check', async () => { await change(current => { current.session = null; }); navigate('home'); }, { class: 'primary' })); return; }
  const key = cardKey(entry.id, session.direction);
  const card = profile.cards[key] || newCard();
  const expectedReps = card.reps;
  const last = profile.reviews.at(-1);
  const now = new Date();
  main.append(heading('Karten lernen', `${session.index + 1} / ${session.ids.length} · ${session.direction === 'rw-de' ? 'Rotwelsch → Deutsch' : 'Deutsch → Rotwelsch'}`, [tool('Sitzung pausieren', 'Pause', () => navigate('home'))]), h('progress', { value: session.index, max: session.ids.length, 'aria-label': 'Sitzungsfortschritt' }));
  const surface = h('section', { class: 'review-surface' }, badge(entry), h('p', { class: 'review-word' }, session.direction === 'rw-de' ? entry.word : entry.meaning), h('p', { class: 'small muted' }, entry.region));
  if (session.direction === 'de-rw') surface.append(h('p', { class: 'small muted' }, `Gesuchte Quellenform: ${entry.word.length} Zeichen, beginnt mit ${entry.word[0]}.`));
  const reveal = button('Antwort zeigen', 'ArrowRight', () => {
    reveal.remove();
    surface.append(h('p', { class: 'definition' }, session.direction === 'rw-de' ? entry.meaning : entry.word), h('p', { class: 'small muted' }, entry.note), button('Quellenbeleg', 'BookOpen', () => entryDialog(entry)), h('div', { class: 'ratings' }, ratings.map(rating => {
      return button(rating.label, null, async () => {
        await change(current => {
          if (current.session?.id !== session.id || current.session?.index !== session.index) throw new Error('Die Sitzung wurde in einem anderen Tab verändert. Bitte neu öffnen.');
          applyReview(current, entry.id, session.direction, rating.value, expectedReps);
          current.session.index++;
        });
        render();
      }, { 'data-rating': rating.value });
    })));
    surface.querySelectorAll('[data-rating]').forEach(element => { element.append(h('small', {}, intervalLabel(schedule(card, Number(element.dataset.rating), now).card.due, now))); });
    surface.querySelector('[data-rating="3"]').focus();
  }, { class: 'primary' });
  surface.append(reveal);
  main.append(surface, h('div', { class: 'actions' }, tool('Letzte Bewertung zurücknehmen', 'RotateCcw', async () => {
    const previousEntry = findEntry(last.entryId);
    await change(current => { undoReview(current, last.id); });
    await startReview([previousEntry], true);
  }, { disabled: !last?.log })));
}

function questionFor(entry, mode, direction = 'rw-de') {
  const answer = direction === 'rw-de' ? entry.meaning : entry.word;
  const candidates = distractors(entry, entries(), direction).filter(candidate => direction !== 'de-rw' || normalize(candidate.meaning) !== normalize(entry.meaning));
  return { entry, direction, mode, answer, title: mode === 'gap' ? `${entry.evidence.replace(new RegExp(entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '________')}` : (direction === 'rw-de' ? entry.word : entry.meaning), choices: shuffle([answer, ...candidates.map(candidate => direction === 'rw-de' ? candidate.meaning : candidate.word)]), explanation: `${entry.word}: ${entry.meaning}. ${entry.locator}` };
}

function quiz(title, questions, onComplete, back = 'games', seconds = 0) {
  cleanup();
  let position = 0;
  let correct = 0;
  let answered = false;
  let finished = false;
  const deadline = Date.now() + seconds * 1000;
  const tick = seconds ? setInterval(() => {
    const clock = main.querySelector('#quiz-clock');
    if (clock) clock.textContent = `${Math.max(0, Math.ceil((deadline - Date.now()) / 1000))} Sek.`;
    if (Date.now() >= deadline) guarded(finish)();
  }, 250) : null;
  cleanup = () => clearInterval(tick);
  async function finish() {
    if (finished) return;
    finished = true;
    clearInterval(tick);
    const score = Math.round(correct / questions.length * 100);
    await onComplete(score);
    main.replaceChildren(heading('Übung abgeschlossen', title), h('p', { class: 'review-word' }, `${score}%`), h('p', {}, `${correct} von ${questions.length} Antworten richtig.`), button('Zurück', 'ArrowLeft', () => { render(); navigate(back); }, { class: 'primary' }));
  }
  function draw() {
    if (position >= questions.length) { guarded(finish)(); return; }
    answered = false;
    const question = questions[position];
    main.replaceChildren(...[heading(title, `Aufgabe ${position + 1} / ${questions.length}`, [tool('Übung beenden', 'X', () => { cleanup(); navigate(back); })]), h('progress', { value: position, max: questions.length, 'aria-label': 'Übungsfortschritt' }), seconds && h('p', { id: 'quiz-clock', class: 'muted' }, `${seconds} Sek.`), question.entry && badge(question.entry), h('h2', { class: 'review-word', 'data-entry-id': question.entry?.id, 'data-direction': question.direction, 'data-mode': question.mode }, question.title)].filter(Boolean));
    if (question.direction === 'de-rw' && question.entry) main.append(h('p', { class: 'small muted' }, `Quellenform mit ${question.entry.word.length} Zeichen, beginnt mit ${question.entry.word[0]}.`));
    const feedback = h('div', { 'aria-live': 'polite' });
    const controls = h('div', { class: 'choice-list' });
    async function check(value) {
      if (answered || finished) return;
      answered = true;
      const direction = question.mode === 'gap' ? 'de-rw' : question.direction;
      const right = question.entry ? accepts(value, question.entry, direction) : normalize(value) === normalize(question.answer);
      if (right) correct++;
      controls.querySelectorAll('button, input').forEach(element => { element.disabled = true; element.setAttribute('data-permanent-disabled', ''); });
      feedback.replaceChildren(h('div', { class: `answer-feedback ${right ? '' : 'wrong'}` }, h('strong', {}, right ? 'Richtig.' : `Gesuchte Antwort: ${question.answer}`), h('p', {}, question.explanation)), button(position === questions.length - 1 ? 'Ergebnis ansehen' : 'Weiter', 'ArrowRight', () => { position++; draw(); }, { class: 'primary' }));
      feedback.querySelector('button').focus();
    }
    if (question.mode === 'input' || question.mode === 'gap') {
      const input = h('input', { required: true, maxlength: 500, autocomplete: 'off', 'aria-label': 'Antwort eingeben' });
      controls.append(h('form', { onsubmit: guarded(async event => { event.preventDefault(); await check(input.value); }) }, h('label', { class: 'field' }, 'Deine Antwort', input), h('button', { type: 'submit', class: 'primary' }, icon('Check'), 'Antwort prüfen')));
      setTimeout(() => { if (input.isConnected) input.focus(); }, 0);
    } else controls.append(...question.choices.map(choice => button(choice, null, () => check(choice))));
    main.append(controls, feedback);
  }
  draw();
}

function gamesView() {
  main.append(heading('Spielerisch üben', 'Wortschatz, Bedeutungen und Originalbelege'));
  const topics = select('Wortschatz', [{ value: '', label: 'Alle Wörter' }, { value: 'current', label: 'Heute dokumentiert' }, { value: 'collection', label: 'Meine Lernsammlung' }, ...[...new Set(content.entries.map(entry => entry.topic))].sort().map(value => ({ value, label: value }))], '', () => {});
  const direction = select('Richtung', [{ value: 'rw-de', label: 'Rotwelsch → Deutsch' }, { value: 'de-rw', label: 'Deutsch → Rotwelsch' }], profile.settings.direction, () => {});
  const timed = h('input', { type: 'checkbox', id: 'timed' });
  main.append(h('div', { class: 'filters' }, topics, direction, h('label', { class: 'checkbox' }, timed, '90-Sekunden-Challenge')));
  function pool() {
    const value = topics.querySelector('select').value;
    const seen = new Set();
    return shuffle(entries().filter(entry => (value === '' || (value === 'current' ? entry.current : value === 'collection' ? profile.collection.includes(entry.id) : entry.topic === value)) && !profile.suspended.includes(entry.id))).filter(entry => {
      if (seen.has(normalize(entry.meaning)) || seen.has(`word:${normalize(entry.word)}`)) return false;
      seen.add(normalize(entry.meaning));
      seen.add(`word:${normalize(entry.word)}`);
      return true;
    }).slice(0, 10);
  }
  const save = async (mode, score, total) => change(current => { current.games.push({ id: crypto.randomUUID(), mode, score, total, time: new Date().toISOString() }); });
  main.append(h('div', { class: 'game-grid' }, [['choice', 'Bedeutung wählen', 'CircleHelp'], ['input', 'Wörter schreiben', 'FileText'], ['gap', 'Originalbeleg ergänzen', 'BookOpen'], ['match', 'Paare finden', 'Layers']].map(([mode, title, symbol]) => h('section', { class: 'game-item' }, h('h3', {}, icon(symbol), title), button('Starten', 'Play', async () => {
    const chosen = pool().filter(entry => mode !== 'gap' || entry.evidence.toLocaleLowerCase('de').includes(entry.word.toLocaleLowerCase('de')));
    if (chosen.length < 2) { notify('Mindestens zwei passende Wörter benötigt. Bitte Auswahl erweitern.'); return; }
    if (mode === 'match') matching(chosen.slice(0, 6), (score, total) => save(mode, score, total));
    else quiz(title, chosen.map(entry => questionFor(entry, mode, mode === 'gap' ? 'de-rw' : direction.querySelector('select').value)), score => save(mode, score, chosen.length), 'games', timed.checked ? 90 : 0);
  }, { class: 'primary' })))));
}

function matching(chosen, save) {
  main.replaceChildren(heading('Paare finden', `${chosen.length} Wort-Bedeutungs-Paare`, [tool('Zur Spieleauswahl', 'ArrowLeft', () => navigate('games'))]));
  const state = h('p', { 'aria-live': 'polite' }, '0 Paare');
  const left = h('div', { class: 'matching-column' });
  const right = h('div', { class: 'matching-column' });
  let selected = null;
  let found = 0;
  let mistakes = 0;
  chosen.forEach(entry => left.append(button(entry.word, null, event => {
    left.querySelectorAll('button').forEach(element => element.classList.remove('selected'));
    selected = entry;
    event.currentTarget.classList.add('selected');
  }, { 'data-id': entry.id })));
  shuffle(chosen).forEach(entry => right.append(button(entry.meaning, null, async event => {
    if (!selected) { state.textContent = 'Bitte zuerst ein Wort auswählen.'; return; }
    if (entry.id !== selected.id) { mistakes++; state.textContent = 'Dieses Paar passt nicht zusammen.'; return; }
    const partner = left.querySelector(`[data-id="${entry.id}"]`);
    partner.disabled = true;
    partner.className = 'matched';
    event.currentTarget.className = 'matched';
    event.currentTarget.setAttribute('data-permanent-disabled', '');
    selected = null;
    found++;
    state.textContent = `${found} / ${chosen.length} Paare · ${mistakes} Fehlversuche`;
    if (found === chosen.length) {
      await save(Math.round(chosen.length / (chosen.length + mistakes) * 100), chosen.length);
      main.append(button('Neue Runde', 'RefreshCw', () => navigate('games'), { class: 'primary' }));
    }
  }, { 'data-id': entry.id })));
  main.append(state, h('div', { class: 'matching' }, left, right));
}

function progressView() {
  const learned = new Set(profile.reviews.map(review => review.entryId));
  const correct = profile.reviews.filter(review => review.rating >= 3).length;
  main.append(heading('Dein Lernstand'), h('div', { class: 'metrics' }, [[learned.size, 'Wörter wiederholt'], [Object.keys(profile.lessons).length, 'Einheiten geprüft'], [profile.reviews.length, 'Kartenbewertungen']].map(([number, title]) => h('div', { class: 'metric' }, h('strong', {}, number), h('span', {}, title)))), h('p', {}, `${profile.reviews.length ? Math.round(correct / profile.reviews.length * 100) : 0}% der Kartenbewertungen: gut oder leicht.`));
  const days = Array.from({ length: 14 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - 13 + index); return { date, count: profile.reviews.filter(review => review.day === dayKey(date)).length }; });
  const max = Math.max(1, ...days.map(day => day.count));
  main.append(h('section', { class: 'section' }, h('h2', {}, 'Die letzten 14 Tage'), h('div', { class: 'activity' }, days.map(day => {
    const bar = h('div', { class: 'activity-bar' });
    bar.style.height = `${Math.max(3, day.count / max * 65)}px`;
    return h('div', { class: 'activity-day', title: `${dayKey(day.date)}: ${day.count} Bewertungen` }, h('span', {}, day.count), bar, h('span', {}, day.date.getDate()));
  }))));
  if (profile.settings.gamification) {
    const points = profile.reviews.length * 5 + profile.games.reduce((total, game) => total + Math.round(game.score / 10), 0);
    main.append(h('section', { class: 'section' }, h('h2', {}, 'Lernpunkte & Meilensteine'), h('p', {}, `${points} Lernpunkte`), h('div', { class: 'row' }, [10, 50, 100, 250].map(goal => h('span', { class: `badge ${learned.size >= goal ? 'current' : ''}` }, `${learned.size >= goal ? 'Erreicht: ' : ''}${goal} Wörter`)))));
  }
  const difficult = entries().filter(entry => Object.entries(profile.cards).some(([key, card]) => key.startsWith(`${entry.id}:`) && (card.lapses > 0 || card.difficulty >= 7)));
  main.append(h('section', { class: 'section' }, h('h2', {}, 'Schwierige Wörter'), difficult.length ? h('div', { class: 'row' }, difficult.slice(0, 30).map(entry => button(entry.word, null, () => entryDialog(entry)))) : h('p', { class: 'muted' }, 'Noch keine schwierigen Wörter im Lernverlauf.')));
  main.append(h('section', { class: 'section' }, h('h2', {}, 'Übungsergebnisse'), profile.games.length ? h('div', {}, [...profile.games].reverse().slice(0, 10).map(game => h('p', {}, `${new Date(game.time).toLocaleDateString('de')} · ${game.mode} · ${game.score}%`))) : h('p', { class: 'muted' }, 'Noch keine abgeschlossenen Spielrunden.')));
}

function settingsView() {
  main.append(heading('Einstellungen & Sicherung'));
  const goal = h('input', { type: 'number', min: 1, max: 200, value: profile.settings.dailyGoal, required: true });
  const limit = h('input', { type: 'number', min: 0, max: 100, value: profile.settings.newLimit, required: true });
  const direction = select('Lernrichtung', [{ value: 'rw-de', label: 'Rotwelsch → Deutsch' }, { value: 'de-rw', label: 'Deutsch → Rotwelsch' }], profile.settings.direction, () => {});
  const theme = select('Farbschema', [{ value: 'light', label: 'Hell' }, { value: 'dark', label: 'Dunkel' }], profile.settings.theme, () => {});
  const voices = localVoices();
  const voice = select('Lokale Vorlesestimme', [{ value: '', label: voices.length ? 'Automatisch' : 'Keine lokale deutsche Stimme' }, ...voices.map(item => ({ value: item.voiceURI, label: item.name }))], profile.settings.voice, () => {});
  const checkboxes = Object.fromEntries([['onlyCollection', 'Nur meine Lernsammlung'], ['gamification', 'Lernpunkte und Meilensteine'], ['motion', 'Dezente Animationen']].map(([key, label]) => [key, { label, input: h('input', { type: 'checkbox', checked: profile.settings[key] }) }]));
  const settings = h('form', { onsubmit: guarded(async event => {
    event.preventDefault();
    await change(current => {
      current.settings.dailyGoal = Number(goal.value); current.settings.newLimit = Number(limit.value); current.settings.direction = direction.querySelector('select').value; current.settings.theme = theme.querySelector('select').value; current.settings.voice = voice.querySelector('select').value;
      for (const [key, value] of Object.entries(checkboxes)) current.settings[key] = value.input.checked;
    });
    notify('Einstellungen gespeichert.');
  }) }, h('h2', {}, 'Lernen'), h('label', { class: 'field' }, 'Tagesziel: Kartenbewertungen', goal), h('label', { class: 'field' }, 'Neue Karten pro Tag', limit), direction, theme, voice, Object.values(checkboxes).map(item => h('label', { class: 'checkbox' }, item.input, item.label)), h('div', { class: 'actions' }, h('button', { type: 'submit', class: 'primary' }, icon('Check'), 'Speichern')));
  const backupInput = h('input', { type: 'file', accept: '.json,application/json', 'aria-label': 'Lernstand-Sicherung auswählen', onchange: guarded(async event => {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) throw new Error('Sicherung ist größer als 25 MB.');
    const imported = validateBackup(JSON.parse(await file.text()));
    const dialog = modal('Lernstand wiederherstellen', h('p', {}, `${imported.length} Lernplätze, ${imported.reduce((sum, item) => sum + item.reviews.length, 0)} Kartenbewertungen.`), h('p', { class: 'small muted' }, 'Zusammenführen behält neuere Kartenstände und vereint Sammlungen. Ersetzen entfernt die vorhandenen Lernplätze; Wörterbuchdateien bleiben unverändert.'), h('div', { class: 'actions' }, button('Zusammenführen', 'Upload', async () => restore(true)), button('Vorhandenen Lernstand ersetzen', 'RefreshCw', async () => restore(false), { class: 'danger' })));
    async function restore(merge) {
      if (!merge && !confirm('Alle vorhandenen Lernplätze durch diese Sicherung ersetzen?')) return;
      const id = await importProfiles(imported, merge, profile.id);
      profile = await getProfile(id); profiles = await allProfiles();
      dialog.close(); applyTheme(); shell(); render(); notify('Lernstand wiederhergestellt.');
    }
  }) });
  const backup = h('section', {}, h('h2', {}, 'Lernstand sichern'), button('Sicherung exportieren', 'Download', async () => download(`rotwelsch-lernstand-${dayKey()}.json`, JSON.stringify(makeBackup(await allProfiles()), null, 2))), h('label', { class: 'field section' }, 'Sicherung wiederherstellen', backupInput), h('p', { class: 'small muted' }, 'Der Lernstand liegt in diesem Browser. Die Hub-Sicherung erfasst ihn nicht. Ein anderer Host, Port oder Browser hat einen eigenen Speicher.'), h('h3', {}, 'Offline'), h('p', {}, offlineReady ? 'Alle Lerninhalte sind lokal zwischengespeichert.' : offlineError || 'Der Offline-Cache wird vorbereitet.'), button('Offline-Cache prüfen', 'RefreshCw', retryOffline), h('p', { class: 'small muted' }, 'Vorlesen verwendet ausschließlich verfügbare lokale deutsche Stimmen; die Ausgabe ist keine historisch authentische Aussprache.'));
  main.append(h('div', { class: 'settings-grid' }, settings, backup));
  const name = h('input', { required: true, maxlength: 100, 'aria-label': 'Neuer Lernplatz' });
  main.append(h('section', { class: 'section' }, h('h2', {}, 'Lernplätze'), h('form', { onsubmit: guarded(async event => {
    event.preventDefault();
    if (!name.value.trim()) throw new Error('Bitte einen Namen eingeben.');
    if (profiles.length >= 50) throw new Error('Maximal 50 Lernplätze.');
    const created = createProfile(name.value.trim());
    await addProfile(created); await selectProfile(created.id); profile = created; profiles = await allProfiles(); applyTheme(); shell(); render();
  }) }, h('label', { class: 'field' }, 'Neuer Lernplatz', name), h('button', { type: 'submit' }, icon('Plus'), 'Anlegen')), h('div', { class: 'actions' }, button('Lernplatz umbenennen', 'FileText', async () => { const newName = prompt('Neuer Name', profile.name); if (newName?.trim()) { await change(current => { current.name = newName.trim().slice(0, 100); }); shell(); render(); } }), button('Diesen Lernplatz löschen', 'Trash2', async () => { if (confirm(`Lernplatz ${profile.name} samt Fortschritt löschen?`)) { const id = await removeProfile(profile.id); profile = await getProfile(id); profiles = await allProfiles(); applyTheme(); shell(); render(); } }, { class: 'danger', disabled: profiles.length <= 1 }))));
  const word = h('input', { required: true, maxlength: 200 });
  const meaning = h('input', { required: true, maxlength: 500 });
  const evidence = h('textarea', { maxlength: 2000 });
  main.append(h('section', { class: 'section prose' }, h('h2', {}, 'Eigene Ausdrücke'), h('form', { onsubmit: guarded(async event => {
    event.preventDefault();
    if (!word.value.trim() || !meaning.value.trim()) throw new Error('Wort und Bedeutung fehlen.');
    if (profile.custom.length >= 5000) throw new Error('Maximal 5000 eigene Einträge.');
    await change(current => { const entry = privateEntry(word.value, meaning.value, evidence.value); current.custom.push(entry); current.collection.push(entry.id); });
    event.target.reset(); notify('Eigener Ausdruck gespeichert und zur Lernsammlung hinzugefügt.');
  }) }, h('label', { class: 'field' }, 'Ausdruck', word), h('label', { class: 'field' }, 'Bedeutung', meaning), h('label', { class: 'field' }, 'Quelle / eigener Beleg', evidence), h('button', { type: 'submit' }, icon('Plus'), 'Eigener Eintrag')), h('p', { class: 'small muted' }, 'Eigene Einträge bleiben als privat und nicht redaktionell geprüft gekennzeichnet.')));
}

async function setupOffline() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    document.querySelector('#offline-state').textContent = 'Offline-Cache benötigt localhost oder HTTPS';
    return;
  }
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type !== 'OFFLINE_ERROR' || !String(event.source?.scriptURL || '').startsWith(new URL('./', document.baseURI).href)) return;
    offlineError = event.data.message || 'Offline-Einrichtung fehlgeschlagen.';
    updateOfflineState();
    notify(`Offline: ${offlineError}`, true);
  });
  try {
    registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
    const ready = () => { offlineReady = Boolean(navigator.serviceWorker.controller); if (offlineReady) offlineError = ''; updateOfflineState(); };
    let alreadyControlled = Boolean(navigator.serviceWorker.controller);
    const showUpdate = () => {
      if (!navigator.serviceWorker.controller || !registration.waiting || document.querySelector('#apply-update')) return;
      const apply = button('Aktualisierung laden', 'RefreshCw', () => {
        if (profile.session) { notify('Bitte die Lernsitzung erst abschließen. Die Aktualisierung wartet.'); return; }
        registration.waiting?.postMessage('ACTIVATE');
      }, { id: 'apply-update' });
      document.querySelector('.topbar').append(apply);
    };
    showUpdate();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed') showUpdate();
        if (worker.state === 'redundant') {
          if (!offlineError) offlineError = 'Offline-Dateien konnten nicht geladen werden. Erneut versuchen; der vorhandene Lernstand bleibt erhalten.';
          updateOfflineState();
          notify(`Offline: ${offlineError}`, true);
        }
      });
    });
    ready();
    navigator.serviceWorker.addEventListener('controllerchange', () => { ready(); if (alreadyControlled) location.reload(); alreadyControlled = true; });
    navigator.serviceWorker.ready.then(ready);
  } catch (error) { offlineError = error.message; updateOfflineState(); notify(`Offline-Einrichtung: ${error.message}`, true); }
}

async function start() {
  const load = async name => {
    const response = await fetch(`./data/${name}.json`);
    if (!response.ok) throw new Error(`Inhaltsdatei fehlt: ${name}`);
    return response.json();
  };
  const [raw, sources, lessons, texts] = await Promise.all(['dictionary', 'sources', 'lessons', 'texts'].map(load));
  content = assembleData(raw, sources, lessons, texts);
  counts = validateContent(content);
  await openDatabase();
  profiles = await allProfiles();
  profile = await getProfile(await activeId()) || profiles[0];
  applyTheme();
  shell();
  window.addEventListener('hashchange', render);
  window.addEventListener('online', updateOfflineState);
  window.addEventListener('offline', updateOfflineState);
  window.addEventListener('profile-changed', guarded(async () => {
    const fresh = await getProfile(profile.id);
    if (fresh) { profile = fresh; notify('Lernstand aus einem anderen Tab übernommen.'); }
    else { profile = (await allProfiles())[0]; shell(); render(); }
  }));
  window.addEventListener('database-closed', () => notify('Der Lernspeicher wurde aktualisiert. Bitte diese Seite neu laden.', true));
  render();
  setupOffline();
}

start().catch(error => {
  document.querySelector('#app').replaceChildren(h('main', { class: 'main' }, h('h1', {}, 'Rotwelsch lernen'), h('h2', {}, 'Lernmodul konnte nicht geöffnet werden'), h('p', {}, error.message), button('Erneut laden', 'RefreshCw', () => location.reload())));
});