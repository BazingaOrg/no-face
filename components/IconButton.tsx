'use client';

import { m } from 'framer-motion';
import type { ReactNode } from 'react';

interface IconButtonProps {
  onClick: () => void;
  disabled?: boolean;
  'aria-label': string;
  title?: string;
  children: ReactNode;
  // When provided, renders icon + label and sizes to content (desktop right
  // column). When omitted, keeps the fixed 40x40 icon-only appearance (mobile
  // compact header).
  label?: string;
}

// 40x40 icon button used for the secondary/reversible actions (undo, redo,
// redetect, reset, new photo) that the layout redesign demoted out of the
// main button row.
export default function IconButton({
  onClick,
  disabled,
  'aria-label': ariaLabel,
  title,
  children,
  label,
}: IconButtonProps) {
  return (
    <m.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      whileHover={disabled ? {} : { scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      className={
        label
          ? 'inline-flex items-center gap-1.5 px-3 h-10 whitespace-nowrap rounded-xl text-sm btn-duo btn-ghost disabled:opacity-40 disabled:cursor-not-allowed'
          : 'w-10 h-10 shrink-0 flex items-center justify-center text-lg btn-duo btn-ghost disabled:opacity-40 disabled:cursor-not-allowed'
      }
    >
      {children}
      {label && <span className="text-xs leading-none whitespace-nowrap">{label}</span>}
    </m.button>
  );
}
