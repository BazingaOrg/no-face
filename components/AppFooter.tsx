'use client';

import { m } from 'framer-motion';
import { useI18n } from '@/lib/i18n';

interface AppFooterProps {
  // Editing state renders this at the bottom of a fixed h-dvh column with no
  // page scroll, so it uses tighter spacing than the landing state's
  // document-flow footer. Content is identical either way.
  compact?: boolean;
}

// Always-visible footer — no per-state hiding of the element itself, just a
// spacing variant. On mobile, the docked editing toolbar sits above it in
// normal flow now (no longer `fixed`), so overlap is no longer a concern.
export default function AppFooter({ compact = false }: AppFooterProps) {
  const { t } = useI18n();
  return (
    <m.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className={
        compact
          ? 'shrink-0 py-1.5 text-center text-[11px] text-gray-500 dark:text-gray-500 px-4'
          : 'mt-6 mb-4 text-center text-xs text-gray-500 dark:text-gray-500 px-4'
      }
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
