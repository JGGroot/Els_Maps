import { Path, Circle, Point } from 'fabric';
import type { FabricObject } from 'fabric';
import { ToolType } from '@/types';
import type { TouchPoint } from '@/types';
import { BaseTool } from './BaseTool';
import { LAYOUT } from '@/constants';
import { snapManager, type SnapResult, type SnapPoint } from '@/utils';

export class TSplineTool extends BaseTool {
  type = ToolType.TSPLINE;
  name = 'T-Spline';
  icon = 'tspline';

  private controlPoints: Point[] = [];
  private previewPath: Path | null = null;
  private pointMarkers: Circle[] = [];
  private snapIndicator: Circle | null = null;
  private isDragging: boolean = false;
  private dragStartPoint: Point | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private readonly localSnapThreshold: number = 25;

  protected setupEventListeners(): void {
    if (!this.canvas) return;

    this.canvas.selection = false;
    this.canvas.skipTargetFind = true;
    this.canvas.forEachObject((obj) => {
      obj.selectable = false;
      obj.evented = false;
    });

    snapManager.setCanvas(this.canvas);

    this.keydownHandler = (e: KeyboardEvent) => this.onKeyDown(e);
    window.addEventListener('keydown', this.keydownHandler);
  }

  protected cleanupEventListeners(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

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
      this.finishDrawing();
      return;
    }

