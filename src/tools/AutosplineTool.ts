import { Path, Circle, Point } from 'fabric';
import type { FabricObject } from 'fabric';
import { ToolType } from '@/types';
import type { TouchPoint } from '@/types';
import { BaseTool } from './BaseTool';
import { LAYOUT } from '@/constants';
import { snapManager } from '@/utils';

/**
 * AutosplineTool - Auto-completing bezier curves
 * As you draw points, it predicts and smooths the curve automatically
 * with intelligent handle placement based on surrounding points
 */
export class AutosplineTool extends BaseTool {
  type = ToolType.AUTOSPLINE;
  name = 'Autospline';
  icon = 'autospline';

  private points: Point[] = [];
  private previewPath: Path | null = null;
  private pointMarkers: Circle[] = [];
  private isDrawingFreehand: boolean = false;
  private freehandPoints: Point[] = [];
  private snapIndicator: Circle | null = null;
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

    this.isDrawingFreehand = true;
    this.freehandPoints = [point];

    if (!this.drawing) {
      this.drawing = true;
      if (this.isMobile) {
        this.context?.showActionButton('both');
      }
    }

    this.addPoint(point);
  }

  onMouseMove(point: Point, _event: MouseEvent): void {
    // Show snap indicator when hovering near endpoints
    if (!this.isDrawingFreehand) {
      const localSnap = this.findLocalSnap(point);
      const snapResult = localSnap.snapped ? localSnap : snapManager.findNearestEndpoint(point);
      if (snapResult.snapped && snapResult.snapPoint) {
        this.updateSnapIndicator(snapResult.snapPoint.x, snapResult.snapPoint.y);
      } else {
        this.clearSnapIndicator();
      }
    }

    if (this.isDrawingFreehand) {
      // Collect freehand points for prediction
      this.freehandPoints.push(point);
      this.updateFreehandPreview();
    } else if (this.drawing && this.points.length > 0) {
      const localSnap = this.findLocalSnap(point);
      const snapResult = localSnap.snapped ? localSnap : snapManager.findNearestEndpoint(point);
      const displayPoint = snapResult.snapped ? snapResult.point : point;
      this.updatePreviewPath(displayPoint);
    }
  }

  onMouseUp(point: Point, _event: MouseEvent): void {
    if (this.isDrawingFreehand && this.freehandPoints.length > 2) {
      // Auto-fit curve to freehand points
      this.autoFitCurve();
    }
    this.isDrawingFreehand = false;
    this.freehandPoints = [];
    void point;
  }

  onTouchStart(point: TouchPoint): void {
    const fabricPoint = new Point(point.x, point.y);
    this.isDrawingFreehand = true;
    this.freehandPoints = [fabricPoint];

    if (!this.drawing) {
      this.drawing = true;
      if (this.isMobile) {
        this.context?.showActionButton('both');
      }
    }

    this.addPoint(fabricPoint);

    if (this.isMobile) {
      this.context?.updateReticle(point.x, point.y - LAYOUT.reticleOffset, true);
    }
  }

  onTouchMove(point: TouchPoint): void {
    const fabricPoint = new Point(point.x, point.y);

    if (this.isDrawingFreehand) {
      this.freehandPoints.push(fabricPoint);
      this.updateFreehandPreview();
    }
    if (!this.isDrawingFreehand) {
      const localSnap = this.findLocalSnap(fabricPoint);
      const snapResult = localSnap.snapped ? localSnap : snapManager.findNearestEndpoint(fabricPoint);
      const displayPoint = snapResult.snapped ? snapResult.point : fabricPoint;
      if (snapResult.snapped && snapResult.snapPoint) {
        this.updateSnapIndicator(snapResult.snapPoint.x, snapResult.snapPoint.y);
      } else {
        this.clearSnapIndicator();
      }
      if (this.drawing && this.points.length > 0) {
        this.updatePreviewPath(displayPoint);
      }
    }

    if (this.isMobile) {
      this.context?.updateReticle(point.x, point.y - LAYOUT.reticleOffset, true);
    }
  }

  onTouchEnd(point: TouchPoint): void {
    if (this.isDrawingFreehand && this.freehandPoints.length > 2) {
      this.autoFitCurve();
    }
    this.isDrawingFreehand = false;
    this.freehandPoints = [];

    if (this.isMobile) {
      this.context?.updateReticle(0, 0, false);
    }
    void point;
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.cancelDrawing();
    } else if (event.key === 'Enter') {
      this.finishDrawing();
    } else if (event.key === 'z' && (event.ctrlKey || event.metaKey)) {
      this.undoLastPoint();
    }
  }

  onActionConfirm(): void {
    this.finishDrawing();
  }

  onActionCancel(): void {
    this.cancelDrawing();
  }

  private addPoint(point: Point): void {
    if (!this.canvas) return;

    const localSnap = this.findLocalSnap(point);
    const snapResult = localSnap.snapped ? localSnap : snapManager.findNearestEndpoint(point);
    const finalPoint = snapResult.snapped ? snapResult.point : point;

    this.points.push(finalPoint);
    this.addPointMarker(finalPoint);
    this.updatePreviewPath();
  }

  private findLocalSnap(point: Point): { snapped: boolean; point: Point; snapPoint?: { x: number; y: number } } {
    if (this.points.length > 1) {
      const start = this.points[0];
      const dist = Math.hypot(point.x - start.x, point.y - start.y);
      if (dist <= this.localSnapThreshold) {
        return { snapped: true, point: new Point(start.x, start.y), snapPoint: { x: start.x, y: start.y } };
      }
    }
    return { snapped: false, point };
  }

  private autoFitCurve(): void {
    if (this.freehandPoints.length < 3) return;

    // Simplify freehand points using Ramer-Douglas-Peucker algorithm
    const simplified = this.simplifyPath(this.freehandPoints, 5);

    // Replace last point with simplified curve points
    if (this.points.length > 0) {
      this.points.pop();
      const marker = this.pointMarkers.pop();
      if (marker && this.canvas) {
        this.canvas.remove(marker);
      }
    }

    // Add simplified points
    simplified.forEach((p) => {
      this.points.push(p);
      this.addPointMarker(p);
    });

    this.updatePreviewPath();
  }

  private simplifyPath(points: Point[], tolerance: number): Point[] {
    if (points.length < 3) return points;

    const result: Point[] = [points[0]];
    let lastIndex = 0;

    for (let i = 1; i < points.length - 1; i++) {
      const dist = this.perpendicularDistance(
        points[i],
        points[lastIndex],
        points[points.length - 1]
      );

      if (dist > tolerance) {
        result.push(points[i]);
        lastIndex = i;
      }
    }

    result.push(points[points.length - 1]);
    return result;
  }

  private perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lineLengthSquared = dx * dx + dy * dy;

    if (lineLengthSquared === 0) {
      return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
    }

    const t = Math.max(0, Math.min(1,
      ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lineLengthSquared
    ));

    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;

    return Math.hypot(point.x - projX, point.y - projY);
  }

  private updateFreehandPreview(): void {
    if (!this.canvas || this.freehandPoints.length < 2) return;

    // Show a live preview of the freehand stroke
    if (this.previewPath) {
      this.canvas.remove(this.previewPath);
    }

    const allPoints = [...this.points.slice(0, -1), ...this.freehandPoints];
    const pathData = this.generateSmoothPath(allPoints);

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

  private addPointMarker(point: Point): void {
    if (!this.canvas) return;

    const marker = new Circle({
      left: point.x,
      top: point.y,
      radius: 4,
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
    this.canvas.requestRenderAll();
  }

  private updatePreviewPath(cursorPoint?: Point): void {
    if (!this.canvas || this.points.length === 0) return;

    if (this.previewPath) {
      this.canvas.remove(this.previewPath);
    }

    const pointsToRender = cursorPoint
      ? [...this.points, cursorPoint]
      : this.points;

    const pathData = this.generateSmoothPath(pointsToRender);

    this.previewPath = new Path(pathData, {
      stroke: this.config?.strokeColor ?? '#ffffff',
      strokeWidth: this.config?.strokeWidth ?? 2,
      fill: 'transparent',
      selectable: false,
      evented: false
    });
    (this.previewPath as any).isHelper = true;

    this.canvas.add(this.previewPath);
    this.canvas.requestRenderAll();
  }

  private generateSmoothPath(points: Point[]): string {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    if (points.length === 2) {
      return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    }

    // Generate smooth bezier curve using Catmull-Rom to Bezier conversion
    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      // Catmull-Rom to Bezier control points
      const tension = 0.3; // Lower = smoother, Higher = tighter
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    return path;
  }

  private finishDrawing(): void {
    if (!this.canvas || this.points.length < 2) {
      this.cancelDrawing();
      return;
    }

    this.snapLastPointIfNeeded();
    this.clearTemporaryObjects();

    const pathData = this.generateSmoothPath(this.points);

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
    if (this.points.length === 0) return;
    const lastIndex = this.points.length - 1;
    const lastPoint = this.points[lastIndex];
    const snapResult = snapManager.findNearestEndpoint(lastPoint);
    if (!snapResult.snapped || !snapResult.snapPoint) return;

    this.points[lastIndex] = snapResult.point;
    const marker = this.pointMarkers[lastIndex];
    if (marker) {
      marker.set({ left: snapResult.point.x, top: snapResult.point.y });
    }
  }

  private cancelDrawing(): void {
    this.clearTemporaryObjects();
    this.resetState();
  }

  private undoLastPoint(): void {
    if (this.points.length === 0) return;

    this.points.pop();
    const marker = this.pointMarkers.pop();
    if (marker && this.canvas) {
      this.canvas.remove(marker);
    }

    if (this.points.length === 0) {
      this.cancelDrawing();
    } else {
      this.updatePreviewPath();
    }
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
    this.points = [];
    this.freehandPoints = [];
    this.isDrawingFreehand = false;
    this.drawing = false;
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
