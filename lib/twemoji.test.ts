import { describe, expect, it } from 'vitest';
import { getTwemojiUrl } from './twemoji';

const CDN = '/emoji/';

describe('getTwemojiUrl', () => {
  it('converts a simple emoji to its codepoint', () => {
    expect(getTwemojiUrl('😀')).toBe(`${CDN}1f600.svg`);
  });

  it('strips FE0F in non-ZWJ sequences (Twemoji filename convention)', () => {
    // ☹️ = U+2639 U+FE0F → "2639.svg"
    expect(getTwemojiUrl('☹️')).toBe(`${CDN}2639.svg`);
    // #️⃣ keycap = U+0023 U+FE0F U+20E3 → "23-20e3.svg"
    expect(getTwemojiUrl('#️⃣')).toBe(`${CDN}23-20e3.svg`);
  });

  it('keeps FE0F inside ZWJ sequences', () => {
    // ❤️‍🔥 = U+2764 U+FE0F U+200D U+1F525
    expect(getTwemojiUrl('❤️‍🔥')).toBe(`${CDN}2764-fe0f-200d-1f525.svg`);
    // 🏳️‍🌈 = U+1F3F3 U+FE0F U+200D U+1F308
    expect(getTwemojiUrl('🏳️‍🌈')).toBe(`${CDN}1f3f3-fe0f-200d-1f308.svg`);
  });

  it('handles skin-tone modifiers and multi-person ZWJ sequences', () => {
    expect(getTwemojiUrl('👍🏽')).toBe(`${CDN}1f44d-1f3fd.svg`);
    // 🧑‍🚀 = U+1F9D1 U+200D U+1F680 (no FE0F involved)
    expect(getTwemojiUrl('🧑‍🚀')).toBe(`${CDN}1f9d1-200d-1f680.svg`);
  });

  it('handles flag sequences (regional indicators)', () => {
    expect(getTwemojiUrl('🇯🇵')).toBe(`${CDN}1f1ef-1f1f5.svg`);
  });
});
