import { Polyline, Line, Circle, Point } from 'fabric';
import type { FabricObject } from 'fabric';
import { ToolType } from '@/types';
import type { TouchPoint } from '@/types';
import { BaseTool } from './BaseTool';
import { LAYOUT } from '@/constants';
import { snapManager } from '@/utils';

export class PolylineTool extends BaseTool {
  type = ToolType.POLYLINE;
  name = 'Line';
  icon = 'pen-tool';

  private points: Point[] = [];
  private committedLines: Line[] = [];
  private ghostLine: Line | null = null;
  private pointMarkers: Circle[] = [];
  private snapIndicator: Circle | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private startSnap: { type: 'start' | 'end'; object: FabricObject } | null = null;
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

  private finishDrawing(): void {
    if (!this.canvas || this.points.length < 2) {
      this.cancelDrawing();
      return;
    }

    // Remove temporary objects (ghost line and markers)
    this.clearTemporaryObjects();

    // Remove the individual committed lines
    this.committedLines.forEach((line) => this.canvas!.remove(line));
    this.committedLines = [];

    // If we snapped to an existing polyline endpoint, merge into it
    if (this.startSnap?.object instanceof Polyline) {
      const mergedPoints = this.mergeWithPolyline(this.startSnap.object, this.startSnap.type);
      if (mergedPoints.length >= 2) {
        this.canvas.remove(this.startSnap.object);
        const merged = new Polyline(mergedPoints, {
          stroke: this.startSnap.object.stroke ?? this.config?.strokeColor ?? '#ffffff',
          strokeWidth: this.startSnap.object.strokeWidth ?? this.config?.strokeWidth ?? 2,
          fill: 'transparent',
          selectable: true,
          evented: true
        });
        this.canvas.add(merged);
        this.canvas.requestRenderAll();
      }
    } else {
      // Create final polyline object
    const polyline = new Polyline(this.points, {
      stroke: this.config?.strokeColor ?? '#ffffff',
      strokeWidth: this.config?.strokeWidth ?? 2,
      fill: 'transparent',
      selectable: true,
      evented: true
    });

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
    this.context?.hideActionButton();
    this.context?.updateReticle(0, 0, false);
  }

  private mergeWithPolyline(polyline: Polyline, snapType: 'start' | 'end'): Point[] {
    const existingPoints = this.getCanvasPoints(polyline);
    const newPoints = this.points;

    if (existingPoints.length === 0) {
      return newPoints;
    }

    const toAdd = newPoints.slice(1); // exclude snapped point
    if (toAdd.length === 0) {
      return existingPoints;
    }

    if (snapType === 'end') {
      return [...existingPoints, ...toAdd];
    }

    return [...toAdd.reverse(), ...existingPoints];
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

  cancel(): void {
    this.cancelDrawing();
    super.cancel();
  }

  getPreview(): FabricObject | null {
    return this.ghostLine;
  }
}
