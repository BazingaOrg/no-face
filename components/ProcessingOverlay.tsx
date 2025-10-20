'use client';

import { motion } from 'framer-motion';

interface ProcessingOverlayProps {
  message: string;
  hint?: string;
}

export default function ProcessingOverlay({ message, hint }: ProcessingOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4"
      >
        {/* Animated Icon */}
        <motion.div
          animate={{ 
            rotate: 360,
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            rotate: { duration: 2, repeat: Infinity, ease: "linear" },
            scale: { duration: 1, repeat: Infinity, ease: "easeInOut" }
          }}
          className="text-5xl text-center mb-4"
        >
          🔍
        </motion.div>

        {/* Message */}
        <motion.p
          key={message}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="text-xl font-black text-gray-800 dark:text-gray-100 text-center mb-2"
        >
          {message}
        </motion.p>

        {/* Hint */}
        {hint && (
          <motion.p
            key={hint}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1, ease: 'easeOut' }}
            className="text-sm text-gray-500 dark:text-gray-400 text-center"
          >
            {hint}
          </motion.p>
        )}

        {/* Scanning bar */}
        <div className="relative mt-5 h-2 w-full rounded-full bg-blue-100 dark:bg-slate-700/80 overflow-hidden">
          <motion.span
            aria-hidden
            className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-blue-400/60 via-blue-500/80 to-blue-400/60"
            animate={{ x: ['-60%', '140%'] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        {/* Animated Progress Dots */}
        <div className="flex justify-center gap-2 mt-4">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
              className="w-2 h-2 bg-blue-500 rounded-full"
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
