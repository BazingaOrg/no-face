'use client';

import { useEffect, useMemo, useState } from 'react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { m, AnimatePresence } from 'framer-motion';
import { searchCuratedEmojis, POPULAR_EMOJIS, CURATED_EMOJI_POOL } from '@/lib/emojiSearch';

interface EmojiSelectorProps {
  onEmojiSelect: (emoji: string) => void;
  selectedEmoji: string | null;
  isOpen: boolean;
  onToggle: () => void;
  replacedCount?: number;
  totalFaces?: number;
}

export default function EmojiSelector({
  onEmojiSelect,
  selectedEmoji,
  isOpen,
  onToggle,
  replacedCount = 0,
  totalFaces = 0,
}: EmojiSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFullPicker, setShowFullPicker] = useState(false);

  // Start fresh each time the panel is reopened
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setShowFullPicker(false);
    }
  }, [isOpen]);

  const filteredCurated = useMemo(
    () => searchCuratedEmojis(searchQuery, CURATED_EMOJI_POOL),
    [searchQuery]
  );

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
  };

  const handleRandomEmoji = () => {
    const randomEmoji = POPULAR_EMOJIS[Math.floor(Math.random() * POPULAR_EMOJIS.length)];
    onEmojiSelect(randomEmoji);
  };

  return (
    <div className="w-full space-y-4">
      {/* Button group with emoji selector and random button */}
      <div className="flex items-center gap-3 justify-center">
        {/* Emoji selector button - Duolingo Style */}
        <m.button
          onClick={onToggle}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="py-3 px-5 text-lg btn-duo btn-secondary justify-between max-w-xs flex-1"
        >
          <span>
            {selectedEmoji ? (
              <span className="flex items-center gap-2">
                <span className="text-2xl">{selectedEmoji}</span>
                <span>当前表情</span>
              </span>
            ) : (
              '🎨 选择表情'
            )}
          </span>
          <svg
            className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </m.button>

        {/* Random emoji button */}
        <m.button
          onClick={handleRandomEmoji}
          whileHover={{ scale: 1.05, rotate: 180 }}
          whileTap={{ scale: 0.95 }}
          className="py-3 px-4 bg-gradient-to-r from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600 text-white rounded-2xl font-black text-lg shadow-lg transition-all border-b-4 border-rose-600 active:border-b-0 active:mt-1"
          title="随机表情"
        >
          🎲
        </m.button>
      </div>

      {/* Emoji picker - Chinese search over the curated set by default;
          the full ~3600-emoji picker (English search only) stays lazy-loaded
          behind an explicit toggle */}
      <AnimatePresence>
        {isOpen && (
          <m.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden mt-4"
          >
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-4 border-2 border-gray-200 dark:border-slate-700 space-y-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜索表情，比如「笑」「猫」「生气」..."
                className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900/50 text-sm font-medium text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400/70 focus:border-blue-300/60 transition-colors"
              />

              {filteredCurated.length > 0 ? (
                <div className="grid grid-cols-8 sm:grid-cols-10 gap-1 max-h-56 overflow-y-auto">
                  {filteredCurated.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => onEmojiSelect(emoji)}
                      className="text-2xl p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 active:scale-90 transition-all"
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">
                  🙈 没找到匹配的表情，试试展开完整表情库
                </p>
              )}

              <button
                type="button"
                onClick={() => setShowFullPicker((prev) => !prev)}
                className="w-full text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline text-center py-1"
              >
                {showFullPicker ? '▲ 收起完整表情库' : '▼ 展开完整表情库（3600+，英文搜索）'}
              </button>

              {showFullPicker && (
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  theme={Theme.AUTO}
                  skinTonesDisabled
                  searchPlaceHolder="Search in English..."
                  width="100%"
                  height={350}
                  previewConfig={{
                    showPreview: false,
                  }}
                />
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Instruction text - Dynamic based on state */}
      {!isOpen && (
        <m.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-base font-bold text-gray-700 dark:text-gray-300 mt-2"
          key={`${selectedEmoji}-${replacedCount}-${totalFaces}`}
        >
          {!selectedEmoji ? (
            '👈 先选择或随机一个表情'
          ) : replacedCount === 0 ? (
            '👆 点击人脸应用表情，或点击全部替换'
          ) : replacedCount === totalFaces ? (
            '✨ 可单独调整人脸，或重新随机选择'
          ) : (
            `👆 继续点击其他人脸 (${replacedCount}/${totalFaces})`
          )}
        </m.p>
      )}
    </div>
  );
}
