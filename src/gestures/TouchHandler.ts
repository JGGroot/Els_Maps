import type { TouchPoint, GestureConfig } from '@/types';
import { GestureType } from '@/types';
import { GESTURE } from '@/constants';
import { distance } from '@/utils';

interface TouchState {
  startPoint: TouchPoint;
  currentPoint: TouchPoint;
  gestureType: GestureType;
  moved: boolean;
}

export interface TouchHandlerCallbacks {
  onTap: (point: TouchPoint) => void;
  onDragStart: (point: TouchPoint) => void;
  onDragMove: (point: TouchPoint, delta: { dx: number; dy: number }) => void;
  onDragEnd: (point: TouchPoint) => void;
}

export class TouchHandler {
  private state: TouchState | null = null;
  private config: GestureConfig;
  private callbacks: TouchHandlerCallbacks;
  private canvasOffset: { x: number; y: number } = { x: 0, y: 0 };

  constructor(callbacks: TouchHandlerCallbacks, config?: Partial<GestureConfig>) {
    this.callbacks = callbacks;
    this.config = {
      tapMaxDuration: config?.tapMaxDuration ?? GESTURE.tapMaxDuration,
      tapMaxDistance: config?.tapMaxDistance ?? GESTURE.tapMaxDistance,
      dragThreshold: config?.dragThreshold ?? GESTURE.dragThreshold
    };
  }

  setCanvasOffset(x: number, y: number): void {
    this.canvasOffset = { x, y };
  }

  private toCanvasCoords(point: TouchPoint): TouchPoint {
    return {
      ...point,
      x: point.x - this.canvasOffset.x,
      y: point.y - this.canvasOffset.y
    };
  }

  handleTouchStart(touch: Touch): void {
    const point: TouchPoint = {
      id: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };

    this.state = {
      startPoint: point,
      currentPoint: point,
      gestureType: GestureType.NONE,
      moved: false
    };
  }

  handleTouchMove(touch: Touch): void {
    if (!this.state) return;

    const point: TouchPoint = {
      id: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };

    const dist = distance(
      this.state.startPoint.x,
      this.state.startPoint.y,
      point.x,
      point.y
    );

    if (!this.state.moved && dist > this.config.dragThreshold) {
      this.state.moved = true;
      this.state.gestureType = GestureType.DRAG;
      this.callbacks.onDragStart(this.toCanvasCoords(this.state.startPoint));
    }

    if (this.state.gestureType === GestureType.DRAG) {
      const delta = {
        dx: point.x - this.state.currentPoint.x,
        dy: point.y - this.state.currentPoint.y
      };
      this.callbacks.onDragMove(this.toCanvasCoords(point), delta);
    }

    this.state.currentPoint = point;
  }

  handleTouchEnd(touch: Touch): void {
    if (!this.state) return;

    const point: TouchPoint = {
      id: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    };

    const duration = point.timestamp - this.state.startPoint.timestamp;
    const dist = distance(
      this.state.startPoint.x,
      this.state.startPoint.y,
      point.x,
      point.y
    );

    if (
      !this.state.moved &&
      duration < this.config.tapMaxDuration &&
      dist < this.config.tapMaxDistance
    ) {
      this.callbacks.onTap(this.toCanvasCoords(point));
    } else if (this.state.gestureType === GestureType.DRAG) {
      this.callbacks.onDragEnd(this.toCanvasCoords(point));
    }

    this.state = null;
  }

  cancel(): void {
    if (this.state?.gestureType === GestureType.DRAG) {
      this.callbacks.onDragEnd(this.toCanvasCoords(this.state.currentPoint));
    }
    this.state = null;
  }

  isActive(): boolean {
    return this.state !== null;
  }

  isDragging(): boolean {
    return this.state?.gestureType === GestureType.DRAG;
  }
}
