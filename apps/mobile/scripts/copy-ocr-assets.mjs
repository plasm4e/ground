// Copies the in-browser OCR engine (tesseract.js) and its language data into the web export,
// so the app reads photos without any paid service and without depending on a CDN.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const out = path.resolve(import.meta.dirname, '../dist/ocr');
const pkgDir = (name) => path.dirname(require.resolve(`${name}/package.json`));

mkdirSync(path.join(out, 'core'), { recursive: true });
mkdirSync(path.join(out, 'lang'), { recursive: true });

for (const f of ['tesseract.min.js', 'worker.min.js']) {
  copyFileSync(path.join(pkgDir('tesseract.js'), 'dist', f), path.join(out, f));
}

// Only the LSTM builds are used (the language data below is LSTM-only).
const core = pkgDir('tesseract.js-core');
for (const f of readdirSync(core).filter((f) => f.includes('-lstm.'))) {
  copyFileSync(path.join(core, f), path.join(out, 'core', f));
}

for (const lang of ['eng', 'spa', 'ita', 'fra', 'por']) {
  const file = `${lang}.traineddata.gz`;
  copyFileSync(path.join(pkgDir(`@tesseract.js-data/${lang}`), '4.0.0_best_int', file), path.join(out, 'lang', file));
}

console.log(`OCR assets copied to ${out}`);
