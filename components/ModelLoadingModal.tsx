'use client';

import { m, AnimatePresence } from 'framer-motion';
import { ModelLoadingState } from '@/types';
import { useI18n } from '@/lib/i18n';

interface ModelLoadingModalProps {
  state: ModelLoadingState;
}

export default function ModelLoadingModal({ state }: ModelLoadingModalProps) {
  const { t } = useI18n();

  // Indeterminate: no fabricated percentage, just which phase the Worker is in.
  const PHASE_LABELS: Record<'wasm' | 'model', string> = {
    wasm: t.modelLoading.phaseWasm,
    model: t.modelLoading.phaseModel,
  };

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
            {t.modelLoading.title}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
            {t.modelLoading.subtitle}
          </p>

          {/* Current Phase Info */}
          {state.phase && (
            <div className="mb-6">
              <div className="flex items-center justify-center gap-3 mb-4 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-400 dark:border-blue-600 rounded-xl">
                <span className="text-2xl">⏳</span>
                <span className="text-lg font-black text-blue-700 dark:text-blue-300">
                  {PHASE_LABELS[state.phase]}
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
            {t.modelLoading.tip}
          </p>
        </m.div>
      </m.div>
    </AnimatePresence>
  );
}

