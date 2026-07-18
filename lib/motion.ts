/**
 * Centralized framer-motion spring tokens, shared across the state-driven
 * layout (empty / processing / editing) so transitions read as one system
 * instead of each component picking its own numbers.
 */

export const canvasEntranceSpring = { type: 'spring' as const, stiffness: 220, damping: 26 };

export const mobileToolbarSpring = { type: 'spring' as const, stiffness: 280, damping: 30 };

export const desktopColumnSpring = { type: 'spring' as const, stiffness: 240, damping: 28 };
