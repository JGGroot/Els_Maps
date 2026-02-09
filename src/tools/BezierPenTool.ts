import { Path, Polyline, Circle, Line, Point } from 'fabric';
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

interface BezierPoint {
  anchor: Point;
  handleIn: Point | null;
  handleOut: Point | null;
}

export class BezierPenTool extends BaseTool {
  type = ToolType.BEZIER_PEN;
  name = 'Pen';
  icon = 'bezier';

  private bezierPoints: BezierPoint[] = [];
  private previewPath: Path | null = null;
  private anchorMarkers: Circle[] = [];
  private handleLines: Line[] = [];
  private handleMarkers: Circle[] = [];
  private isDragging: boolean = false;
  private currentDragPoint: Point | null = null;
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
    this.currentDragPoint = point;

    // Add new bezier point
    this.addBezierPoint(point);
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

    if (this.isDragging && this.bezierPoints.length > 0) {
      // Update handles based on drag
      this.updateCurrentHandles(point);
    } else if (this.drawing && this.bezierPoints.length > 0) {
      // Show preview to cursor
      this.updatePreviewPath(displayPoint);
    }
  }

  onMouseUp(point: Point, _event: MouseEvent): void {
    if (this.isDragging) {
      this.finalizeDrag(point);
      this.isDragging = false;
      this.currentDragPoint = null;
    }
  }

  onTouchStart(point: TouchPoint): void {
    const fabricPoint = new Point(point.x, point.y);
    this.isDragging = true;
    this.currentDragPoint = fabricPoint;
    this.addBezierPoint(fabricPoint);

    if (this.isMobile) {
      this.context?.updateReticle(point.x, point.y - LAYOUT.reticleOffset, true);
    }
  }

  onTouchMove(point: TouchPoint): void {
    const fabricPoint = new Point(point.x, point.y);
    const localSnap = this.findLocalSnap(fabricPoint);
    const snapResult = localSnap.snapped ? localSnap : snapManager.findNearestEndpoint(fabricPoint);
    const displayPoint = snapResult.snapped ? snapResult.point : fabricPoint;
    if (snapResult.snapped && snapResult.snapPoint) {
      this.updateSnapIndicator(snapResult.snapPoint.x, snapResult.snapPoint.y);
    } else {
      this.clearSnapIndicator();
    }

    if (this.isDragging && this.bezierPoints.length > 0) {
      this.updateCurrentHandles(displayPoint);
    }

    if (this.isMobile) {
      this.context?.updateReticle(point.x, point.y - LAYOUT.reticleOffset, true);
    }
  }

  onTouchEnd(point: TouchPoint): void {
    if (this.isDragging) {
      const fabricPoint = new Point(point.x, point.y);
      this.finalizeDrag(fabricPoint);
      this.isDragging = false;
      this.currentDragPoint = null;
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

  onActionConfirm(): void {
    this.finishDrawing();
  }

  onActionCancel(): void {
    this.cancelDrawing();
  }

  private addBezierPoint(point: Point): void {
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

    const bezierPoint: BezierPoint = {
      anchor: finalPoint,
      handleIn: null,
      handleOut: null
    };

    this.bezierPoints.push(bezierPoint);
    this.addAnchorMarker(finalPoint);
    this.clearSnapIndicator();
    this.updatePreviewPath(finalPoint);
  }

  private findLocalSnap(point: Point): SnapResult {
    if (!snapManager.isEnabled()) {
      return { snapped: false, point };
    }
    if (this.bezierPoints.length > 1) {
      const start = this.bezierPoints[0].anchor;
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

  private updateCurrentHandles(dragPoint: Point): void {
    if (this.bezierPoints.length === 0 || !this.currentDragPoint) return;

    const currentPoint = this.bezierPoints[this.bezierPoints.length - 1];
    const anchor = currentPoint.anchor;

    // Calculate handle positions (symmetric around anchor)
    const dx = dragPoint.x - anchor.x;
    const dy = dragPoint.y - anchor.y;

    currentPoint.handleOut = new Point(anchor.x + dx, anchor.y + dy);
    currentPoint.handleIn = new Point(anchor.x - dx, anchor.y - dy);

    this.updateHandleVisuals(currentPoint);
    this.updatePreviewPath(dragPoint);
  }

  private finalizeDrag(point: Point): void {
    if (this.bezierPoints.length === 0) return;

    const currentPoint = this.bezierPoints[this.bezierPoints.length - 1];
    const anchor = currentPoint.anchor;

    // Only set handles if there was actual dragging
    const dist = Math.hypot(point.x - anchor.x, point.y - anchor.y);
    if (dist < 5) {
      currentPoint.handleIn = null;
      currentPoint.handleOut = null;
      this.clearHandleVisuals();
    }
  }

  private updateHandleVisuals(bezierPoint: BezierPoint): void {
    if (!this.canvas) return;

    // Clear existing handle visuals
    this.clearHandleVisuals();

    const anchor = bezierPoint.anchor;

    if (bezierPoint.handleOut) {
      // Handle out line
      const lineOut = new Line(
        [anchor.x, anchor.y, bezierPoint.handleOut.x, bezierPoint.handleOut.y],
        {
          stroke: '#4a9eff',
          strokeWidth: 1,
          selectable: false,
          evented: false
        }
      );
      (lineOut as any).isHelper = true;
      this.handleLines.push(lineOut);
      this.canvas.add(lineOut);

      // Handle out marker
      const markerOut = new Circle({
        left: bezierPoint.handleOut.x,
        top: bezierPoint.handleOut.y,
        radius: 4,
        fill: '#4a9eff',
        stroke: '#ffffff',
        strokeWidth: 1,
        selectable: false,
        evented: false,
        originX: 'center',
        originY: 'center'
      });
      this.handleMarkers.push(markerOut);
      this.canvas.add(markerOut);
    }

    if (bezierPoint.handleIn) {
      // Handle in line
      const lineIn = new Line(
        [anchor.x, anchor.y, bezierPoint.handleIn.x, bezierPoint.handleIn.y],
        {
          stroke: '#4a9eff',
          strokeWidth: 1,
          selectable: false,
          evented: false
        }
      );
      (lineIn as any).isHelper = true;
      this.handleLines.push(lineIn);
      this.canvas.add(lineIn);

      // Handle in marker
      const markerIn = new Circle({
        left: bezierPoint.handleIn.x,
        top: bezierPoint.handleIn.y,
        radius: 4,
        fill: '#4a9eff',
        stroke: '#ffffff',
        strokeWidth: 1,
        selectable: false,
        evented: false,
        originX: 'center',
        originY: 'center'
      });
      this.handleMarkers.push(markerIn);
      this.canvas.add(markerIn);
    }

    this.canvas.requestRenderAll();
  }

  private clearHandleVisuals(): void {
    if (!this.canvas) return;

    this.handleLines.forEach((line) => this.canvas!.remove(line));
    this.handleLines = [];

    this.handleMarkers.forEach((marker) => this.canvas!.remove(marker));
    this.handleMarkers = [];
  }

  private addAnchorMarker(point: Point): void {
    if (!this.canvas) return;

    const marker = new Circle({
      left: point.x,
      top: point.y,
      radius: 5,
      fill: this.config?.strokeColor ?? '#ffffff',
      stroke: '#000000',
      strokeWidth: 1,
      selectable: false,
      evented: false,
      originX: 'center',
      originY: 'center'
    });

    this.anchorMarkers.push(marker);
    this.canvas.add(marker);
    this.canvas.requestRenderAll();
  }

  private updatePreviewPath(cursorPoint?: Point): void {
    if (!this.canvas || this.bezierPoints.length === 0) return;

    if (this.previewPath) {
      this.canvas.remove(this.previewPath);
    }

    const pathData = this.generatePathData(cursorPoint);
    if (!pathData) return;

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

  private generatePathData(cursorPoint?: Point): string {
    if (this.bezierPoints.length === 0) return '';

    let path = `M ${this.bezierPoints[0].anchor.x} ${this.bezierPoints[0].anchor.y}`;

    for (let i = 1; i < this.bezierPoints.length; i++) {
      const prev = this.bezierPoints[i - 1];
      const curr = this.bezierPoints[i];

      const cp1 = prev.handleOut ?? prev.anchor;
      const cp2 = curr.handleIn ?? curr.anchor;

      path += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${curr.anchor.x} ${curr.anchor.y}`;
    }

    // Add preview line to cursor if not dragging
    if (cursorPoint && !this.isDragging && this.bezierPoints.length > 0) {
      const last = this.bezierPoints[this.bezierPoints.length - 1];
      const cp1 = last.handleOut ?? last.anchor;
      path += ` C ${cp1.x} ${cp1.y}, ${cursorPoint.x} ${cursorPoint.y}, ${cursorPoint.x} ${cursorPoint.y}`;
    }

    return path;
  }

  private finishDrawing(): void {
    if (!this.canvas || this.bezierPoints.length < 2) {
      this.cancelDrawing();
      return;
    }

    this.snapLastAnchorIfNeeded();
    this.clearTemporaryObjects();

    const shape = this.buildPathShape();
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

    const pathData = this.generatePathData();

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

  private snapLastAnchorIfNeeded(): void {
    if (this.bezierPoints.length === 0) return;
    const last = this.bezierPoints[this.bezierPoints.length - 1];
    const snapResult = snapManager.findNearestEndpoint(last.anchor);
    if (!snapResult.snapped || !snapResult.snapPoint) {
      this.endSnap = null;
      return;
    }

    last.anchor = snapResult.point;
    const marker = this.anchorMarkers[this.anchorMarkers.length - 1];
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

  private undoLastPoint(): void {
    if (this.bezierPoints.length === 0) return;

    this.bezierPoints.pop();

    const marker = this.anchorMarkers.pop();
    if (marker && this.canvas) {
      this.canvas.remove(marker);
    }

    this.clearHandleVisuals();

    if (this.bezierPoints.length === 0) {
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

    this.anchorMarkers.forEach((marker) => this.canvas!.remove(marker));
    this.anchorMarkers = [];

    this.clearHandleVisuals();
    this.clearSnapIndicator();
  }

  private updateSnapIndicator(x: number, y: number): void {
    snapManager.showSnapIndicator(x, y);
  }

  private clearSnapIndicator(): void {
    snapManager.hideSnapIndicator();
  }

  private resetState(): void {
    this.bezierPoints = [];
    this.drawing = false;
    this.isDragging = false;
    this.currentDragPoint = null;
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

  private buildPathShape(): PathShape | null {
    if (this.bezierPoints.length === 0) return null;
    const start = this.bezierPoints[0].anchor;
    const segments: PathShape['segments'] = [];

    for (let i = 1; i < this.bezierPoints.length; i++) {
      const prev = this.bezierPoints[i - 1];
      const curr = this.bezierPoints[i];
      const cp1 = prev.handleOut ?? prev.anchor;
      const cp2 = curr.handleIn ?? curr.anchor;
      segments.push({ cp1, cp2, end: curr.anchor });
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
