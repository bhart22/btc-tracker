// Generates small logo variants from the full-resolution sources.
//
// The originals are ~1.4-2.1 MB each but are only ever rendered at 26-34 px in the app and
// 32 px on the landing page, so they were shipping roughly 200x more pixels than any screen
// could use. 128 px covers 34 px at 3x DPR with room to spare.
//
//   npm install && npm run images
//
// Writes new files rather than overwriting the sources, so the originals stay in the repo as
// masters. Update the references in app.html / index.html / sw.js if you add a size.
import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const IMAGES = join(dirname(fileURLToPath(import.meta.url)), '..', 'images');
const SIZE = 128;

const TARGETS = [
  { src: 'logo-dark.png',  out: `logo-dark-${SIZE}.png` },
  { src: 'logo-white.png', out: `logo-white-${SIZE}.png` },
];

const kb = n => (n / 1024).toFixed(1) + ' KB';

let before = 0, after = 0;
for (const { src, out } of TARGETS) {
  const srcPath = join(IMAGES, src);
  const outPath = join(IMAGES, out);
  const srcSize = (await stat(srcPath)).size;
  await sharp(srcPath)
    .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true })
    .toFile(outPath);
  const outSize = (await stat(outPath)).size;
  before += srcSize;
  after += outSize;
  console.log(`${src.padEnd(18)} ${kb(srcSize).padStart(10)}  ->  ${out.padEnd(22)} ${kb(outSize).padStart(9)}`);
}
console.log(`\nshipped logo bytes: ${kb(before)} -> ${kb(after)}`);

// Report anything large left in images/ so unused heavyweights don't creep back in
const files = await readdir(IMAGES);
const sizes = await Promise.all(files.map(async f => [f, (await stat(join(IMAGES, f))).size]));
const heavy = sizes.filter(([, s]) => s > 200 * 1024).sort((a, b) => b[1] - a[1]);
if (heavy.length) {
  console.log('\nstill over 200 KB (fine if they are unreferenced masters):');
  heavy.forEach(([f, s]) => console.log(`  ${f.padEnd(22)} ${kb(s).padStart(10)}`));
}
