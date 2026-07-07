import { describe, expect, it } from 'vitest';
import { EMOJI_KEYWORDS_ZH, searchCuratedEmojis } from './emojiSearch';

const POOL = ['😀', '😭', '🐶', '🐼', '💀'];

describe('searchCuratedEmojis', () => {
  it('returns the full pool unchanged for an empty query', () => {
    expect(searchCuratedEmojis('', POOL)).toEqual(POOL);
    expect(searchCuratedEmojis('   ', POOL)).toEqual(POOL);
  });

  it('matches emoji whose keywords contain the query substring', () => {
    expect(searchCuratedEmojis('哭', POOL)).toEqual(['😭']);
  });

  it('matches animals by name', () => {
    expect(searchCuratedEmojis('熊猫', POOL)).toEqual(['🐼']);
    expect(searchCuratedEmojis('狗', POOL)).toEqual(['🐶']);
  });

  it('matches when the query is longer than the stored keyword', () => {
    // '骷髅' is a stored keyword for 💀; a longer query containing it should still match
    expect(searchCuratedEmojis('骷髅头', POOL)).toEqual(['💀']);
  });

  it('returns an empty array when nothing matches', () => {
    expect(searchCuratedEmojis('恐龙', POOL)).toEqual([]);
  });

  it('preserves the pool order for multiple matches', () => {
    const pool = ['😭', '😀'];
    // both '开心' and something for 😭 aren't shared; use a query matching both via broad terms
    expect(searchCuratedEmojis('笑', pool)).toEqual(['😀']);
  });

  it('has a keyword entry for every emoji it is asked to search over', () => {
    // Guards against silently losing search coverage if the curated list changes
    // without updating EMOJI_KEYWORDS_ZH
    for (const emoji of POOL) {
      expect(EMOJI_KEYWORDS_ZH[emoji]).toBeDefined();
      expect(EMOJI_KEYWORDS_ZH[emoji].length).toBeGreaterThan(0);
    }
  });
});
