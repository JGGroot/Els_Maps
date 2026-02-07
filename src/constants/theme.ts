import type { ThemeColors } from '@/types';

export const THEME: ThemeColors = {
  background: '#1a1a1a',
  surface: '#252525',
  primary: '#4a9eff',
  secondary: '#6b7280',
  text: '#ffffff',
  textMuted: '#9ca3af',
  border: '#3d3d3d',
  accent: '#4a9eff'
};

export const CANVAS_DEFAULTS = {
  backgroundColor: '#1a1a1a',
  selectionColor: 'rgba(74, 158, 255, 0.3)',
  selectionBorderColor: '#4a9eff',
  selectionLineWidth: 1
};

export const TOOL_DEFAULTS = {
  strokeColor: '#ffffff',
  strokeWidth: 2,
  fillColor: 'transparent',
  opacity: 1
};
