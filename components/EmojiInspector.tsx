'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { EmojiReplacement, EmojiSettings } from '@/types';
import { useFrameDebouncedCallback } from '@/hooks/useFrameDebouncedCallback';

interface EmojiInspectorProps {
  replacement: EmojiReplacement;
  defaultSettings: EmojiSettings;
  label: string;
  onUpdate: (patch: Partial<EmojiReplacement>) => void;
  onResetToDefault: () => void;
  onAdoptAsDefault: () => void;
  onApplyToAll: () => void;
  onClose: () => void;
  className?: string;
}

const SECTION_CLASS = 'space-y-3';
const SLIDER_CLASS = 'w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-500';
const INPUT_CLASS =
  'w-16 px-2 py-1 text-xs font-bold text-gray-800 dark:text-gray-100 bg-white/75 dark:bg-slate-900/70 border border-transparent rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/70 focus:border-blue-300/60 text-right transition-colors numeric-display';

export default function EmojiInspector({
  replacement,
  defaultSettings,
  label,
  onUpdate,
  onResetToDefault,
  onAdoptAsDefault,
  onApplyToAll,
  onClose,
  className,
}: EmojiInspectorProps) {
  const scheduleUpdate = useFrameDebouncedCallback(onUpdate);
  const scaleValue = replacement.scale ?? defaultSettings.scale;
  const opacityValue = replacement.opacity ?? defaultSettings.opacity;
  const [localScale, setLocalScale] = useState(scaleValue);
  const [localOpacity, setLocalOpacity] = useState(opacityValue);
  const [scaleInput, setScaleInput] = useState(scaleValue.toFixed(1));
  const [opacityInput, setOpacityInput] = useState(opacityValue.toFixed(1));
  const flipX = Boolean(replacement.flipX);
  const flipY = Boolean(replacement.flipY);
  const containerClass = className ?? 'bg-white/95 dark:bg-slate-900/80 backdrop-blur-md border border-gray-200 dark:border-slate-700 rounded-3xl shadow-xl p-5 md:p-7 space-y-5';

  useEffect(() => {
    setLocalScale(scaleValue);
    setScaleInput(scaleValue.toFixed(1));
  }, [scaleValue]);

  useEffect(() => {
    setLocalOpacity(opacityValue);
    setOpacityInput(opacityValue.toFixed(1));
  }, [opacityValue]);

  const clampScale = useCallback(
    (value: number) => {
      if (Number.isNaN(value)) return scaleValue;
      return Math.min(Math.max(value, 0.5), 2);
    },
    [scaleValue]
  );

  const clampOpacity = useCallback(
    (value: number) => {
      if (Number.isNaN(value)) return opacityValue;
      return Math.min(Math.max(value, 0.5), 1);
    },
    [opacityValue]
  );

  const handleScaleChange = useCallback(
    (next: number) => {
      const clamped = clampScale(next);
      setLocalScale(clamped);
      setScaleInput(clamped.toFixed(1));
      scheduleUpdate({ scale: clamped });
    },
    [scheduleUpdate, clampScale]
  );

  const handleOpacityChange = useCallback(
    (next: number) => {
      const clamped = clampOpacity(next);
      setLocalOpacity(clamped);
      setOpacityInput(clamped.toFixed(1));
      scheduleUpdate({ opacity: clamped });
    },
    [scheduleUpdate, clampOpacity]
  );

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
          <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 numeric-display">{label}</h2>
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
          <header className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-1">表情大小</h3>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0.5}
                max={2}
                step={0.05}
                value={scaleInput}
                onChange={(event) => {
                  setScaleInput(event.target.value);
                }}
                onBlur={(event) => handleScaleChange(parseFloat(event.target.value))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleScaleChange(parseFloat((event.target as HTMLInputElement).value));
                  }
                }}
                className={INPUT_CLASS}
                inputMode="decimal"
              />
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">倍</span>
            </div>
          </header>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.05"
            value={localScale}
            onChange={(event) => handleScaleChange(parseFloat(event.target.value))}
            className={SLIDER_CLASS}
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 font-medium">
            <span>😊 较小</span>
            <span>😆 较大</span>
          </div>
        </section>

        <section className={SECTION_CLASS}>
          <header className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-1">透明度</h3>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0.5}
                max={1}
                step={0.01}
                value={opacityInput}
                onChange={(event) => {
                  setOpacityInput(event.target.value);
                }}
                onBlur={(event) => handleOpacityChange(parseFloat(event.target.value))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleOpacityChange(parseFloat((event.target as HTMLInputElement).value));
                  }
                }}
                className={INPUT_CLASS}
                inputMode="decimal"
              />
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">%</span>
            </div>
          </header>
          <input
            type="range"
            min="0.5"
            max="1"
            step="0.01"
            value={localOpacity}
            onChange={(event) => handleOpacityChange(parseFloat(event.target.value))}
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
          className="gradient-action bg-gradient-to-r from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white border-green-600"
        >
          设为默认
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onApplyToAll}
          className="gradient-action bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white border-orange-600"
        >
          全部应用
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onResetToDefault}
          className="gradient-action bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white border-gray-700"
        >
          恢复默认值
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onClose}
          className="gradient-action bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white border-blue-600"
        >
          完成
        </motion.button>
      </div>
    </motion.div>
  );
}
