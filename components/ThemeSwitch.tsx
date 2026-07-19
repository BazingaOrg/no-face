'use client';

import { useId } from 'react';
import { flushSync } from 'react-dom';
import { m } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import type { ThemePreference } from '@/lib/theme';
import { Monitor, Sun, Moon } from '@/components/icons';

const OPTIONS: { value: ThemePreference; Icon: typeof Sun }[] = [
  { value: 'system', Icon: Monitor },
  { value: 'light', Icon: Sun },
  { value: 'dark', Icon: Moon },
];

function resolve(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

export default function ThemeSwitch() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const layoutId = useId();

  const handleSelect = (next: ThemePreference, buttonEl: HTMLElement) => {
    if (next === theme) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const currentResolved = resolve(theme);
    const nextResolved = resolve(next);
    const resolvedWillChange = currentResolved !== nextResolved;

    if (!document.startViewTransition || prefersReduced || !resolvedWillChange) {
      if (resolvedWillChange && !prefersReduced) {
        document.documentElement.classList.add('theme-transition');
        setTheme(next);
        setTimeout(() => {
          document.documentElement.classList.remove('theme-transition');
        }, 300);
      } else {
        setTheme(next);
      }
      return;
    }

    const { top, left, width, height } = buttonEl.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const maxR = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    const vt = document.startViewTransition(() =>
      flushSync(() => {
        setTheme(next);
        document.documentElement.classList.toggle('dark', nextResolved === 'dark');
      })
    );

    vt.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxR}px at ${x}px ${y}px)`],
        },
        {
          duration: 450,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
  };

  return (
    <div
      role="radiogroup"
      aria-label={t.themeToggle.aria}
      className="inline-flex items-center gap-0.5 p-1 rounded-full bg-gray-100 dark:bg-slate-700"
    >
      {OPTIONS.map(({ value, Icon }) => {
        const isSelected = value === theme;
        const label = t.themeToggle[value];
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={label}
            title={label}
            onClick={(e) => handleSelect(value, e.currentTarget)}
            className="relative w-8 h-8 flex items-center justify-center rounded-full transition-colors"
          >
            {isSelected && (
              <m.div
                layoutId={`theme-switch-${layoutId}`}
                className="absolute inset-0 bg-blue-500 rounded-full shadow"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span
              className={`relative flex items-center justify-center ${
                isSelected ? 'text-white' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              <Icon size={16} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
