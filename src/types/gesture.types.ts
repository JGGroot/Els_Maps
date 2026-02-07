export enum GestureType {
  NONE = 'none',
  TAP = 'tap',
  DRAG = 'drag',
  PAN = 'pan',
  PINCH = 'pinch'
}

export interface TouchPoint {
  id: number;
  x: number;
  y: number;
  timestamp: number;
}

export interface GestureState {
  type: GestureType;
  touchCount: number;
  startPoints: TouchPoint[];
  currentPoints: TouchPoint[];
  deltaX: number;
  deltaY: number;
  scale: number;
  isActive: boolean;
}

export interface PinchGestureData {
  centerX: number;
  centerY: number;
  scale: number;
  initialDistance: number;
  currentDistance: number;
}

export interface PanGestureData {
  deltaX: number;
  deltaY: number;
  velocityX: number;
  velocityY: number;
}

export interface GestureCallbacks {
  onTap?: (point: TouchPoint) => void;
  onDragStart?: (point: TouchPoint) => void;
  onDragMove?: (point: TouchPoint, delta: { dx: number; dy: number }) => void;
  onDragEnd?: (point: TouchPoint) => void;
  onPanStart?: (data: PanGestureData) => void;
  onPanMove?: (data: PanGestureData) => void;
  onPanEnd?: () => void;
  onPinchStart?: (data: PinchGestureData) => void;
  onPinchMove?: (data: PinchGestureData) => void;
  onPinchEnd?: () => void;
}

export interface GestureConfig {
  tapMaxDuration: number;
  tapMaxDistance: number;
  dragThreshold: number;
}
