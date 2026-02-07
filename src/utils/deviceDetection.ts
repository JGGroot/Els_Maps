import { BREAKPOINTS } from '@/constants';
import type { BreakpointState } from '@/types';

export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function isIOSDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function getBreakpointState(): BreakpointState {
  const width = window.innerWidth;
  const height = window.innerHeight;

  return {
    isMobile: width < BREAKPOINTS.mobile,
    isTablet: width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet,
    isDesktop: width >= BREAKPOINTS.tablet,
    width,
    height
  };
}

export function onBreakpointChange(
  callback: (state: BreakpointState) => void
): () => void {
  const handler = () => callback(getBreakpointState());

  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}
