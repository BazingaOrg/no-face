'use client';

import { m } from 'framer-motion';
import { useI18n } from '@/lib/i18n';

// Fixed, always-visible footer — no per-state hiding. On mobile, the docked
// editing toolbar is `fixed` and may sit on top of it; that's fine, the
// footer just stays where the normal document flow puts it.
export default function AppFooter() {
  const { t } = useI18n();
  return (
    <m.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="mt-6 mb-4 text-center text-xs text-gray-500 dark:text-gray-500 px-4"
    >
      <p>
        {t.footer.madeBy}{' '}
        <a
          href="https://github.com/BazingaOrg"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
        >
          @Bazinga
        </a>
        {' · '}
        <a
          href="https://github.com/BazingaOrg/no-face"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
        >
          {t.footer.viewSource}
        </a>
        {' · '}
        <span className="font-black">カオナシ</span>
        {' · '}©{' '}
        {new Date().getFullYear()}
      </p>
    </m.footer>
  );
}
