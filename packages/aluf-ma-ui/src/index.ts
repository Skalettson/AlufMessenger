/**
 * Aluf Mini-Apps UI Kit
 * Современный UI-кит для Mini-Apps с анимациями 60fps
 */

// ============================================
// Components
// ============================================
export { Button } from './components/Button.js';
export { Cell, List } from './components/Cell.js';

// ============================================
// Providers
// ============================================
export {
  AlufProvider,
  useAlufTheme,
  useAlufColorScheme,
} from './providers/AlufProvider.js';

export type {
  ThemeType,
  ColorScheme,
  AlufProviderProps,
} from './providers/AlufProvider.js';

export type { CellProps, ListProps } from './components/Cell.js';

// ============================================
// Utils
// ============================================
export { cn } from './utils/cn.js';
export { useAnimation } from './hooks/useAnimation.js';
export { useGesture } from './hooks/useGesture.js';
