import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const serviceWorker = await readFile('dist/sw.js', 'utf8');
const indexHtml = await readFile('dist/index.html', 'utf8');
const assetFiles = await readdir('dist/assets');
const buildAssets = serviceWorker.match(/const BUILD_ASSETS = (\[[^\n]*\]);/);

assert.ok(buildAssets, 'o service worker precisa receber o manifesto do build');
const precache = new Set(JSON.parse(buildAssets[1]));
assert.ok(precache.size > 0, 'o manifesto offline não pode ficar vazio');
assert.ok([...precache].some((path) => path.endsWith('.js')), 'o shell precisa pré-carregar JavaScript');
assert.ok([...precache].some((path) => path.endsWith('.css')), 'o shell precisa pré-carregar CSS');
for (const asset of indexHtml.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)) {
  assert.ok(precache.has(asset[1]), `o asset principal ${asset[1]} precisa estar no precache`);
}
const shellAssets = [...indexHtml.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]).sort();
const precachedAppAssets = [...precache].filter((path) => path.startsWith('/assets/')).sort();
assert.deepEqual(precachedAppAssets, shellAssets, 'somente os arquivos necessários para abrir o shell devem ser pré-carregados');
const lazyScript = assetFiles.find((file) => file.endsWith('.js') && !shellAssets.includes(`/assets/${file}`));
assert.ok(lazyScript, 'o build precisa conter pelo menos um módulo carregado sob demanda');
assert.ok(!precache.has(`/assets/${lazyScript}`), 'módulos sob demanda não devem atrasar a instalação do cache offline');
assert.ok(serviceWorker.includes('if (!isPrecached && !isStaticAsset) return'), 'recursos adicionais precisam continuar elegíveis ao cache durante o uso');
assert.ok(serviceWorker.includes('await cache.put(request, response.clone())'), 'recursos solicitados precisam ser guardados para acesso offline posterior');
assert.ok(serviceWorker.includes("'/index.html'"), 'o fallback de navegação precisa guardar index.html');
assert.equal(precache.has('/server.cjs'), false, 'o bundle do servidor nunca deve ser armazenado no cache do app');

console.log(`Offline shell validado: ${precache.size} arquivos iniciais; módulos adicionais são armazenados ao serem acessados.`);
