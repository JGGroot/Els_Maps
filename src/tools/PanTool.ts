import type { Point } from 'fabric';
import { ToolType } from '@/types';
import type { TouchPoint } from '@/types';
import { BaseTool } from './BaseTool';

export class PanTool extends BaseTool {
  type = ToolType.PAN;
  name = 'Pan';
  icon = 'hand';

  private isPanning: boolean = false;
  private lastPoint: { x: number; y: number } | null = null;

  protected setupEventListeners(): void {
    if (!this.canvas) return;

    this.canvas.selection = false;
    this.canvas.skipTargetFind = true;
    this.canvas.defaultCursor = 'grab';
    this.canvas.forEachObject((obj) => {
      obj.selectable = false;
      obj.evented = false;
    });
  }

  protected cleanupEventListeners(): void {
    if (!this.canvas) return;
    this.canvas.defaultCursor = 'default';
    this.canvas.skipTargetFind = false;
  }

  onMouseDown(point: Point, _event: MouseEvent): void {
    this.isPanning = true;
    this.lastPoint = { x: point.x, y: point.y };
    if (this.canvas) {
      this.canvas.defaultCursor = 'grabbing';
    }
  }

  onMouseMove(point: Point, _event: MouseEvent): void {
    if (!this.isPanning || !this.lastPoint || !this.canvas) return;

    const vpt = this.canvas.viewportTransform;
    if (vpt) {
      vpt[4] += point.x - this.lastPoint.x;
      vpt[5] += point.y - this.lastPoint.y;
      this.canvas.setViewportTransform(vpt);
      this.canvas.requestRenderAll();
    }

    this.lastPoint = { x: point.x, y: point.y };
  }

  onMouseUp(_point: Point, _event: MouseEvent): void {
    this.isPanning = false;
    this.lastPoint = null;
    if (this.canvas) {
      this.canvas.defaultCursor = 'grab';
    }
  }

  onTouchStart(point: TouchPoint): void {
    this.isPanning = true;
    this.lastPoint = { x: point.x, y: point.y };
  }

  onTouchMove(point: TouchPoint): void {
    if (!this.isPanning || !this.lastPoint || !this.canvas) return;

    const vpt = this.canvas.viewportTransform;
    if (vpt) {
      vpt[4] += point.x - this.lastPoint.x;
      vpt[5] += point.y - this.lastPoint.y;
      this.canvas.setViewportTransform(vpt);
      this.canvas.requestRenderAll();
    }

    this.lastPoint = { x: point.x, y: point.y };
  }

  onTouchEnd(_point: TouchPoint): void {
    this.isPanning = false;
    this.lastPoint = null;
  }

  cancel(): void {
    this.isPanning = false;
    this.lastPoint = null;
    super.cancel();
  }
}
