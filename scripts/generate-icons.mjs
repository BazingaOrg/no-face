#!/usr/bin/env node
/**
 * One-time tool: render public/icon.svg into the various PNG favicon sizes
 * the app links to, plus a PNG-embedded app/favicon.ico, so the app ships
 * self-generated raster icons instead of depending on an external tool.
 *
 * Usage: node scripts/generate-icons.mjs [source] [--crop left,top,size]
 *   source defaults to public/icon.svg; --crop extracts a square region
 *   first (useful for photo sources where small sizes need a tight crop).
 */
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const cropIndex = args.indexOf('--crop');
const crop =
  cropIndex !== -1
    ? (() => {
        const [left, top, size] = args[cropIndex + 1].split(',').map(Number);
        return { left, top, width: size, height: size };
      })()
    : null;
const sourceArg = args.find((a, i) => !a.startsWith('--') && i !== cropIndex + 1);
const sourcePath = path.join(repoRoot, sourceArg ?? path.join('public', 'icon.svg'));

const TARGETS = [
  { name: 'favicon-16x16.png', size: 16, dir: 'public' },
  { name: 'favicon-32x32.png', size: 32, dir: 'public' },
  { name: 'apple-touch-icon.png', size: 180, dir: 'public' },
  { name: 'android-chrome-192x192.png', size: 192, dir: 'public' },
  { name: 'android-chrome-512x512.png', size: 512, dir: 'public' },
];

function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const entrySize = 16;
  const dataOffset = headerSize + entrySize * count;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4); // image count

  const entries = [];
  let offset = dataOffset;
  for (const { size, buffer } of pngBuffers) {
    const entry = Buffer.alloc(entrySize);
    entry.writeUInt8(size, 0); // width
    entry.writeUInt8(size, 1); // height
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buffer.length, 8); // bytes in resource
    entry.writeUInt32LE(offset, 12); // image offset
    entries.push(entry);
    offset += buffer.length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.buffer)]);
}

async function main() {
  const written = [];

  let icoBuffers = {};
  for (const target of TARGETS) {
    const outPath = path.join(repoRoot, target.dir, target.name);
    let source = sharp(sourcePath);
    if (crop) source = source.extract(crop);
    const buffer = await source.resize(target.size, target.size).png().toBuffer();
    await sharp(buffer).toFile(outPath);
    written.push(`${target.dir}/${target.name} (${target.size}x${target.size})`);
    if (target.size === 16 || target.size === 32) {
      icoBuffers[target.size] = buffer;
    }
  }

  const icoPath = path.join(repoRoot, 'app', 'favicon.ico');
  const ico = buildIco([
    { size: 16, buffer: icoBuffers[16] },
    { size: 32, buffer: icoBuffers[32] },
  ]);
  await writeFile(icoPath, ico);
  written.push(`app/favicon.ico (16x16 + 32x32 embedded)`);

  console.log(`Generated ${written.length} icon files from ${sourceArg ?? 'public/icon.svg'}:`);
  for (const w of written) {
    console.log(`  ${w}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