    this.isDragging = true;
    this.dragStartPoint = point;
    this.addControlPoint(point);
  }

  onMouseMove(point: Point, _event: MouseEvent): void {
    const localSnap = this.findLocalSnap(point);
    const snapResult = localSnap.snapped ? localSnap : snapManager.findNearestEndpoint(point);
    const displayPoint = snapResult.snapped ? snapResult.point : point;
    if (snapResult.snapped && snapResult.snapPoint) {
      this.updateSnapIndicator(snapResult.snapPoint.x, snapResult.snapPoint.y);
    } else {
      this.clearSnapIndicator();
    }

    if (this.isDragging && this.dragStartPoint) {
      this.updateLastControlPoint(displayPoint);
      this.updatePreviewPath();
    }
  }

  onMouseUp(point: Point, _event: MouseEvent): void {
    if (this.isDragging) {
      this.updateLastControlPoint(point);
      this.isDragging = false;
      this.dragStartPoint = null;
      this.updatePreviewPath();
    }
  }

  onTouchStart(point: TouchPoint): void {
    const fabricPoint = new Point(point.x, point.y);
    this.isDragging = true;
    this.dragStartPoint = fabricPoint;
    this.addControlPoint(fabricPoint);

    if (this.isMobile) {
      this.context?.updateReticle(point.x, point.y - LAYOUT.reticleOffset, true);
    }
  }

  onTouchMove(point: TouchPoint): void {
    if (this.isDragging) {
      const fabricPoint = new Point(point.x, point.y);
      const localSnap = this.findLocalSnap(fabricPoint);
      const snapResult = localSnap.snapped ? localSnap : snapManager.findNearestEndpoint(fabricPoint);
      const displayPoint = snapResult.snapped ? snapResult.point : fabricPoint;
      if (snapResult.snapped && snapResult.snapPoint) {
        this.updateSnapIndicator(snapResult.snapPoint.x, snapResult.snapPoint.y);
      } else {
        this.clearSnapIndicator();
      }
      this.updateLastControlPoint(displayPoint);
      this.updatePreviewPath();

      if (this.isMobile) {
        this.context?.updateReticle(point.x, point.y - LAYOUT.reticleOffset, true);
      }
    }
  }

  onTouchEnd(point: TouchPoint): void {
    if (this.isDragging) {
      const fabricPoint = new Point(point.x, point.y);
      this.updateLastControlPoint(fabricPoint);
      this.isDragging = false;
      this.dragStartPoint = null;
      this.updatePreviewPath();
    }

    if (this.isMobile) {
      this.context?.updateReticle(0, 0, false);
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.cancelDrawing();
    } else if (event.key === 'Enter') {
      this.finishDrawing();
    }
  }

  onActionConfirm(): void {
    this.finishDrawing();
  }

  onActionCancel(): void {
    this.cancelDrawing();
  }

  private addControlPoint(point: Point): void {
    if (!this.canvas) return;

    // Try to snap to nearest endpoint
    const localSnap = this.findLocalSnap(point);
    const snapResult = localSnap.snapped ? localSnap : snapManager.findNearestEndpoint(point);
    const finalPoint = snapResult.snapped ? snapResult.point : point;

    if (!this.drawing) {
      this.drawing = true;
      if (this.isMobile) {
        this.context?.showActionButton('both');
      }
    }

    this.controlPoints.push(finalPoint);
    this.addPointMarker(finalPoint);
    this.clearSnapIndicator();
    this.updatePreviewPath();
  }

  private findLocalSnap(point: Point): SnapResult {
    if (this.controlPoints.length > 1) {
      const start = this.controlPoints[0];
      const dist = Math.hypot(point.x - start.x, point.y - start.y);
      if (dist <= this.localSnapThreshold) {
        const snapPoint: SnapPoint = {
          x: start.x,
          y: start.y,
          objectId: 'local-start',
          type: 'start'
        };
        return { snapped: true, point: new Point(start.x, start.y), snapPoint };
      }
    }
    return { snapped: false, point };
  }

  private updateLastControlPoint(point: Point): void {
    if (this.controlPoints.length === 0) return;

    this.controlPoints[this.controlPoints.length - 1] = point;

    const lastMarker = this.pointMarkers[this.pointMarkers.length - 1];
    if (lastMarker) {
      lastMarker.set({ left: point.x, top: point.y });
    }
  }

  private addPointMarker(point: Point): void {
    if (!this.canvas) return;

    const marker = new Circle({
      left: point.x,
      top: point.y,
      radius: this.isMobile ? 8 : 5,
      fill: this.config?.strokeColor ?? '#ffffff',
      stroke: '#000000',
      strokeWidth: 1,
      selectable: false,
      evented: false,
      originX: 'center',
      originY: 'center'
    });

    this.pointMarkers.push(marker);
    this.canvas.add(marker);
  }

  private updatePreviewPath(): void {
    if (!this.canvas || this.controlPoints.length < 2) return;

    if (this.previewPath) {
      this.canvas.remove(this.previewPath);
    }

    const pathData = this.generateCatmullRomPath(this.controlPoints);

    this.previewPath = new Path(pathData, {
      stroke: this.config?.strokeColor ?? '#ffffff',
      strokeWidth: this.config?.strokeWidth ?? 2,
      fill: 'transparent',
      selectable: false,
      evented: false,
      opacity: 0.8
    });
    (this.previewPath as any).isHelper = true;

    this.canvas.add(this.previewPath);
    this.canvas.requestRenderAll();
  }

  private generateCatmullRomPath(points: Point[]): string {
    if (points.length < 2) return '';
    if (points.length === 2) {
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    return path;
  }

  private finishDrawing(): void {
    if (!this.canvas || this.controlPoints.length < 2) {
      this.cancelDrawing();
      return;
    }

    this.snapLastPointIfNeeded();
    this.clearTemporaryObjects();

    const pathData = this.generateCatmullRomPath(this.controlPoints);

    const finalPath = new Path(pathData, {
      stroke: this.config?.strokeColor ?? '#ffffff',
      strokeWidth: this.config?.strokeWidth ?? 2,
      fill: 'transparent',
      selectable: true,
      evented: true
    });

    this.canvas.add(finalPath);
    this.canvas.requestRenderAll();

    this.resetState();
  }

  private snapLastPointIfNeeded(): void {
    if (this.controlPoints.length === 0) return;
    const lastIndex = this.controlPoints.length - 1;
    const lastPoint = this.controlPoints[lastIndex];
    const snapResult = snapManager.findNearestEndpoint(lastPoint);
    if (!snapResult.snapped || !snapResult.snapPoint) return;

    this.controlPoints[lastIndex] = snapResult.point;
    const marker = this.pointMarkers[lastIndex];
    if (marker) {
      marker.set({ left: snapResult.point.x, top: snapResult.point.y });
    }
  }

  private cancelDrawing(): void {
    this.clearTemporaryObjects();
    this.resetState();
  }

  private clearTemporaryObjects(): void {
    if (!this.canvas) return;

    if (this.previewPath) {
      this.canvas.remove(this.previewPath);
      this.previewPath = null;
    }

    this.pointMarkers.forEach((marker) => this.canvas!.remove(marker));
    this.pointMarkers = [];
    this.clearSnapIndicator();
  }

  private updateSnapIndicator(x: number, y: number): void {
    if (!this.canvas) return;

    if (!this.snapIndicator) {
      this.snapIndicator = new Circle({
        radius: 8,
        fill: 'transparent',
        stroke: '#4a9eff',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false
      });
      this.canvas.add(this.snapIndicator);
    }

    this.snapIndicator.set({ left: x, top: y });
    this.canvas.requestRenderAll();
  }

  private clearSnapIndicator(): void {
    if (this.snapIndicator && this.canvas) {
      this.canvas.remove(this.snapIndicator);
      this.snapIndicator = null;
    }
  }

  private resetState(): void {
    this.controlPoints = [];
    this.drawing = false;
    this.isDragging = false;
    this.dragStartPoint = null;
    this.context?.hideActionButton();
    this.context?.updateReticle(0, 0, false);
  }

  cancel(): void {
    this.cancelDrawing();
    super.cancel();
  }

  getPreview(): FabricObject | null {
    return this.previewPath;
  }
}
