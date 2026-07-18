'use client';

import { m } from 'framer-motion';

interface LoadingOverlayProps {
  icon: string;
  title: string;
  hint?: string;
  tip?: string;
}

// Single overlay used for both model loading (first-ever load, can take
// seconds to download the WASM/model) and face detection (upload/redetect,
// usually well under a second). Merging them into one mounted component
// means a fast detection right after a cold model load crossfades its
// text/icon in place instead of unmounting one modal and mounting another —
// which is what caused two overlays to flash in quick succession. Visibility
// itself is gated by the caller via useDelayedVisibility so sub-150ms work
// never shows this at all.
export default function LoadingOverlay({ icon, title, hint, tip }: LoadingOverlayProps) {
  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md"
    >
      <m.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 max-w-sm w-full mx-4"
      >
        <m.div
          key={icon}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="text-5xl text-center mb-4"
        >
          {icon}
        </m.div>

        <m.p
          key={title}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="text-xl font-black text-gray-800 dark:text-gray-100 text-center mb-2"
        >
          {title}
        </m.p>

        {hint && (
          <m.p
            key={hint}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1, ease: 'easeOut' }}
            className="text-sm text-gray-500 dark:text-gray-400 text-center"
          >
            {hint}
          </m.p>
        )}

        <div className="relative mt-5 h-2 w-full rounded-full bg-blue-100 dark:bg-slate-700/80 overflow-hidden">
          <m.span
            aria-hidden
            className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-blue-400/60 via-blue-500/80 to-blue-400/60"
            animate={{ x: ['-60%', '140%'] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        {tip && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-4">{tip}</p>
        )}
      </m.div>
    </m.div>
  );
}
