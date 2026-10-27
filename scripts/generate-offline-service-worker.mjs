import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('dist');
const templatePath = path.resolve('public/sw.js');
const outputPath = path.join(distDir, 'sw.js');
const html = await readFile(path.join(distDir, 'index.html'), 'utf8');
const buildAssets = [...new Set(
  [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]),
)].sort();
if (!buildAssets.some((asset) => asset.endsWith('.js')) || !buildAssets.some((asset) => asset.endsWith('.css'))) {
  throw new Error('Não encontrei o JavaScript e o CSS iniciais do app em dist/index.html.');
}

const template = await readFile(templatePath, 'utf8');
const marker = 'const BUILD_ASSETS = []; // INJECT_BUILD_ASSETS';
if (!template.includes(marker)) throw new Error('Marcador do precache não encontrado em public/sw.js.');

const allAssets = ['/','/index.html','/manifest.json','/representapro-icon.svg', ...buildAssets];
const buildId = createHash('sha256').update(allAssets.join('\n')).digest('hex').slice(0, 12);
const serviceWorker = template
  .replace("const CACHE_NAME = 'representapro-cache-dev';", `const CACHE_NAME = 'representapro-cache-${buildId}';`)
  .replace(marker, `const BUILD_ASSETS = ${JSON.stringify(buildAssets)};`);

await writeFile(outputPath, serviceWorker);
console.log(`Service worker preparado: ${buildAssets.length} arquivos iniciais pré-carregados; telas e recursos adicionais serão guardados ao serem acessados.`);
