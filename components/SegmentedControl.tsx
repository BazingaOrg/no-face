'use client';

import { useId } from 'react';
import { m } from 'framer-motion';

interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  id?: string;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  id,
}: SegmentedControlProps<T>) {
  const layoutId = useId();

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 p-1 rounded-full bg-gray-100 dark:bg-slate-700"
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.value)}
            className="relative px-3 h-8 rounded-full text-xs font-bold transition-colors"
          >
            {isSelected && (
              <m.div
                layoutId={`segmented-control-${layoutId}`}
                className="absolute inset-0 bg-blue-500 rounded-full shadow"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span
              className={`relative ${
                isSelected
                  ? 'text-white'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
