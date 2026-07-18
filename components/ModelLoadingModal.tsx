'use client';

import { m, AnimatePresence } from 'framer-motion';
import { ModelLoadingState } from '@/types';

interface ModelLoadingModalProps {
  state: ModelLoadingState;
}

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  ssdMobilenetv1: 'SSD MobileNet V1',
  tinyFaceDetector: 'Tiny Face Detector',
};

export default function ModelLoadingModal({ state }: ModelLoadingModalProps) {
  if (!state.isLoading) return null;

  return (
    <AnimatePresence>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md"
      >
        <m.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4"
        >
          {/* Animated Icon */}
          <m.div
            animate={{ 
              y: [0, -10, 0],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="text-6xl text-center mb-4"
          >
            🧠
          </m.div>

          {/* Title */}
          <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 text-center mb-2">
            正在加载 AI 模型
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
            首次使用需要下载模型，请稍候...
          </p>

          {/* Current Model Info */}
          {state.currentModel && (
            <div className="mb-6">
              <div className="flex items-center justify-center gap-3 mb-4 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-400 dark:border-blue-600 rounded-xl">
                <span className="text-2xl">⏳</span>
                <span className="text-lg font-black text-blue-700 dark:text-blue-300">
                  {MODEL_DISPLAY_NAMES[state.currentModel]}
                </span>
                <m.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="text-xl text-blue-500"
                >
                  ⚡
                </m.div>
              </div>
            </div>
          )}

          {/* Tip */}
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-6">
            💡 提示：模型仅需加载一次，后续访问将秒开
          </p>
        </m.div>
      </m.div>
    </AnimatePresence>
  );
}

