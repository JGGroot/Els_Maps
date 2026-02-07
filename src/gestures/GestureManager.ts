import { CanvasEngine } from '@/canvas';
import { TouchHandler, type TouchHandlerCallbacks } from './TouchHandler';
import { PanZoomController, type PanZoomCallbacks } from './PanZoomController';
import type { TouchPoint, PanGestureData, PinchGestureData } from '@/types';

export interface GestureManagerCallbacks {
  onTap: (point: TouchPoint) => void;
  onDragStart: (point: TouchPoint) => void;
  onDragMove: (point: TouchPoint, delta: { dx: number; dy: number }) => void;
  onDragEnd: (point: TouchPoint) => void;
}

export class GestureManager {
  private element: HTMLElement;
  private engine: CanvasEngine;
  private touchHandler: TouchHandler;
  private panZoomController: PanZoomController;
  private callbacks: GestureManagerCallbacks;
  private baseZoom: number = 1;
  private isTwoFingerGesture: boolean = false;

  constructor(
    element: HTMLElement,
    engine: CanvasEngine,
    callbacks: GestureManagerCallbacks
  ) {
    this.element = element;
    this.engine = engine;
    this.callbacks = callbacks;

    const touchCallbacks: TouchHandlerCallbacks = {
      onTap: (point) => this.callbacks.onTap(point),
      onDragStart: (point) => this.callbacks.onDragStart(point),
      onDragMove: (point, delta) => this.callbacks.onDragMove(point, delta),
      onDragEnd: (point) => this.callbacks.onDragEnd(point)
    };

    const panZoomCallbacks: PanZoomCallbacks = {
      onPanMove: (data) => this.handlePan(data),
      onPinchMove: (data) => this.handlePinch(data),
      onGestureEnd: () => this.handleGestureEnd()
    };

    this.touchHandler = new TouchHandler(touchCallbacks);
    this.panZoomController = new PanZoomController(panZoomCallbacks);

    this.bindEvents();
  }

  private bindEvents(): void {
    this.element.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.element.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.element.addEventListener('touchend', this.onTouchEnd, { passive: false });
    this.element.addEventListener('touchcancel', this.onTouchCancel, { passive: false });
  }

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();

    const rect = this.element.getBoundingClientRect();
    this.touchHandler.setCanvasOffset(rect.left, rect.top);

    if (e.touches.length === 1 && !this.isTwoFingerGesture) {
      this.touchHandler.handleTouchStart(e.touches[0]);
    } else if (e.touches.length >= 2) {
      if (this.touchHandler.isDragging()) {
        this.touchHandler.cancel();
      }
      this.isTwoFingerGesture = true;
      this.baseZoom = this.engine.getZoom();
      this.panZoomController.handlePinchStart(e);
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();

    if (e.touches.length === 1 && !this.isTwoFingerGesture) {
      this.touchHandler.handleTouchMove(e.touches[0]);
    } else if (e.touches.length >= 2) {
      this.panZoomController.handlePinchMove(e);
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    e.preventDefault();

    if (this.isTwoFingerGesture) {
      this.panZoomController.handlePinchEnd(e);
      if (e.touches.length === 0) {
        this.isTwoFingerGesture = false;
      }
    } else if (e.changedTouches.length > 0) {
      this.touchHandler.handleTouchEnd(e.changedTouches[0]);
    }
  };

  private onTouchCancel = (e: TouchEvent): void => {
    e.preventDefault();
    this.touchHandler.cancel();
    this.panZoomController.cancel();
    this.isTwoFingerGesture = false;
  };

  private handlePan(data: PanGestureData): void {
    this.engine.relativePan(data.deltaX, data.deltaY);
  }

  private handlePinch(data: PinchGestureData): void {
    const rect = this.element.getBoundingClientRect();
    const canvasPoint = {
      x: data.centerX - rect.left,
      y: data.centerY - rect.top
    };

    const newZoom = this.baseZoom * data.scale;
    this.engine.setZoom(newZoom, canvasPoint);
  }

  private handleGestureEnd(): void {
    this.baseZoom = this.engine.getZoom();
  }

  updateCanvasOffset(): void {
    const rect = this.element.getBoundingClientRect();
    this.touchHandler.setCanvasOffset(rect.left, rect.top);
  }

  dispose(): void {
    this.element.removeEventListener('touchstart', this.onTouchStart);
    this.element.removeEventListener('touchmove', this.onTouchMove);
    this.element.removeEventListener('touchend', this.onTouchEnd);
    this.element.removeEventListener('touchcancel', this.onTouchCancel);
  }
}
