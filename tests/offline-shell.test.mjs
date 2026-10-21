import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const serviceWorker = await readFile('dist/sw.js', 'utf8');
const indexHtml = await readFile('dist/index.html', 'utf8');
const buildAssets = serviceWorker.match(/const BUILD_ASSETS = (\[[^\n]*\]);/);

assert.ok(buildAssets, 'o service worker precisa receber o manifesto do build');
const precache = new Set(JSON.parse(buildAssets[1]));
assert.ok(precache.size > 0, 'o manifesto offline não pode ficar vazio');
assert.ok([...precache].some((path) => path.endsWith('.js')), 'o shell precisa pré-carregar JavaScript');
assert.ok([...precache].some((path) => path.endsWith('.css')), 'o shell precisa pré-carregar CSS');
for (const asset of indexHtml.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)) {
  assert.ok(precache.has(asset[1]), `o asset principal ${asset[1]} precisa estar no precache`);
}
assert.ok(serviceWorker.includes("'/index.html'"), 'o fallback de navegação precisa guardar index.html');
assert.equal(precache.has('/server.cjs'), false, 'o bundle do servidor nunca deve ser armazenado no cache do app');

console.log(`Offline shell validado: ${precache.size} assets pré-carregados.`);
