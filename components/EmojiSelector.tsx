'use client';

import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { searchEmojis } from '@/lib/emojiSearch';

interface EmojiSelectorProps {
  onEmojiSelect: (emoji: string) => void;
  selectedEmoji: string | null;
  isOpen: boolean;
  onToggle: () => void;
}

// Commonly used emojis for face replacement
const POPULAR_EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
  '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
  '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫',
  '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
  '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢',
  '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸',
  '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲',
  '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱',
  '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠',
  '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻',
  '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽',
  '🙀', '😿', '😾',
];

export default function EmojiSelector({
  onEmojiSelect,
  selectedEmoji,
  isOpen,
  onToggle,
}: EmojiSelectorProps) {
  const [chineseQuery, setChineseQuery] = useState('');
  const [chineseSearchResults, setChineseSearchResults] = useState<string[]>([]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    setChineseQuery('');
    setChineseSearchResults([]);
  };

  const handleRandomEmoji = () => {
    const randomEmoji = POPULAR_EMOJIS[Math.floor(Math.random() * POPULAR_EMOJIS.length)];
    onEmojiSelect(randomEmoji);
  };

  // Handle Chinese search
  const handleChineseSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setChineseQuery(query);

    if (query.trim()) {
      const results = searchEmojis(query);
      setChineseSearchResults(results);
    } else {
      setChineseSearchResults([]);
    }
  };

  // Handle clicking search result emoji
  const handleSearchResultClick = (emoji: string) => {
    onEmojiSelect(emoji);
    setChineseQuery('');
    setChineseSearchResults([]);
  };

  return (
    <div className="w-full space-y-4">
      {/* Button group with emoji selector and random button */}
      <div className="flex items-center gap-3 justify-center">
        {/* Emoji selector button - Duolingo Style */}
        <motion.button
          onClick={onToggle}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="py-3 px-5 bg-gradient-to-r from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600 text-white rounded-2xl font-black text-lg shadow-lg transition-all flex items-center justify-between border-b-4 border-purple-600 active:border-b-0 active:mt-1 max-w-xs flex-1"
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
        </motion.button>

        {/* Random emoji button */}
        <motion.button
          onClick={handleRandomEmoji}
          whileHover={{ scale: 1.05, rotate: 180 }}
          whileTap={{ scale: 0.95 }}
          className="py-3 px-4 bg-gradient-to-r from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600 text-white rounded-2xl font-black text-lg shadow-lg transition-all border-b-4 border-rose-600 active:border-b-0 active:mt-1"
          title="随机表情"
        >
          🎲
        </motion.button>
      </div>

      {/* Emoji picker */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden mt-4"
          >
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-3 border-4 border-purple-400 dark:border-purple-600">
              {/* Chinese search input */}
              <div className="mb-4">
                <input
                  type="text"
                  value={chineseQuery}
                  onChange={handleChineseSearch}
                  placeholder="🔍 中文搜索表情（如：笑、哭、爱）"
                  className="w-full px-4 py-2 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-purple-500 dark:focus:border-purple-400 font-bold"
                />

                {/* Chinese search results */}
                {chineseSearchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl max-h-32 overflow-y-auto"
                  >
                    <div className="flex flex-wrap gap-2">
                      {chineseSearchResults.slice(0, 50).map((emoji, index) => (
                        <button
                          key={index}
                          onClick={() => handleSearchResultClick(emoji)}
                          className="text-3xl hover:scale-125 transition-transform cursor-pointer"
                          title={emoji}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    {chineseSearchResults.length > 50 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                        显示前 50 个结果，共 {chineseSearchResults.length} 个
                      </p>
                    )}
                  </motion.div>
                )}

                {chineseQuery && chineseSearchResults.length === 0 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center"
                  >
                    未找到匹配的表情
                  </motion.p>
                )}
              </div>

              {/* Original emoji picker */}
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                theme={Theme.AUTO}
                skinTonesDisabled
                searchPlaceHolder="英文搜索..."
                width="100%"
                height={350}
                previewConfig={{
                  showPreview: false,
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instruction text - Duolingo Style */}
      {selectedEmoji && !isOpen && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-base font-bold text-gray-700 dark:text-gray-300 mt-2"
        >
          👆 点击图片中的人脸进行替换
        </motion.p>
      )}
    </div>
  );
}
