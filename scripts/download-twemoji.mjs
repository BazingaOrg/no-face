#!/usr/bin/env node
/**
 * One-time tool: download Twemoji SVGs for every emoji in CURATED_EMOJI_POOL
 * into public/emoji/, so the app can self-host them instead of depending on
 * a CDN at runtime.
 *
 * Filename convention mirrors lib/twemoji.ts's getEmojiCodepoint(): strip
 * variation selectors (FE0F/FE0E) unless the sequence contains a ZWJ.
 *
 * Usage: node scripts/download-twemoji.mjs
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outDir = path.join(repoRoot, 'public', 'emoji');

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/';

function getEmojiCodepoint(emoji) {
  const codepoints = [];
  for (const char of emoji) {
    const codepoint = char.codePointAt(0);
    if (codepoint !== undefined) codepoints.push(codepoint.toString(16));
  }
  const hasZwj = codepoints.includes('200d');
  const filtered = hasZwj
    ? codepoints
    : codepoints.filter((hex) => hex !== 'fe0f' && hex !== 'fe0e');
  return filtered.join('-');
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadOne(emoji, attempt = 1) {
  const codepoint = getEmojiCodepoint(emoji);
  const filename = `${codepoint}.svg`;
  const filePath = path.join(outDir, filename);

  if (await fileExists(filePath)) {
    return { emoji, codepoint, status: 'skipped' };
  }

  const url = `${TWEMOJI_BASE}${filename}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const text = await response.text();
    await writeFile(filePath, text, 'utf8');
    return { emoji, codepoint, status: 'downloaded' };
  } catch (error) {
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      return downloadOne(emoji, attempt + 1);
    }
    return { emoji, codepoint, status: 'failed', error: String(error) };
  }
}

async function main() {
  // Load the curated pool from the TS source without a build step: extract
  // the array literal via a tiny regex-free parse is fragile, so instead we
  // dynamically import via a small transpile-free trick — read the file and
  // eval just isn't safe either. Simplest robust option: use Node's
  // experimental TS support isn't guaranteed, so parse the exported array
  // manually with a restricted regex over emoji characters only.
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(path.join(repoRoot, 'lib', 'emojiSearch.ts'), 'utf8');

  const match = source.match(/export const POPULAR_EMOJIS = \[([\s\S]*?)\];/);
  if (!match) {
    throw new Error('Could not find POPULAR_EMOJIS in lib/emojiSearch.ts');
  }
  const body = match[1];
  // Extract every quoted string literal ('...' or "...") from the array body.
  const emojiMatches = [...body.matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] ?? m[2]);
  const pool = [...new Set(emojiMatches)];

  if (pool.length === 0) {
    throw new Error('Parsed an empty emoji pool — check the regex against lib/emojiSearch.ts');
  }

  await mkdir(outDir, { recursive: true });

  console.log(`Downloading ${pool.length} Twemoji SVGs to ${path.relative(repoRoot, outDir)}/...`);

  const results = [];
  // Sequential with small concurrency to be polite to the CDN.
  const concurrency = 8;
  let index = 0;
  async function worker() {
    while (index < pool.length) {
      const emoji = pool[index++];
      const result = await downloadOne(emoji);
      results.push(result);
      process.stdout.write(
        `[${results.length}/${pool.length}] ${result.status}: ${emoji} -> ${result.codepoint}.svg\n`
      );
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  const downloaded = results.filter((r) => r.status === 'downloaded').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const failed = results.filter((r) => r.status === 'failed');

  console.log(`\nDone. downloaded=${downloaded} skipped=${skipped} failed=${failed.length} total=${pool.length}`);

  if (failed.length > 0) {
    console.error('\nFailed downloads:');
    for (const f of failed) {
      console.error(`  ${f.emoji} (${f.codepoint}.svg): ${f.error}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
