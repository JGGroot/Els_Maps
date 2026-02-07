import { Ellipse, Point } from 'fabric';
import type { FabricObject } from 'fabric';
import { ToolType } from '@/types';
import type { TouchPoint } from '@/types';
import { BaseTool } from './BaseTool';
import { LAYOUT } from '@/constants';

export class EllipseTool extends BaseTool {
  type = ToolType.ELLIPSE;
  name = 'Ellipse';
  icon = 'ellipse';

  private startPoint: Point | null = null;
  private previewEllipse: Ellipse | null = null;
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

    this.previewEllipse = new Ellipse({
      left: point.x,
      top: point.y,
      rx: 0,
      ry: 0,
      fill: this.config?.fillColor ?? 'transparent',
      stroke: this.config?.strokeColor ?? '#ffffff',
      strokeWidth: this.config?.strokeWidth ?? 2,
      selectable: false,
      evented: false,
      opacity: 0.8,
      originX: 'center',
      originY: 'center'
    });

    this.canvas.add(this.previewEllipse);
    this.canvas.requestRenderAll();

    if (this.isMobile) {
      this.context?.showActionButton('cancel');
    }
  }

  private updatePreview(point: Point): void {
    if (!this.canvas || !this.previewEllipse || !this.startPoint) return;

    let rx = Math.abs(point.x - this.startPoint.x) / 2;
    let ry = Math.abs(point.y - this.startPoint.y) / 2;

    // Hold shift for circle
    if (this.isShiftHeld) {
      const radius = Math.max(rx, ry);
      rx = radius;
      ry = radius;
    }

    const centerX = (this.startPoint.x + point.x) / 2;
    const centerY = (this.startPoint.y + point.y) / 2;

    this.previewEllipse.set({
      left: centerX,
      top: centerY,
      rx,
      ry
    });

    this.canvas.requestRenderAll();
  }

  private finishDrawing(point: Point): void {
    if (!this.canvas || !this.startPoint) {
      this.cancelDrawing();
      return;
    }

    // Remove preview
    if (this.previewEllipse) {
      this.canvas.remove(this.previewEllipse);
    }

    let rx = Math.abs(point.x - this.startPoint.x) / 2;
    let ry = Math.abs(point.y - this.startPoint.y) / 2;

    // Minimum size check
    if (rx < 3 && ry < 3) {
      this.resetState();
      return;
    }

    if (this.isShiftHeld) {
      const radius = Math.max(rx, ry);
      rx = radius;
      ry = radius;
    }

    const centerX = (this.startPoint.x + point.x) / 2;
    const centerY = (this.startPoint.y + point.y) / 2;

    const ellipse = new Ellipse({
      left: centerX,
      top: centerY,
      rx,
      ry,
      fill: this.config?.fillColor ?? 'transparent',
      stroke: this.config?.strokeColor ?? '#ffffff',
      strokeWidth: this.config?.strokeWidth ?? 2,
      selectable: true,
      evented: true,
      originX: 'center',
      originY: 'center'
    });

    this.canvas.add(ellipse);
    this.canvas.requestRenderAll();

    this.resetState();
  }

  private cancelDrawing(): void {
    if (this.canvas && this.previewEllipse) {
      this.canvas.remove(this.previewEllipse);
    }
    this.resetState();
  }

  private resetState(): void {
    this.previewEllipse = null;
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
    return this.previewEllipse;
  }
}
