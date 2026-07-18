'use client';

import { m, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

export default function Toast({
  message,
  isVisible,
  onClose,
  duration = 2000,
  actionLabel,
  onAction,
}: ToastProps) {
  // Toasts with an action stay longer so the user has time to react
  const effectiveDuration = actionLabel && onAction ? Math.max(duration, 5000) : duration;

  useEffect(() => {
    if (isVisible && effectiveDuration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, effectiveDuration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, effectiveDuration, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <m.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
        >
          <div
            role="status"
            aria-live="polite"
            className="bg-slate-800 dark:bg-slate-700 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center justify-center gap-4 min-w-[200px] backdrop-blur-sm"
          >
            <span className="font-bold text-sm">{message}</span>
            {actionLabel && onAction && (
              <button
                type="button"
                onClick={() => {
                  // Close first: the action may show a follow-up toast,
                  // which this close would otherwise immediately hide
                  onClose();
                  onAction();
                }}
                className="shrink-0 font-bold text-sm text-blue-300 hover:text-blue-200 underline underline-offset-2 transition-colors"
              >
                {actionLabel}
              </button>
            )}
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
