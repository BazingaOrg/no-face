'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { m } from 'framer-motion';
import { searchCuratedEmojis, POPULAR_EMOJIS, CURATED_EMOJI_POOL } from '@/lib/emojiSearch';
import { useI18n } from '@/lib/i18n';
import { Dice, Search } from '@/components/icons';

interface EmojiToolbarProps {
  onEmojiSelect: (emoji: string) => void;
  selectedEmoji: string | null;
  emojiSize: number;
  onEmojiSizeChange: (size: number) => void;
}

const MIN_EMOJI_SIZE = 0.8;
const MAX_EMOJI_SIZE = 1.6;

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
}: EmojiToolbarProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

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
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior });
  }, [selectedEmoji]);

  const handleRandomEmoji = () => {
    const randomEmoji = POPULAR_EMOJIS[Math.floor(Math.random() * POPULAR_EMOJIS.length)];
    onEmojiSelect(randomEmoji);
  };

  return (
    <div className="w-full space-y-3">
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
        <div className="flex gap-1.5 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-1 md:grid md:grid-cols-10 md:gap-1 md:overflow-visible md:snap-none md:pb-0 md:max-h-56 md:overflow-y-auto lg:max-h-64">
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
                {emoji}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">{t.emojiToolbar.noMatch}</p>
      )}

      {/* Size slider */}
      <div className="flex items-center gap-3">
        <label
          htmlFor="emoji-size-slider"
          className="text-sm font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap"
        >
          {t.emojiToolbar.sizeLabel}
        </label>
        <input
          id="emoji-size-slider"
          type="range"
          min={MIN_EMOJI_SIZE}
          max={MAX_EMOJI_SIZE}
          step={0.05}
          value={emojiSize}
          onChange={(event) => onEmojiSizeChange(parseFloat(event.target.value))}
          className="flex-1 h-2 bg-gray-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500"
        />
      </div>
    </div>
  );
}
