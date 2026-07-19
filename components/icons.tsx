// Small hand-drawn inline SVG icon set used across the app's controls,
// replacing emoji glyphs on buttons/chrome. Deliberately minimal — not
// copied from any icon library. All share the same stroke-based visual
// language (24x24 viewBox, currentColor stroke) so they read as one family.

interface IconProps {
  className?: string;
  size?: number;
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function Undo({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M9 7 4 12l5 5" />
      <path d="M4 12h11a5 5 0 0 1 0 10h-1" />
    </svg>
  );
}

export function Redo({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M15 7l5 5-5 5" />
      <path d="M20 12H9a5 5 0 0 0 0 10h1" />
    </svg>
  );
}

export function Redetect({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M4 12a8 8 0 0 1 14-5.3L20 8" />
      <path d="M20 4v4h-4" />
      <path d="M20 12a8 8 0 0 1-14 5.3L4 16" />
      <path d="M4 20v-4h4" />
    </svg>
  );
}

export function Clear({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M4 7h16" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function NewPhoto({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <rect x="3" y="5" width="14" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M3 16l4-3 4 3 3-2" />
      <path d="M18 4v6" />
      <path d="M15 7h6" />
    </svg>
  );
}

export function Download({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M12 3v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}

export function ApplyAll({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
    </svg>
  );
}

export function Dice({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="16" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Search({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function Sun({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.9 4.9l1.4 1.4" />
      <path d="M17.7 17.7l1.4 1.4" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M4.9 19.1l1.4-1.4" />
      <path d="M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function Moon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />
    </svg>
  );
}

export function Monitor({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </svg>
  );
}

export function Upload({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} className={className} {...base}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M4 17l4.5-3.5L12 16l3-2.5L20 17" />
    </svg>
  );
}
