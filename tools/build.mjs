import { build } from 'esbuild';
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assembleData } from '../js/data.js';
import { validateContent } from '../js/content.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const load = async name => JSON.parse(await readFile(path.join(root, `data/${name}.json`), 'utf8'));
const data = assembleData(await load('dictionary'), await load('sources'), await load('lessons'), await load('texts'));
console.log('Inhalte:', validateContent(data));
await mkdir(path.join(root, 'assets/fonts'), { recursive: true });
await mkdir(path.join(root, 'assets/licenses'), { recursive: true });
for (const [name, font, weight] of [['sans', 'source-sans-3', 400], ['sans-bold', 'source-sans-3', 600], ['serif', 'source-serif-4', 400], ['serif-bold', 'source-serif-4', 600]]) {
  await copyFile(path.join(root, `node_modules/@fontsource/${font}/files/${font}-latin-${weight}-normal.woff2`), path.join(root, `assets/fonts/${name}.woff2`));
}
for (const [source, target] of [['ts-fsrs/LICENSE', 'ts-fsrs.txt'], ['lucide/LICENSE', 'lucide.txt'], ['@fontsource/source-sans-3/LICENSE', 'source-sans-3.txt'], ['@fontsource/source-serif-4/LICENSE', 'source-serif-4.txt']]) {
  await copyFile(path.join(root, `node_modules/${source}`), path.join(root, `assets/licenses/${target}`));
}
await build({ absWorkingDir: root, entryPoints: ['js/app.js'], outfile: 'assets/app.js', bundle: true, format: 'esm', target: ['chrome110', 'firefox115', 'safari16'], minify: true, legalComments: 'eof' });
const assets = ['index.html', 'manifest.webmanifest', 'js/theme-boot.js', 'assets/app.js', 'css/app.css', 'data/dictionary.json', 'data/lessons.json', 'data/texts.json', 'data/sources.json'];
for (const directory of ['assets/fonts', 'assets/licenses', 'assets/sources', 'assets/icons']) {
  for (const filename of await readdir(path.join(root, directory))) assets.push(`${directory}/${filename}`);
}
const template = await readFile(path.join(root, 'tools/sw-template.js'), 'utf8');
const fingerprint = createHash('sha256').update(metadata.version).update(template);
for (const filename of assets) fingerprint.update(filename).update(await readFile(path.join(root, filename)));
const version = fingerprint.digest('hex').slice(0, 16);
await writeFile(path.join(root, 'assets/precache.json'), JSON.stringify({ version, assets }, null, 2) + '\n');
await writeFile(path.join(root, 'sw.js'), template.replace('__BUILD_VERSION__', version));
await writeFile(path.join(root, 'version.json'), JSON.stringify({ version: metadata.version, build: version, content: data.version, ...validateContent(data) }, null, 2) + '\n');
console.log(`Offline-Build ${version}: ${assets.length} lokale Dateien`);