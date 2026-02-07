import { Rect, Point } from 'fabric';
import type { FabricObject } from 'fabric';
import { ToolType } from '@/types';
import type { TouchPoint } from '@/types';
import { BaseTool } from './BaseTool';
import { LAYOUT } from '@/constants';

export class RectangleTool extends BaseTool {
  type = ToolType.RECTANGLE;
  name = 'Rectangle';
  icon = 'rectangle';

  private startPoint: Point | null = null;
  private previewRect: Rect | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private isShiftHeld: boolean = false;

  protected setupEventListeners(): void {
    if (!this.canvas) return;

    this.canvas.selection = false;
    this.canvas.skipTargetFind = true;
    this.canvas.forEachObject((obj) => {
      obj.selectable = false;
      obj.evented = false;
    });

    this.keydownHandler = (e: KeyboardEvent) => this.onKeyDown(e);
    window.addEventListener('keydown', this.keydownHandler);
    window.addEventListener('keyup', this.onKeyUp);
  }

  protected cleanupEventListeners(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    window.removeEventListener('keyup', this.onKeyUp);

    // Re-enable object interaction when deactivating the tool
    if (this.canvas) {
      this.canvas.selection = true;
      this.canvas.skipTargetFind = false;
      this.canvas.forEachObject((obj) => {
        obj.selectable = true;
        obj.evented = true;
      });
    }
  }

  onMouseDown(point: Point, event: MouseEvent): void {
    if (event.button === 2) {
      this.cancelDrawing();
      return;
    }

    this.startDrawing(point);
  }

  onMouseMove(point: Point, _event: MouseEvent): void {
    if (this.drawing && this.startPoint) {
      this.updatePreview(point);
    }
  }

  onMouseUp(point: Point, _event: MouseEvent): void {
    if (this.drawing) {
      this.finishDrawing(point);
    }
  }

  onTouchStart(point: TouchPoint): void {
    const fabricPoint = new Point(point.x, point.y);
    this.startDrawing(fabricPoint);

    if (this.isMobile) {
      this.context?.updateReticle(point.x, point.y - LAYOUT.reticleOffset, true);
    }
  }

  onTouchMove(point: TouchPoint): void {
    if (this.drawing && this.startPoint) {
      const fabricPoint = new Point(point.x, point.y);
      this.updatePreview(fabricPoint);

      if (this.isMobile) {
        this.context?.updateReticle(point.x, point.y - LAYOUT.reticleOffset, true);
      }
    }
  }

  onTouchEnd(point: TouchPoint): void {
    if (this.drawing) {
      const fabricPoint = new Point(point.x, point.y);
      this.finishDrawing(fabricPoint);
    }

    if (this.isMobile) {
      this.context?.updateReticle(0, 0, false);
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.cancelDrawing();
    } else if (event.key === 'Shift') {
      this.isShiftHeld = true;
    }
  }

  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.key === 'Shift') {
      this.isShiftHeld = false;
    }
  };

  private startDrawing(point: Point): void {
    if (!this.canvas) return;

    this.drawing = true;
    this.startPoint = point;

    this.previewRect = new Rect({
      left: point.x,
      top: point.y,
      width: 0,
      height: 0,
      fill: this.config?.fillColor ?? 'transparent',
      stroke: this.config?.strokeColor ?? '#ffffff',
      strokeWidth: this.config?.strokeWidth ?? 2,
      selectable: false,
      evented: false,
      opacity: 0.8
    });

    this.canvas.add(this.previewRect);
    this.canvas.requestRenderAll();

    if (this.isMobile) {
      this.context?.showActionButton('cancel');
    }
  }

  private updatePreview(point: Point): void {
    if (!this.canvas || !this.previewRect || !this.startPoint) return;

    let width = point.x - this.startPoint.x;
    let height = point.y - this.startPoint.y;

    // Hold shift for square
    if (this.isShiftHeld) {
      const size = Math.max(Math.abs(width), Math.abs(height));
      width = width >= 0 ? size : -size;
      height = height >= 0 ? size : -size;
    }

    const left = width >= 0 ? this.startPoint.x : this.startPoint.x + width;
    const top = height >= 0 ? this.startPoint.y : this.startPoint.y + height;

    this.previewRect.set({
      left,
      top,
      width: Math.abs(width),
      height: Math.abs(height)
    });

    this.canvas.requestRenderAll();
  }

  private finishDrawing(point: Point): void {
    if (!this.canvas || !this.startPoint) {
      this.cancelDrawing();
      return;
    }

    // Remove preview
    if (this.previewRect) {
      this.canvas.remove(this.previewRect);
    }

    let width = point.x - this.startPoint.x;
    let height = point.y - this.startPoint.y;

    // Minimum size check
    if (Math.abs(width) < 5 && Math.abs(height) < 5) {
      this.resetState();
      return;
    }

    if (this.isShiftHeld) {
      const size = Math.max(Math.abs(width), Math.abs(height));
      width = width >= 0 ? size : -size;
      height = height >= 0 ? size : -size;
    }

    const left = width >= 0 ? this.startPoint.x : this.startPoint.x + width;
    const top = height >= 0 ? this.startPoint.y : this.startPoint.y + height;

    const rect = new Rect({
      left,
      top,
      width: Math.abs(width),
      height: Math.abs(height),
      fill: this.config?.fillColor ?? 'transparent',
      stroke: this.config?.strokeColor ?? '#ffffff',
      strokeWidth: this.config?.strokeWidth ?? 2,
      selectable: true,
      evented: true
    });

    this.canvas.add(rect);
    this.canvas.requestRenderAll();

    this.resetState();
  }

  private cancelDrawing(): void {
    if (this.canvas && this.previewRect) {
      this.canvas.remove(this.previewRect);
    }
    this.resetState();
  }

  private resetState(): void {
    this.previewRect = null;
    this.startPoint = null;
    this.drawing = false;
    this.context?.hideActionButton();
    this.context?.updateReticle(0, 0, false);
  }

  cancel(): void {
    this.cancelDrawing();
    super.cancel();
  }

  getPreview(): FabricObject | null {
    return this.previewRect;
  }
}
