// Rasterises src/assets/logo.svg at each size Chrome uses, straight from the
// vector at the target size (no downscaling blur).
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const svg = await readFile(new URL('../src/assets/logo.svg', import.meta.url));

for (const size of [16, 32, 48, 96, 128]) {
  // 72 dpi renders the 128-unit viewBox at 128 px; scale density to hit the size exactly.
  await sharp(svg, { density: (72 * size) / 128 })
    .resize(size, size)
    .png()
    .toFile(new URL(`../src/public/icon/${size}.png`, import.meta.url).pathname);
}
console.log('icons written to src/public/icon/');
