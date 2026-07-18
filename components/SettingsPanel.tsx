'use client';

import { m } from 'framer-motion';
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
  const currentSensitivity = detectionSettings.minConfidence ?? 0.5;

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
      onDetectionChange({ minConfidence: clamped });
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
        <m.button
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
          <m.svg
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
          </m.svg>
        </m.button>

        {/* Settings panel content as card body */}
        <m.div
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
                value={detectionSettings.minConfidence}
                onChange={(e) => {
                  onDetectionChange({ minConfidence: parseFloat(e.target.value) });
                }}
                className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2 font-medium">
                <span>😊 更多检测</span>
                <span>🎯 更严格</span>
              </div>
            </div>
          </div>

          {/* Reset to Defaults */}
          <div className="pt-4 border-t border-gray-200 dark:border-slate-700 flex justify-center">
            <m.button
              onClick={() => {
                onDetectionChange({ minConfidence: 0.5 });
                onEmojiChange({
                  scale: 1.2,
                  opacity: 1.0,
                  flipX: false,
                  flipY: false,
                });
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="gradient-action btn-ghost"
            >
              🔄 恢复默认设置
            </m.button>
          </div>
          </div>
        </m.div>
      </div>
    </div>
  );
}
