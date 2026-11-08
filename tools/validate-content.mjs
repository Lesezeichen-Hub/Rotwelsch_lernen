import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { assembleData } from '../js/data.js';
import { validateContent } from '../js/content.js';
const load = async name => JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const content = assembleData(await load('dictionary'), await load('sources'), await load('lessons'), await load('texts'));
const counts = validateContent(content);
for (const scan of new Set([...content.entries, ...content.texts].map(item => item.scan).filter(Boolean))) await readFile(new URL(`../${scan}`, import.meta.url));
const provenance = JSON.parse(await readFile(new URL('../assets/sources/provenance.json', import.meta.url), 'utf8'));
for (const file of provenance.files) {
	const bytes = await readFile(new URL(`../assets/sources/${file.filename}`, import.meta.url));
	if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`Quellendatei verändert: ${file.filename}`);
}
const report = {
	version: content.version, ...counts,
	historical: content.entries.filter(entry => entry.status === 'scan-reviewed').length,
	secondary: content.entries.filter(entry => entry.status === 'secondary-referenced').length,
	current: content.entries.filter(entry => entry.current).length,
	localScans: provenance.files.filter(file => file.printedPage).length,
	collections: content.sources.map(source => ({ id: source.id, title: source.title, entries: content.entries.filter(entry => entry.source === source.id).length })),
};
if (process.argv.includes('--report')) await writeFile(new URL('../data/inventory.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));