export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1280
} as const;

export const LAYOUT = {
  sidebarWidth: 280,
  toolbarHeight: 60,
  bottomSheetMinHeight: 60,
  bottomSheetMaxHeight: 400,
  actionButtonSize: 56,
  actionButtonMargin: 16,
  reticleOffset: 40,
  minTouchTarget: 44
} as const;

export const GESTURE = {
  tapMaxDuration: 250,
  tapMaxDistance: 10,
  dragThreshold: 5,
  pinchMinDistance: 10
} as const;

export const ZOOM = {
  min: 0.1,
  max: 10,
  default: 1,
  step: 0.1
} as const;
