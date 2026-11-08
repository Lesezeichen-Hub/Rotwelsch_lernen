import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../../tools/serve.mjs';

test('statische App auf Root und verschachteltem Hub-Pfad; interne Dateien gesperrt', async () => {
  const running = await startServer();
  try {
    for (const suffix of ['/', '/index.html', '/modules/7/', '/modules/7/index.html']) {
      const response = await fetch(running.url + suffix);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /Rotwelsch lernen/);
    }
    for (const suffix of ['/missing.json', '/.git/config', '/node_modules/ts-fsrs/package.json']) {
      assert.equal((await fetch(running.url + suffix)).status, 404);
    }
  } finally {
    await running.close();
  }
});