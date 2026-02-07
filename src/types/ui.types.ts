export interface BreakpointState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
}

export interface BottomSheetState {
  isOpen: boolean;
  height: number;
  content: 'properties' | 'export' | 'import' | null;
}

export type ActionButtonMode = 'confirm' | 'cancel' | 'both';

export interface ActionButtonState {
  isVisible: boolean;
  mode: ActionButtonMode;
}

export interface ReticleState {
  isVisible: boolean;
  x: number;
  y: number;
}

export interface ThemeColors {
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
}
