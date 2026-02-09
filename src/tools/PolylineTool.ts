import { Polyline, Polygon, Line, Circle, Point } from 'fabric';
import type { FabricObject } from 'fabric';
import { ToolType } from '@/types';
import type { TouchPoint } from '@/types';
import { BaseTool } from './BaseTool';
import { LAYOUT } from '@/constants';
import { snapManager, type SnapResult, type SnapPoint } from '@/utils';

export class PolylineTool extends BaseTool {
  type = ToolType.POLYLINE;
  name = 'Line';
  icon = 'line';

  private points: Point[] = [];
  private committedLines: Line[] = [];
  private ghostLine: Line | null = null;
  private pointMarkers: Circle[] = [];
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

    this.addPoint(point);
  }

  onMouseMove(point: Point, _event: MouseEvent): void {
    // Show snap indicator even before drawing starts
    if (!this.drawing) {
      const snapResult = snapManager.findNearestEndpoint(point);
      if (snapResult.snapped && snapResult.snapPoint) {
        this.updateSnapIndicator(snapResult.snapPoint.x, snapResult.snapPoint.y);
      } else {
        this.clearSnapIndicator();
      }
    } else if (this.points.length > 0) {
      this.updateGhostLine(point);
    }
  }

  onMouseUp(_point: Point, _event: MouseEvent): void {
    // Point is committed on mousedown
  }

  onTouchStart(point: TouchPoint): void {
    const fabricPoint = new Point(point.x, point.y);
    this.addPoint(fabricPoint);

    if (this.isMobile) {
      this.context?.updateReticle(point.x, point.y - LAYOUT.reticleOffset, true);
    }
  }

  onTouchMove(point: TouchPoint): void {
    if (this.drawing && this.points.length > 0) {
      const fabricPoint = new Point(point.x, point.y);
      this.updateGhostLine(fabricPoint);

      if (this.isMobile) {
        this.context?.updateReticle(point.x, point.y - LAYOUT.reticleOffset, true);
      }
    }
  }

  onTouchEnd(point: TouchPoint): void {
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

    // Try to snap to nearest endpoint (especially useful for first point)
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

    // Add solid line segment from previous point to this one
    if (this.points.length > 0) {
      const prevPoint = this.points[this.points.length - 1];
      this.addCommittedLine(prevPoint, finalPoint);
    }

    this.points.push(finalPoint);
    this.addPointMarker(finalPoint);
    this.clearSnapIndicator();

    // Update ghost line to start from new point
    this.updateGhostLine(finalPoint);
  }

  private addCommittedLine(from: Point, to: Point): void {
    if (!this.canvas) return;

    const line = new Line([from.x, from.y, to.x, to.y], {
      stroke: this.config?.strokeColor ?? '#ffffff',
      strokeWidth: this.config?.strokeWidth ?? 2,
      selectable: false,
      evented: false
    });
    (line as any).isHelper = true;

    this.committedLines.push(line);
    this.canvas.add(line);
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

  private updateGhostLine(toPoint: Point): void {
    if (!this.canvas || this.points.length === 0) return;

    const lastPoint = this.points[this.points.length - 1];

    // Check for snap (include local start point)
    const localSnap = this.findLocalSnap(toPoint);
    const snapResult = localSnap.snapped ? localSnap : snapManager.findNearestEndpoint(toPoint);
    const displayPoint = snapResult.snapped ? snapResult.point : toPoint;

    // Update snap indicator
    if (snapResult.snapped && snapResult.snapPoint) {
      this.updateSnapIndicator(snapResult.snapPoint.x, snapResult.snapPoint.y);
    } else {
      this.clearSnapIndicator();
    }

    if (this.ghostLine) {
      this.canvas.remove(this.ghostLine);
    }

    this.ghostLine = new Line(
      [lastPoint.x, lastPoint.y, displayPoint.x, displayPoint.y],
      {
        stroke: this.config?.strokeColor ?? '#ffffff',
        strokeWidth: this.config?.strokeWidth ?? 2,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
        opacity: 0.6
      }
    );
    (this.ghostLine as any).isHelper = true;

    this.canvas.add(this.ghostLine);
    this.canvas.requestRenderAll();
  }

  private findLocalSnap(point: Point): SnapResult {
    if (!snapManager.isEnabled()) {
      return { snapped: false, point };
    }
    if (this.points.length > 1) {
      const start = this.points[0];
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

  private updateSnapIndicator(x: number, y: number): void {
    snapManager.showSnapIndicator(x, y);
  }

  private clearSnapIndicator(): void {
    snapManager.hideSnapIndicator();
  }

  private finishDrawing(): void {
    if (!this.canvas || this.points.length < 2) {
      this.cancelDrawing();
      return;
    }

    const { points: finalPoints, closed } = this.getFinalPoints();
    if (finalPoints.length < 2) {
      this.cancelDrawing();
      return;
    }

    // Remove temporary objects (ghost line and markers)
    this.clearTemporaryObjects();

    // Remove the individual committed lines
    this.committedLines.forEach((line) => this.canvas!.remove(line));
    this.committedLines = [];

    const startTarget = this.startSnap?.object instanceof Polyline
      ? { object: this.startSnap.object, type: this.startSnap.type }
      : null;
    const endTarget = this.endSnap?.object instanceof Polyline
      ? { object: this.endSnap.object, type: this.endSnap.type }
      : null;

    if (startTarget || endTarget) {
      this.mergeWithTargets(startTarget, endTarget, finalPoints);
    } else {
      // Create final polyline/polygon object
      const shapeOptions = {
        stroke: this.config?.strokeColor ?? '#ffffff',
        strokeWidth: this.config?.strokeWidth ?? 2,
        fill: 'transparent',
        selectable: true,
        evented: true
      };

      const polyline = closed
        ? new Polygon(finalPoints, shapeOptions)
        : new Polyline(finalPoints, shapeOptions);

      this.canvas.add(polyline);
      this.canvas.requestRenderAll();
    }

    this.resetState();
  }

  private cancelDrawing(): void {
    this.clearTemporaryObjects();

    // Remove committed lines too
    if (this.canvas) {
      this.committedLines.forEach((line) => this.canvas!.remove(line));
    }
    this.committedLines = [];

    this.resetState();
  }

  private undoLastPoint(): void {
    if (this.points.length === 0) return;

    this.points.pop();

    // Remove the last point marker
    const marker = this.pointMarkers.pop();
    if (marker && this.canvas) {
      this.canvas.remove(marker);
    }

    // Remove the last committed line
    const line = this.committedLines.pop();
    if (line && this.canvas) {
      this.canvas.remove(line);
    }

    if (this.points.length === 0) {
      this.cancelDrawing();
    } else if (this.canvas) {
      this.canvas.requestRenderAll();
    }
  }

  private clearTemporaryObjects(): void {
    if (!this.canvas) return;

    if (this.ghostLine) {
      this.canvas.remove(this.ghostLine);
      this.ghostLine = null;
    }

    this.clearSnapIndicator();

    this.pointMarkers.forEach((marker) => this.canvas!.remove(marker));
    this.pointMarkers = [];
  }

  private resetState(): void {
    this.points = [];
    this.drawing = false;
    this.startSnap = null;
    this.endSnap = null;
    this.context?.hideActionButton();
    this.context?.updateReticle(0, 0, false);
  }

  private mergeWithTargets(
    startTarget: { object: Polyline; type: 'start' | 'end' } | null,
    endTarget: { object: Polyline; type: 'start' | 'end' } | null,
    linePoints: Point[]
  ): void {
    if (!this.canvas) return;

    const removeObjects: Set<Polyline> = new Set();
    let stroke = this.config?.strokeColor ?? '#ffffff';
    let strokeWidth = this.config?.strokeWidth ?? 2;

    if (startTarget?.object) {
      stroke = (startTarget.object.stroke as string) ?? stroke;
      strokeWidth = (startTarget.object.strokeWidth as number) ?? strokeWidth;
    } else if (endTarget?.object) {
      stroke = (endTarget.object.stroke as string) ?? stroke;
      strokeWidth = (endTarget.object.strokeWidth as number) ?? strokeWidth;
    }

    if (startTarget && endTarget && startTarget.object === endTarget.object) {
      const existingPoints = this.getCanvasPoints(startTarget.object);
      const lineOriented = startTarget.type === 'end' ? linePoints : [...linePoints].reverse();
      let merged = [...existingPoints, ...lineOriented.slice(1)];
      if (merged.length > 1 && this.isSamePoint(merged[0], merged[merged.length - 1])) {
        merged = merged.slice(0, -1);
      }

      removeObjects.add(startTarget.object);
      const closedShape = new Polygon(merged, {
        stroke,
        strokeWidth,
        fill: 'transparent',
        selectable: true,
        evented: true
      });

      removeObjects.forEach((obj) => this.canvas!.remove(obj));
      this.canvas.add(closedShape);
      this.canvas.requestRenderAll();
      return;
    }

    let mergedPoints: Point[] = [];

    if (startTarget) {
      const existing = this.getCanvasPoints(startTarget.object);
      const oriented = startTarget.type === 'end' ? existing : [...existing].reverse();
      mergedPoints = [...oriented];
      removeObjects.add(startTarget.object);
    }

    const lineStartIndex = startTarget ? 1 : 0;
    const lineEndIndex = endTarget ? -1 : undefined;
    const lineMiddle = linePoints.slice(lineStartIndex, lineEndIndex);
    mergedPoints.push(...lineMiddle);

    if (endTarget) {
      const existing = this.getCanvasPoints(endTarget.object);
      const oriented = endTarget.type === 'start' ? existing : [...existing].reverse();
      mergedPoints.push(...oriented);
      removeObjects.add(endTarget.object);
    }

    if (mergedPoints.length < 2) {
      return;
    }

    removeObjects.forEach((obj) => this.canvas!.remove(obj));

    const mergedPolyline = new Polyline(mergedPoints, {
      stroke,
      strokeWidth,
      fill: 'transparent',
      selectable: true,
      evented: true
    });

    this.canvas.add(mergedPolyline);
    this.canvas.requestRenderAll();
  }

  private getFinalPoints(): { points: Point[]; closed: boolean } {
    if (this.points.length < 2) {
      return { points: [...this.points], closed: false };
    }

    const first = this.points[0];
    const last = this.points[this.points.length - 1];
    const dist = Math.hypot(first.x - last.x, first.y - last.y);

    if (dist <= 0.001) {
      return { points: this.points.slice(0, -1), closed: true };
    }

    return { points: [...this.points], closed: false };
  }

  private getCanvasPoints(polyline: Polyline): Point[] {
    const points = polyline.points ?? [];
    const matrix = polyline.calcTransformMatrix();
    const pathOffset = (polyline as any).pathOffset ?? { x: 0, y: 0 };

    return points.map((pt) => {
      const x = matrix[0] * (pt.x - pathOffset.x) + matrix[2] * (pt.y - pathOffset.y) + matrix[4];
      const y = matrix[1] * (pt.x - pathOffset.x) + matrix[3] * (pt.y - pathOffset.y) + matrix[5];
      return new Point(x, y);
    });
  }

  private isSamePoint(a: Point, b: Point, epsilon: number = 0.001): boolean {
    return Math.hypot(a.x - b.x, a.y - b.y) <= epsilon;
  }

  cancel(): void {
    this.cancelDrawing();
    super.cancel();
  }

  getPreview(): FabricObject | null {
    return this.ghostLine;
  }
}
