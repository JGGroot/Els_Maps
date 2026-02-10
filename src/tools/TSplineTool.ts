import { Path, Polyline, Circle, Point } from 'fabric';
import type { FabricObject } from 'fabric';
import { ToolType } from '@/types';
import type { TouchPoint } from '@/types';
import { BaseTool } from './BaseTool';
import { LAYOUT } from '@/constants';
import {
  snapManager,
  buildPathString,
  mergePathShapeWithTargets,
  type SnapResult,
  type SnapPoint,
  type PathShape,
  type MergeTarget
} from '@/utils';

export class TSplineTool extends BaseTool {
  type = ToolType.TSPLINE;
  name = 'T-Spline';
  icon = 'tspline';

  private controlPoints: Point[] = [];
  private previewPath: Path | null = null;
  private ghostLine: Path | null = null;
  private pointMarkers: Circle[] = [];
  private isDragging: boolean = false;
  private dragStartPoint: Point | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private startSnap: { type: 'start' | 'end'; object: FabricObject } | null = null;
  private endSnap: { type: 'start' | 'end'; object: FabricObject } | null = null;

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

    snapManager.hideSnapIndicator();
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
    } else if (this.drawing && this.controlPoints.length > 0) {
      // Show ghost line from last point to cursor when not dragging
      this.updateGhostLine(displayPoint);
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
    } else if (event.key === 'z' && (event.ctrlKey || event.metaKey)) {
      this.undoLastPoint();
    }
  }

  private undoLastPoint(): void {
    if (this.controlPoints.length === 0) return;

    this.controlPoints.pop();
    const marker = this.pointMarkers.pop();
    if (marker && this.canvas) {
      this.canvas.remove(marker);
    }

    if (this.controlPoints.length === 0) {
      this.cancelDrawing();
    } else {
      this.updatePreviewPath();
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

      if (snapResult.snapped && snapResult.snapPoint?.object) {
        this.startSnap = {
          type: snapResult.snapPoint.type,
          object: snapResult.snapPoint.object
        };
      } else {
        this.startSnap = null;
      }
    }

    if (snapResult.snapped && snapResult.snapPoint?.object) {
      this.endSnap = {
        type: snapResult.snapPoint.type,
        object: snapResult.snapPoint.object
      };
    } else {
      this.endSnap = null;
    }

    this.controlPoints.push(finalPoint);
    this.addPointMarker(finalPoint);
    this.clearSnapIndicator();
    // Clear ghost line when adding a new point
    if (this.ghostLine && this.canvas) {
      this.canvas.remove(this.ghostLine);
      this.ghostLine = null;
    }
    this.updatePreviewPath();
  }

  private findLocalSnap(point: Point): SnapResult {
    if (!snapManager.isEnabled()) {
      return { snapped: false, point };
    }
    if (this.controlPoints.length > 1) {
      const start = this.controlPoints[0];
      const dist = Math.hypot(point.x - start.x, point.y - start.y);
      if (dist <= snapManager.getAdjustedThreshold()) {
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

  private updateGhostLine(toPoint: Point): void {
    if (!this.canvas || this.controlPoints.length === 0) return;

    if (this.ghostLine) {
      this.canvas.remove(this.ghostLine);
    }

    // Generate a curve preview with the cursor position as the next point
    const previewPoints = [...this.controlPoints, toPoint];
    const pathData = this.generateCatmullRomPath(previewPoints);

    this.ghostLine = new Path(pathData, {
      stroke: this.config?.strokeColor ?? '#ffffff',
      strokeWidth: this.config?.strokeWidth ?? 2,
      strokeDashArray: [5, 5],
      fill: 'transparent',
      selectable: false,
      evented: false,
      opacity: 0.6
    });
    (this.ghostLine as any).isHelper = true;

    this.canvas.add(this.ghostLine);
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

    const shape = this.buildPathShape(this.controlPoints);
    const startTarget = this.getMergeTarget(this.startSnap);
    const endTarget = this.getMergeTarget(this.endSnap);

    if (shape && (startTarget || endTarget)) {
      const merged = mergePathShapeWithTargets(shape, startTarget ?? undefined, endTarget ?? undefined);
      if (merged) {
        const source = startTarget?.object ?? endTarget?.object ?? null;
        const stroke = (source?.stroke as string) ?? this.config?.strokeColor ?? '#ffffff';
        const strokeWidth = (source?.strokeWidth as number) ?? this.config?.strokeWidth ?? 2;

        merged.remove.forEach((obj) => this.canvas!.remove(obj));

        const pathData = buildPathString(merged.shape);
        const finalPath = new Path(pathData, {
          stroke,
          strokeWidth,
          fill: 'transparent',
          selectable: true,
          evented: true
        });

        this.canvas.add(finalPath);
        this.canvas.requestRenderAll();
        this.resetState();
        return;
      }
    }

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
    if (!snapResult.snapped || !snapResult.snapPoint) {
      this.endSnap = null;
      return;
    }

    this.controlPoints[lastIndex] = snapResult.point;
    const marker = this.pointMarkers[lastIndex];
    if (marker) {
      marker.set({ left: snapResult.point.x, top: snapResult.point.y });
    }

    if (snapResult.snapPoint.object) {
      this.endSnap = {
        type: snapResult.snapPoint.type,
        object: snapResult.snapPoint.object
      };
    } else {
      this.endSnap = null;
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

    if (this.ghostLine) {
      this.canvas.remove(this.ghostLine);
      this.ghostLine = null;
    }

    this.pointMarkers.forEach((marker) => this.canvas!.remove(marker));
    this.pointMarkers = [];
    this.clearSnapIndicator();
  }

  private updateSnapIndicator(x: number, y: number): void {
    snapManager.showSnapIndicator(x, y);
  }

  private clearSnapIndicator(): void {
    snapManager.hideSnapIndicator();
  }

  private resetState(): void {
    this.controlPoints = [];
    this.drawing = false;
    this.isDragging = false;
    this.dragStartPoint = null;
    this.startSnap = null;
    this.endSnap = null;
    this.context?.hideActionButton();
    this.context?.updateReticle(0, 0, false);
  }

  private getMergeTarget(
    snap: { type: 'start' | 'end'; object: FabricObject } | null
  ): MergeTarget | null {
    if (!snap?.object) return null;
    if (!(snap.object instanceof Path) && !(snap.object instanceof Polyline)) {
      return null;
    }
    return { object: snap.object, type: snap.type };
  }

  private buildPathShape(points: Point[]): PathShape | null {
    if (points.length === 0) return null;
    const start = points[0];
    const segments: PathShape['segments'] = [];

    if (points.length === 1) {
      return { start, segments };
    }

    if (points.length === 2) {
      const end = points[1];
      segments.push({ cp1: end, cp2: end, end });
      return { start, segments };
    }

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      segments.push({
        cp1: new Point(cp1x, cp1y),
        cp2: new Point(cp2x, cp2y),
        end: p2
      });
    }

    return { start, segments };
  }

  cancel(): void {
    this.cancelDrawing();
    super.cancel();
  }

  getPreview(): FabricObject | null {
    return this.previewPath;
  }
}
