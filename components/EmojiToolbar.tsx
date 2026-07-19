'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { m } from 'framer-motion';
import { searchCuratedEmojis, POPULAR_EMOJIS, CURATED_EMOJI_POOL } from '@/lib/emojiSearch';
import { useI18n } from '@/lib/i18n';
import { Dice, Search } from '@/components/icons';
import SegmentedControl from '@/components/SegmentedControl';
import { getTwemojiUrl } from '@/lib/twemoji';
import { DetectionMode } from '@/types';

interface EmojiToolbarProps {
  onEmojiSelect: (emoji: string) => void;
  selectedEmoji: string | null;
  emojiSize: number;
  onEmojiSizeChange: (size: number) => void;
  detectionMode: DetectionMode;
  onDetectionModeChange: (mode: DetectionMode) => void;
}

const EMOJI_SIZE_TIERS: { value: 'small' | 'standard' | 'large'; size: number }[] = [
  { value: 'small', size: 0.9 },
  { value: 'standard', size: 1.2 },
  { value: 'large', size: 1.5 },
];

// Search + dice + featured emoji grid + size slider. Shared by the
// mobile-docked toolbar, the medium flowing card, and the desktop right
// column — only the outer container around this component differs; the
// grid itself already responds to viewport width (a horizontal scroll row
// below md, a wrapping grid at md and up).
export default function EmojiToolbar({
  onEmojiSelect,
  selectedEmoji,
  emojiSize,
  onEmojiSizeChange,
  detectionMode,
  onDetectionModeChange,
}: EmojiToolbarProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  // Emojis whose Twemoji image failed to load — rendered as native glyphs instead.
  const [imageFailed, setImageFailed] = useState<Set<string>>(new Set());

  const selectedSizeTier = useMemo(
    () =>
      EMOJI_SIZE_TIERS.reduce((closest, tier) =>
        Math.abs(tier.size - emojiSize) < Math.abs(closest.size - emojiSize) ? tier : closest
      ).value,
    [emojiSize]
  );

  const filteredCurated = useMemo(
    () => searchCuratedEmojis(searchQuery, CURATED_EMOJI_POOL),
    [searchQuery]
  );

  useEffect(() => {
    if (!selectedEmoji) return;
    const el = buttonRefs.current.get(selectedEmoji);
    if (!el) return;
    const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth';
    // inline: 'center' (not 'nearest') — with scroll-snap on the row,
    // 'nearest' can settle with the target only partially visible at the
    // right edge (e.g. after a random pick near the end of the row).
    el.scrollIntoView({ block: 'nearest', inline: 'center', behavior });
  }, [selectedEmoji]);

  const handleRandomEmoji = () => {
    const randomEmoji = POPULAR_EMOJIS[Math.floor(Math.random() * POPULAR_EMOJIS.length)];
    onEmojiSelect(randomEmoji);
  };

  return (
    <div className="w-full space-y-2 md:space-y-3">
      {/* Search + dice */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t.emojiToolbar.searchPlaceholder}
            className="w-full h-11 pl-10 pr-4 rounded-xl border-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900/50 text-sm font-medium text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400/70 focus:border-blue-300/60 transition-colors"
          />
        </div>
        <m.button
          type="button"
          onClick={handleRandomEmoji}
          whileHover={{ scale: 1.05, rotate: 180 }}
          whileTap={{ scale: 0.95 }}
          className="w-11 h-11 shrink-0 flex items-center justify-center bg-gradient-to-r from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600 text-white rounded-xl font-black text-lg shadow-[0_4px_0_0_#e11d48] active:shadow-none active:translate-y-1 transition-all"
          title={t.emojiToolbar.randomTitle}
          aria-label={t.emojiToolbar.randomTitle}
        >
          <Dice size={20} />
        </m.button>
      </div>

      {/* Featured emoji — horizontal scroll row below md, wrapping grid at md+ */}
      {filteredCurated.length > 0 ? (
        <div className="flex gap-1.5 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-1 md:grid md:grid-cols-10 md:gap-1 md:overflow-visible md:snap-none md:pb-0 md:max-h-[8.75rem] md:overflow-y-auto">
          {filteredCurated.map((emoji) => {
            const isSelected = emoji === selectedEmoji;
            return (
              <button
                key={emoji}
                type="button"
                ref={(el) => {
                  if (el) buttonRefs.current.set(emoji, el);
                  else buttonRefs.current.delete(emoji);
                }}
                onClick={() => onEmojiSelect(emoji)}
                className={`shrink-0 snap-start w-11 h-11 md:w-auto md:h-auto flex items-center justify-center text-2xl md:p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 active:scale-90 transition-all ${
                  isSelected ? 'ring-2 ring-inset ring-blue-400 bg-blue-50 dark:bg-blue-900/30' : ''
                }`}
                title={emoji}
              >
                {imageFailed.has(emoji) ? (
                  emoji
                ) : (
                  <img
                    src={getTwemojiUrl(emoji)}
                    alt={emoji}
                    loading="lazy"
                    draggable={false}
                    className="w-6 h-6"
                    onError={() =>
                      setImageFailed((prev) => new Set(prev).add(emoji))
                    }
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">{t.emojiToolbar.noMatch}</p>
      )}

      {/* Emoji size */}
      <div className="flex items-center gap-2 md:gap-3">
        <span className="text-sm font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">
          {t.emojiToolbar.sizeLabel}
        </span>
        <SegmentedControl
          options={EMOJI_SIZE_TIERS.map((tier) => ({
            value: tier.value,
            label: t.emojiToolbar.sizeTiers[tier.value],
          }))}
          value={selectedSizeTier}
          onChange={(tier) =>
            onEmojiSizeChange(EMOJI_SIZE_TIERS.find((t) => t.value === tier)!.size)
          }
          ariaLabel={t.emojiToolbar.sizeLabel}
        />
      </div>

      {/* Detection sensitivity */}
      <div className="flex items-center gap-2 md:gap-3">
        <span className="text-sm font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">
          {t.detectionMode.aria}
        </span>
        <SegmentedControl
          options={(['relaxed', 'standard', 'strict'] as const).map((mode) => ({
            value: mode,
            label: t.detectionMode[mode],
          }))}
          value={detectionMode}
          onChange={onDetectionModeChange}
          ariaLabel={t.detectionMode.aria}
        />
      </div>
    </div>
  );
}
