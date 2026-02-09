import type { Canvas, FabricImage } from 'fabric';
import type { LockedCanvasState } from '@/types';

type LockChangeCallback = (state: LockedCanvasState) => void;

class CanvasLockManagerClass {
  private canvas: Canvas | null = null;
  private state: LockedCanvasState = {
    locked: false,
    width: 0,
    height: 0,
    imageId: null,
    offsetX: 0,
    offsetY: 0
  };
  private listeners: Set<LockChangeCallback> = new Set();
  private autoLockEnabled: boolean = false;

  setCanvas(canvas: Canvas): void {
    this.canvas = canvas;
  }

  isAutoLockEnabled(): boolean {
    return this.autoLockEnabled;
  }

  setAutoLockEnabled(enabled: boolean): void {
    this.autoLockEnabled = enabled;
  }

  ensureImageId(image: FabricImage): string {
    const existing = (image as FabricImage & { __elsImageId?: string }).__elsImageId;
    if (existing) return existing;

    const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    (image as FabricImage & { __elsImageId?: string }).__elsImageId = id;
    return id;
  }

  lockToImage(image: FabricImage): void {
    if (!this.canvas) return;

    const imageId = this.ensureImageId(image);
    const imgWidth = (image.width ?? 0) * (image.scaleX ?? 1);
    const imgHeight = (image.height ?? 0) * (image.scaleY ?? 1);

    // Calculate image bounds
    const left = image.left ?? 0;
    const top = image.top ?? 0;
    const originX = image.originX ?? 'left';
    const originY = image.originY ?? 'top';

    let offsetX = left;
    let offsetY = top;

    // Adjust for origin
    if (originX === 'center') {
      offsetX = left - imgWidth / 2;
    } else if (originX === 'right') {
      offsetX = left - imgWidth;
    }

    if (originY === 'center') {
      offsetY = top - imgHeight / 2;
    } else if (originY === 'bottom') {
      offsetY = top - imgHeight;
    }

    this.state = {
      locked: true,
      width: imgWidth,
      height: imgHeight,
      imageId,
      offsetX,
      offsetY
    };

    this.notifyListeners();
  }

  unlock(): void {
    this.state = {
      locked: false,
      width: 0,
      height: 0,
      imageId: null,
      offsetX: 0,
      offsetY: 0
    };
    this.notifyListeners();
  }

  isLocked(): boolean {
    return this.state.locked;
  }

  getLockedState(): LockedCanvasState {
    return { ...this.state };
  }

  /**
   * Get export options that crop to the locked region
   */
  getExportOptions(): { left: number; top: number; width: number; height: number } | null {
    if (!this.state.locked || !this.canvas) return null;

    return {
      left: this.state.offsetX,
      top: this.state.offsetY,
      width: this.state.width,
      height: this.state.height
    };
  }

  /**
   * Export only the locked region as a data URL
   */
  toDataURL(options?: { format?: 'png' | 'jpeg'; quality?: number; multiplier?: number }): string {
    if (!this.canvas) return '';

    const exportOpts = this.getExportOptions();
    if (!exportOpts) {
      // Not locked, export full canvas
      return this.canvas.toDataURL({
        format: options?.format ?? 'png',
        quality: options?.quality ?? 1,
        multiplier: options?.multiplier ?? 1
      });
    }

    // Save current viewport transform (pan/zoom state)
    const originalTransform = this.canvas.viewportTransform?.slice() ?? [1, 0, 0, 1, 0, 0];

    // Reset to identity transform (no pan, no zoom) so crop coordinates work correctly
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);

    // Force synchronous render to ensure all objects are drawn with the new transform
    this.canvas.renderAll();

    // Export only the locked region
    const dataUrl = this.canvas.toDataURL({
      format: options?.format ?? 'png',
      quality: options?.quality ?? 1,
      multiplier: options?.multiplier ?? 1,
      left: exportOpts.left,
      top: exportOpts.top,
      width: exportOpts.width,
      height: exportOpts.height
    });

    // Restore original viewport transform
    this.canvas.setViewportTransform(originalTransform as [number, number, number, number, number, number]);
    this.canvas.renderAll();

    return dataUrl;
  }

  subscribe(callback: LockChangeCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const stateCopy = this.getLockedState();
    this.listeners.forEach((cb) => cb(stateCopy));
  }
}

// Singleton instance
export const canvasLockManager = new CanvasLockManagerClass();
