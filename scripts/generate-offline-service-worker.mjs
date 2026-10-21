import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('dist');
const assetsDir = path.join(distDir, 'assets');
const templatePath = path.resolve('public/sw.js');
const outputPath = path.join(distDir, 'sw.js');
const sourceAssetPattern = /\.(?:js|mjs|css|svg|png|jpe?g|webp|woff2?|ttf)$/i;

async function listAssets(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) return listAssets(path.join(directory, entry.name), relativePath);
    return sourceAssetPattern.test(entry.name) ? [`/assets/${relativePath}`] : [];
  }));
  return files.flat();
}

const buildAssets = (await listAssets(assetsDir)).sort();
if (!buildAssets.some((asset) => asset.endsWith('.js')) || !buildAssets.some((asset) => asset.endsWith('.css'))) {
  throw new Error('Não encontrei os arquivos JavaScript e CSS do app em dist/assets.');
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
console.log(`Service worker preparado para offline: ${buildAssets.length} arquivos da versão ${buildId}.`);
