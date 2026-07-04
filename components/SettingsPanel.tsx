'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { DetectionSettings, EmojiSettings } from '@/types';

interface SettingsPanelProps {
  detectionSettings: DetectionSettings;
  onDetectionChange: (settings: DetectionSettings) => void;
  onEmojiChange: (settings: EmojiSettings) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const SENSITIVITY_INPUT_CLASS =
  'w-16 px-2 py-1 text-xs font-bold text-gray-800 dark:text-gray-100 bg-white/75 dark:bg-slate-900/70 border border-transparent rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/70 focus:border-blue-300/60 text-right transition-colors';

export default function SettingsPanel({
  detectionSettings,
  onDetectionChange,
  onEmojiChange,
  isOpen,
  onToggle,
}: SettingsPanelProps) {
  const currentSensitivity = detectionSettings.detector === 'ssd_mobilenetv1'
    ? (detectionSettings.minConfidence ?? 0.5)
    : (detectionSettings.scoreThreshold ?? 0.5);

  // Text input works in whole percentages (10-90); settings store 0.1-0.9
  const [sensitivityInput, setSensitivityInput] = useState(
    Math.round(currentSensitivity * 100).toString()
  );

  useEffect(() => {
    setSensitivityInput(Math.round(currentSensitivity * 100).toString());
  }, [currentSensitivity]);

  const handleSensitivityChange = (value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      const clamped = Math.min(Math.max(numValue, 10), 90) / 100;
      setSensitivityInput(Math.round(clamped * 100).toString());

      if (detectionSettings.detector === 'ssd_mobilenetv1') {
        onDetectionChange({
          ...detectionSettings,
          minConfidence: clamped,
        });
      } else {
        onDetectionChange({
          ...detectionSettings,
          scoreThreshold: clamped,
        });
      }
    }
  };
  return (
    <div className="w-full">
      {/* Unified card container - Duolingo Style */}
      <div
        className={`w-full bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl shadow-[0_20px_45px_-22px_rgba(15,23,42,0.45)] border border-white/60 dark:border-slate-700/60 overflow-hidden transition-all duration-300 ${
          isOpen ? 'rounded-[28px]' : 'rounded-[28px]'
        }`}
      >
        {/* Settings toggle button as card header */}
        <motion.button
          onClick={onToggle}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          className={`w-full py-3 px-5 text-gray-800 dark:text-gray-100 font-black text-base flex items-center justify-between transition-all duration-300 ${
            isOpen
              ? 'bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border-b border-white/60 dark:border-slate-700/60'
              : 'hover:bg-white/80 dark:hover:bg-slate-800/70'
          }`}
        >
          <span className="flex items-center gap-2">
            ⚙️ 高级设置
          </span>
          <motion.svg
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="w-5 h-5"
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
          </motion.svg>
        </motion.button>

        {/* Settings panel content as card body */}
        <motion.div
          initial={false}
          animate={{
            height: isOpen ? 'auto' : 0,
            opacity: isOpen ? 1 : 0,
          }}
          transition={{
            height: { duration: 0.3, ease: 'easeInOut' },
            opacity: { duration: 0.2, ease: 'easeInOut' },
          }}
          className="overflow-hidden"
        >
          <div className="p-5 space-y-5">
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
                onChange={(e) => {
                  const newDetector = e.target.value as 'ssd_mobilenetv1' | 'tiny_face_detector';
                  onDetectionChange({
                    ...detectionSettings,
                    detector: newDetector,
                    // Auto-set inputSize to 416 (balanced mode) when switching to Tiny Face Detector
                    ...(newDetector === 'tiny_face_detector' && { inputSize: 416 }),
                  });
                }}
                className="w-full px-4 py-3 text-base md:text-sm border-2 border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold shadow-sm appearance-none cursor-pointer transition-all"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                  backgroundPosition: 'right 0.5rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em',
                  paddingRight: '2.5rem',
                }}
              >
                <option value="ssd_mobilenetv1" className="text-base md:text-sm font-bold py-2">
                  🎯 标准模式（推荐）
                </option>
                <option value="tiny_face_detector" className="text-base md:text-sm font-bold py-2">
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
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={10}
                    max={90}
                    step={1}
                    value={sensitivityInput}
                    onChange={(event) => setSensitivityInput(event.target.value)}
                    onBlur={(event) => handleSensitivityChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        handleSensitivityChange((event.target as HTMLInputElement).value);
                      }
                    }}
                    className={SENSITIVITY_INPUT_CLASS}
                    inputMode="numeric"
                  />
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">%</span>
                </div>
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

            {/* Performance Mode - Hidden, defaults to 416 (balanced mode) */}
            {/* Auto-set inputSize to 416 when switching to Tiny Face Detector */}
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
                  flipX: false,
                  flipY: false,
                });
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="gradient-action bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 dark:from-slate-600 dark:to-slate-700 dark:hover:from-slate-700 dark:hover:to-slate-800 text-white border-gray-700 dark:border-slate-900"
            >
              🔄 恢复默认设置
            </motion.button>
          </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
