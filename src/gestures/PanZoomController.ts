import type { PinchGestureData, PanGestureData } from '@/types';
import { PointerTracker } from './PointerTracker';
import { GESTURE, ZOOM } from '@/constants';
import { clamp } from '@/utils';

export interface PanZoomCallbacks {
  onPanMove: (data: PanGestureData) => void;
  onPinchMove: (data: PinchGestureData) => void;
  onGestureEnd: () => void;
}

export class PanZoomController {
  private tracker: PointerTracker;
  private callbacks: PanZoomCallbacks;
  private initialDistance: number = 0;
  private lastCenter: { x: number; y: number } = { x: 0, y: 0 };
  private isActive: boolean = false;

  constructor(callbacks: PanZoomCallbacks) {
    this.tracker = new PointerTracker();
    this.callbacks = callbacks;
  }

  handlePinchStart(event: TouchEvent): void {
    this.tracker.clear();

    for (let i = 0; i < event.touches.length; i++) {
      this.tracker.addPoint(event.touches[i]);
    }

    if (this.tracker.getPointCount() >= 2) {
      this.initialDistance = this.tracker.getDistance();
      this.lastCenter = this.tracker.getCenter();
      this.isActive = true;
    }
  }

  handlePinchMove(event: TouchEvent): void {
    if (!this.isActive) return;

    for (let i = 0; i < event.touches.length; i++) {
      this.tracker.updatePoint(event.touches[i]);
    }

    if (this.tracker.getPointCount() >= 2) {
      const currentDistance = this.tracker.getDistance();
      const currentCenter = this.tracker.getCenter();

      if (this.initialDistance > GESTURE.pinchMinDistance) {
        const scale = currentDistance / this.initialDistance;

        const pinchData: PinchGestureData = {
          centerX: currentCenter.x,
          centerY: currentCenter.y,
          scale: clamp(scale, ZOOM.min, ZOOM.max),
          initialDistance: this.initialDistance,
          currentDistance
        };
        this.callbacks.onPinchMove(pinchData);
      }

      const panData: PanGestureData = {
        deltaX: currentCenter.x - this.lastCenter.x,
        deltaY: currentCenter.y - this.lastCenter.y,
        velocityX: 0,
        velocityY: 0
      };
      this.callbacks.onPanMove(panData);

      this.lastCenter = currentCenter;
    }
  }

  handlePinchEnd(event: TouchEvent): void {
    for (let i = 0; i < event.changedTouches.length; i++) {
      this.tracker.removePoint(event.changedTouches[i].identifier);
    }

    if (this.tracker.getPointCount() < 2) {
      this.isActive = false;
      this.callbacks.onGestureEnd();
      this.tracker.clear();
    }
  }

  cancel(): void {
    if (this.isActive) {
      this.callbacks.onGestureEnd();
    }
    this.isActive = false;
    this.tracker.clear();
  }

  getIsActive(): boolean {
    return this.isActive;
  }
}
