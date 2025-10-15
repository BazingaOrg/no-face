'use client';

import { motion, AnimatePresence } from 'framer-motion';

export interface ModelLoadingState {
  isLoading: boolean;
  progress: number;
  currentModel: string;
  loadedModels: string[];
}

interface ModelLoadingModalProps {
  state: ModelLoadingState;
}

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  ssdMobilenetv1: 'SSD MobileNet V1',
  tinyFaceDetector: 'Tiny Face Detector',
  faceLandmark68Net: 'Face Landmarks 68',
};

export default function ModelLoadingModal({ state }: ModelLoadingModalProps) {
  if (!state.isLoading) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4"
        >
          {/* Animated Icon */}
          <motion.div
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
          </motion.div>

          {/* Title */}
          <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 text-center mb-2">
            正在加载 AI 模型
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
            首次使用需要下载模型，请稍候...
          </p>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm font-bold text-gray-600 dark:text-gray-300 mb-2 numeric-display">
              <span>{state.currentModel && MODEL_DISPLAY_NAMES[state.currentModel]}</span>
              <span>{Math.round(state.progress)}%</span>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${state.progress}%` }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="h-full bg-gradient-to-r from-green-400 via-blue-500 to-purple-500 rounded-full"
              />
            </div>
          </div>

          {/* Model Status List */}
          <div className="space-y-2">
            {['ssdMobilenetv1', 'tinyFaceDetector', 'faceLandmark68Net'].map((modelKey) => {
              const isLoaded = state.loadedModels.includes(modelKey);
              const isCurrent = state.currentModel === modelKey;
              
              return (
                <motion.div
                  key={modelKey}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-colors ${
                    isCurrent
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-400 dark:border-blue-600'
                      : isLoaded
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-gray-50 dark:bg-slate-700/50'
                  }`}
                >
                  {/* Status Icon */}
                  <span className="text-xl">
                    {isLoaded ? '✅' : isCurrent ? '⏳' : '⏸️'}
                  </span>

                  {/* Model Name */}
                  <span className={`text-sm font-bold flex-1 ${
                    isLoaded
                      ? 'text-green-700 dark:text-green-300'
                      : isCurrent
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {MODEL_DISPLAY_NAMES[modelKey]}
                  </span>

                  {/* Loading Spinner for current model */}
                  {isCurrent && (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="text-blue-500"
                    >
                      ⚡
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Tip */}
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-6">
            💡 提示：模型仅需加载一次，后续访问将秒开
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

