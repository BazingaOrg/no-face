'use client';

import { motion } from 'framer-motion';
import { DetectionSettings, EmojiSettings } from '@/types';

interface SettingsPanelProps {
  detectionSettings: DetectionSettings;
  emojiSettings: EmojiSettings;
  onDetectionChange: (settings: DetectionSettings) => void;
  onEmojiChange: (settings: EmojiSettings) => void;
  isOpen: boolean;
  onToggle: () => void;
  hasReplacements?: boolean;
  hasImage?: boolean;
}

export default function SettingsPanel({
  detectionSettings,
  emojiSettings,
  onDetectionChange,
  onEmojiChange,
  isOpen,
  onToggle,
  hasReplacements = false,
  hasImage = false,
}: SettingsPanelProps) {
  return (
    <div className="w-full">
      {/* Settings toggle button - Duolingo Style */}
      <motion.button
        onClick={onToggle}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-3 px-5 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-100 rounded-2xl font-black text-base shadow-lg transition-all flex items-center justify-between border-b-4 border-gray-300 dark:border-slate-600 active:border-b-0 active:mt-1"
      >
        <span className="flex items-center gap-2">
          ⚙️ 高级设置
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

      {/* Settings panel - Duolingo Style */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0, y: -20 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="mt-4 p-5 bg-white dark:bg-slate-800 rounded-2xl shadow-md space-y-5 border border-gray-200 dark:border-slate-700"
        >
          {/* Detection Settings */}
          <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              🔍 人脸检测
            </h3>

            {/* Detector Type */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                检测模式
              </label>
              <select
                value={detectionSettings.detector}
                onChange={(e) =>
                  onDetectionChange({
                    ...detectionSettings,
                    detector: e.target.value as 'ssd_mobilenetv1' | 'tiny_face_detector',
                  })
                }
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-gray-800 transition-all"
              >
                <option value="ssd_mobilenetv1">
                  🎯 标准模式（推荐）
                </option>
                <option value="tiny_face_detector">
                  ⚡ 极速模式
                </option>
              </select>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium">
                {detectionSettings.detector === 'ssd_mobilenetv1'
                  ? '标准模式，适合大多数场景'
                  : '快速模式，可能遗漏部分人脸'}
              </p>
            </div>

            {/* Detection Sensitivity */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  检测灵敏度
                </label>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-lg numeric-display">
                  {detectionSettings.detector === 'ssd_mobilenetv1'
                    ? detectionSettings.minConfidence?.toFixed(2)
                    : (detectionSettings.scoreThreshold || 0.5).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.01"
                value={
                  detectionSettings.detector === 'ssd_mobilenetv1'
                    ? detectionSettings.minConfidence
                    : detectionSettings.scoreThreshold || 0.5
                }
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (detectionSettings.detector === 'ssd_mobilenetv1') {
                    onDetectionChange({
                      ...detectionSettings,
                      minConfidence: value,
                    });
                  } else {
                    onDetectionChange({
                      ...detectionSettings,
                      scoreThreshold: value,
                    });
                  }
                }}
                className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2 font-medium">
                <span>😊 更多检测</span>
                <span>🎯 更严格</span>
              </div>
            </div>

            {/* Performance Mode (only for Tiny Face Detector) */}
            {detectionSettings.detector === 'tiny_face_detector' && (
              <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  性能模式
                </label>
                <select
                  value={detectionSettings.inputSize || 416}
                  onChange={(e) =>
                    onDetectionChange({
                      ...detectionSettings,
                      inputSize: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 font-medium text-gray-800 transition-all"
                >
                  <option value="224">🚀 极速模式</option>
                  <option value="416">⚡ 平衡模式（推荐）</option>
                  <option value="608">🎯 精准模式</option>
                </select>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 font-medium">
                  {detectionSettings.inputSize === 224 && '最快速度，可能漏检小脸'}
                  {(detectionSettings.inputSize === 416 || !detectionSettings.inputSize) && '速度与精度平衡，适合大多数场景'}
                  {detectionSettings.inputSize === 608 && '最高精度，处理时间较长'}
                </p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-slate-700"></div>

          {/* Emoji Settings */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                😀 表情设置
              </h3>
              {hasImage && !hasReplacements && (
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-lg">
                  ⚠️ 需要先替换表情
                </span>
              )}
            </div>


            {/* Emoji Scale */}
            <div className={`mb-4 ${hasImage && !hasReplacements ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  表情大小
                </label>
                <span className="text-sm font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2.5 py-1 rounded-lg numeric-display">
                  {Math.round(emojiSettings.scale * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={emojiSettings.scale}
                onChange={(e) =>
                  onEmojiChange({
                    ...emojiSettings,
                    scale: parseFloat(e.target.value),
                  })
                }
                disabled={hasImage && !hasReplacements}
                className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2 font-medium">
                <span>😊 较小</span>
                <span>😆 较大</span>
              </div>
            </div>

            {/* Emoji Opacity */}
            <div className={`mb-4 ${hasImage && !hasReplacements ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  透明度
                </label>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-lg numeric-display">
                  {Math.round(emojiSettings.opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.0"
                step="0.01"
                value={emojiSettings.opacity}
                onChange={(e) =>
                  onEmojiChange({
                    ...emojiSettings,
                    opacity: parseFloat(e.target.value),
                  })
                }
                disabled={hasImage && !hasReplacements}
                className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2 font-medium">
                <span>👻 半透明</span>
                <span>💯 不透明</span>
              </div>
            </div>

            {/* Flip Controls */}
            <div className={`mb-4 ${hasImage && !hasReplacements ? 'opacity-40 pointer-events-none' : ''}`}>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                🪞 翻转
              </label>
              <div className="flex gap-3">
                <motion.button
                  onClick={() =>
                    onEmojiChange({
                      ...emojiSettings,
                      flipX: !emojiSettings.flipX,
                    })
                  }
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={hasImage && !hasReplacements}
                  className={`flex-1 py-3 px-4 rounded-lg text-center font-bold transition-all ${
                    emojiSettings.flipX
                      ? 'bg-gradient-to-r from-teal-400 to-teal-500 text-white shadow-md border-b-4 border-teal-600'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 border-b-4 border-gray-300 dark:border-slate-600'
                  }`}
                >
                  ⬌ 水平翻转
                </motion.button>
                <motion.button
                  onClick={() =>
                    onEmojiChange({
                      ...emojiSettings,
                      flipY: !emojiSettings.flipY,
                    })
                  }
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={hasImage && !hasReplacements}
                  className={`flex-1 py-3 px-4 rounded-lg text-center font-bold transition-all ${
                    emojiSettings.flipY
                      ? 'bg-gradient-to-r from-teal-400 to-teal-500 text-white shadow-md border-b-4 border-teal-600'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 border-b-4 border-gray-300 dark:border-slate-600'
                  }`}
                >
                  ⬍ 垂直翻转
                </motion.button>
              </div>
            </div>

            {/* Position Offset */}
            <div className={`mb-4 bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-200 dark:border-amber-800 ${hasImage && !hasReplacements ? 'opacity-40 pointer-events-none' : ''}`}>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                📍 位置微调
              </label>

              {/* Horizontal Offset */}
              <div className="mb-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">左右移动</span>
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded numeric-display">
                    {emojiSettings.offsetX > 0 ? '+' : ''}{emojiSettings.offsetX}
                  </span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  step="1"
                  value={emojiSettings.offsetX}
                  onChange={(e) =>
                    onEmojiChange({
                      ...emojiSettings,
                      offsetX: parseInt(e.target.value),
                    })
                  }
                  disabled={hasImage && !hasReplacements}
                  className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1 font-medium">
                  <span>⬅️ 左</span>
                  <span>➡️ 右</span>
                </div>
              </div>

              {/* Vertical Offset */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">上下移动</span>
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded numeric-display">
                    {emojiSettings.offsetY > 0 ? '+' : ''}{emojiSettings.offsetY}
                  </span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  step="1"
                  value={emojiSettings.offsetY}
                  onChange={(e) =>
                    onEmojiChange({
                      ...emojiSettings,
                      offsetY: parseInt(e.target.value),
                    })
                  }
                  disabled={hasImage && !hasReplacements}
                  className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1 font-medium">
                  <span>⬆️ 上</span>
                  <span>⬇️ 下</span>
                </div>
              </div>
            </div>
          </div>

          {/* Reset to Defaults */}
          <div className="pt-4 border-t border-gray-200 dark:border-slate-700 flex justify-center">
            <motion.button
              onClick={() => {
                onDetectionChange({
                  detector: 'ssd_mobilenetv1',
                  minConfidence: 0.5,
                });
                onEmojiChange({
                  size: '72x72',
                  scale: 1.2,
                  opacity: 1.0,
                  offsetX: 0,
                  offsetY: 0,
                  flipX: false,
                  flipY: false,
                });
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-auto py-2.5 px-4 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 dark:from-slate-600 dark:to-slate-700 dark:hover:from-slate-700 dark:hover:to-slate-800 text-white rounded-2xl font-bold text-sm shadow-md transition-all border-b-4 border-gray-700 dark:border-slate-900 active:border-b-0 active:mt-1"
            >
              🔄 恢复默认设置
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
