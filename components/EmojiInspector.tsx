'use client';

import { motion } from 'framer-motion';
import { EmojiReplacement, EmojiSettings } from '@/types';

interface EmojiInspectorProps {
  replacement: EmojiReplacement;
  defaultSettings: EmojiSettings;
  label: string;
  onUpdate: (patch: Partial<EmojiReplacement>) => void;
  onResetToDefault: () => void;
  onAdoptAsDefault: () => void;
  onClose: () => void;
  className?: string;
}

const SECTION_CLASS = 'space-y-3';
const SLIDER_CLASS = 'w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-500';

export default function EmojiInspector({
  replacement,
  defaultSettings,
  label,
  onUpdate,
  onResetToDefault,
  onAdoptAsDefault,
  onClose,
  className,
}: EmojiInspectorProps) {
  const scaleValue = replacement.scale ?? defaultSettings.scale;
  const opacityValue = replacement.opacity ?? defaultSettings.opacity;
  const flipX = Boolean(replacement.flipX);
  const flipY = Boolean(replacement.flipY);
  const containerClass = className ?? 'bg-white/95 dark:bg-slate-900/80 backdrop-blur-md border border-gray-200 dark:border-slate-700 rounded-3xl shadow-xl p-5 md:p-7 space-y-5';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={containerClass}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-blue-600 dark:text-blue-300 uppercase tracking-wide">微调表情</p>
          <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100">{label}</h2>
          {replacement.isCustom && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-lg">
              ⚙️ 已自定义
            </span>
          )}
        </div>
        <div className="text-4xl md:text-5xl select-none" aria-hidden>
          {replacement.emoji}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className={SECTION_CLASS}>
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">表情大小</h3>
            <span className="text-sm font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2.5 py-0.5 rounded-lg numeric-display">
              {Math.round(scaleValue * 100)}%
            </span>
          </header>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.05"
            value={scaleValue}
            onChange={(event) => onUpdate({ scale: parseFloat(event.target.value) })}
            className={SLIDER_CLASS}
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
            <span>😊 较小</span>
            <span>😆 较大</span>
          </div>
        </section>

        <section className={SECTION_CLASS}>
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">透明度</h3>
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 rounded-lg numeric-display">
              {Math.round(opacityValue * 100)}%
            </span>
          </header>
          <input
            type="range"
            min="0.5"
            max="1"
            step="0.01"
            value={opacityValue}
            onChange={(event) => onUpdate({ opacity: parseFloat(event.target.value) })}
            className={SLIDER_CLASS}
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
            <span>👻 半透明</span>
            <span>💯 不透明</span>
          </div>
        </section>

        <section className={`md:col-span-2 ${SECTION_CLASS}`}>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">翻转调整</h3>
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onUpdate({ flipX: !flipX })}
              className={`py-3 px-4 rounded-2xl font-bold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                flipX
                  ? 'bg-gradient-to-r from-teal-400 to-teal-500 text-white shadow-md border-b-4 border-teal-600'
                  : 'bg-gray-100 dark:bg-slate-800/80 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-700 border-b-4 border-gray-300 dark:border-slate-600'
              }`}
            >
              ⬌ 水平翻转
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onUpdate({ flipY: !flipY })}
              className={`py-3 px-4 rounded-2xl font-bold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                flipY
                  ? 'bg-gradient-to-r from-teal-400 to-teal-500 text-white shadow-md border-b-4 border-teal-600'
                  : 'bg-gray-100 dark:bg-slate-800/80 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-700 border-b-4 border-gray-300 dark:border-slate-600'
              }`}
            >
              ⬍ 垂直翻转
            </motion.button>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onAdoptAsDefault}
          className="min-w-[130px] py-2.5 px-4 bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white rounded-2xl font-bold text-sm shadow-md transition-all border-b-4 border-green-600 active:border-b-0 active:mt-1"
        >
          设为默认
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onResetToDefault}
          className="min-w-[130px] py-2.5 px-4 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-2xl font-bold text-sm shadow-md transition-all border-b-4 border-gray-700 active:border-b-0 active:mt-1"
        >
          恢复默认值
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onClose}
          className="min-w-[130px] py-2.5 px-4 bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white rounded-2xl font-bold text-sm shadow-md transition-all border-b-4 border-blue-600 active:border-b-0 active:mt-1"
        >
          完成
        </motion.button>
      </div>
    </motion.div>
  );
}
