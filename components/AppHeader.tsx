'use client';

import { m, useReducedMotion } from 'framer-motion';
import NextImage from 'next/image';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { Sun, Moon } from '@/components/icons';

// Single fixed-layout header, unchanged across empty/editing states — no more
// full/compact toggle. Keeps the logo swing + shimmer title + theme/language
// switches; the privacy badge/tagline ride along as a small subline.
export default function AppHeader() {
  const { t, lang, setLang } = useI18n();
  const { resolvedTheme, toggleTheme } = useTheme();
  const shouldReduceMotion = useReducedMotion();

  return (
    <header className="h-14 flex items-center justify-between gap-2 px-3 md:px-4 backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-b border-gray-200/60 dark:border-slate-700/60">
      <div className="flex items-center gap-2 min-w-0">
        <m.div
          animate={shouldReduceMotion ? {} : { rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 0.5, delay: 0.2 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          className="shrink-0"
        >
          <div className="bg-white dark:bg-slate-800 p-1 rounded-xl shadow border-b-2 border-gray-200 dark:border-slate-700">
            <NextImage
              src="/kaonashi.jpg"
              alt="カオナシ"
              width={32}
              height={32}
              className="w-8 h-8 object-contain rounded-lg"
            />
          </div>
        </m.div>

        <div className="min-w-0">
          <h1 className="text-lg font-black text-gray-800 dark:text-gray-100 shimmer-text bg-clip-text truncate leading-tight">
            {t.header.title}
          </h1>
          <p
            className="hidden sm:block text-[11px] text-gray-500 dark:text-gray-400 truncate"
            title={t.header.privacyBadge}
          >
            {t.header.privacyBadge}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <m.button
          type="button"
          onClick={toggleTheme}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/80 dark:bg-slate-800/80 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 shadow-sm hover:bg-white dark:hover:bg-slate-800 transition-colors"
          aria-label={t.themeToggle.aria}
          title={t.themeToggle.aria}
        >
          <m.span
            key={resolvedTheme}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center"
          >
            {resolvedTheme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
          </m.span>
        </m.button>

        <button
          type="button"
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          className="text-xs font-bold px-2.5 py-1 h-9 rounded-full bg-white/80 dark:bg-slate-800/80 border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 shadow-sm hover:bg-white dark:hover:bg-slate-800 transition-colors"
          aria-label={t.languageToggle.aria}
        >
          {t.languageToggle.switchToLabel}
        </button>
      </div>
    </header>
  );
}
