'use client';

import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EmojiSelectorProps {
  onEmojiSelect: (emoji: string) => void;
  selectedEmoji: string | null;
  isOpen: boolean;
  onToggle: () => void;
  replacedCount?: number;
  totalFaces?: number;
}

// Curated selection of fun and expressive emojis for face replacement
// Each category contains 10-20 carefully selected emojis
const POPULAR_EMOJIS = [
  // 🎭 经典笑脸 - Classic Smiles
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',

  // 😘 调情可爱 - Flirty & Cute
  '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',

  // 🤪 搞怪卖萌 - Goofy & Playful
  '🥲', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤑',

  // 🤔 思考疑惑 - Thinking & Curious
  '🤔', '🤨', '😐', '😑', '😶', '😏', '🙄', '😬', '🤓', '🧐',

  // 😴 疲惫无奈 - Tired & Reluctant
  '😴', '😪', '🤤', '😔', '😌', '🥱', '😕', '😟', '🙁', '☹️',

  // 🤯 夸张震惊 - Dramatic & Shocked
  '🤯', '😵', '🥴', '😮', '😯', '😲', '😳', '🥺', '😱', '🤠',

  // 😎 酷炫自信 - Cool & Confident
  '😎', '🥳', '🥸', '🤠', '😏', '🤑', '🤩', '🤪', '😜', '😉',

  // 😢 悲伤难过 - Sad & Emotional
  '🥺', '😢', '😭', '😥', '😦', '😧', '😨', '😰', '😓', '😩',

  // 😡 生气愤怒 - Angry & Furious
  '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡',

  // 👻 恐怖惊悚 - Spooky & Scary
  '👻', '👹', '👺', '💀', '☠️', '🤡', '👽', '👾', '🎃', '🤖',

  // 🐱 可爱动物 - Cute Animals
  '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🐶',
  '🐕', '🐩', '🦁', '🐯', '🐺', '🦄', '🐷', '🐗', '🐨', '🐼',

  // 🤒 生病不适 - Sick & Unwell
  '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🤥', '😵'
];

export default function EmojiSelector({
  onEmojiSelect,
  selectedEmoji,
  isOpen,
  onToggle,
  replacedCount = 0,
  totalFaces = 0,
}: EmojiSelectorProps) {

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

      {/* Emoji picker - Lazy loading with popular emojis first */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden mt-4"
          >
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-4 border-2 border-gray-200 dark:border-slate-700">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                theme={Theme.AUTO}
                skinTonesDisabled
                searchPlaceHolder="搜索表情..."
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

      {/* Instruction text - Dynamic based on state */}
      {!isOpen && (
        <motion.p
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
        </motion.p>
      )}
    </div>
  );
}
