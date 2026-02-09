import { Circle, Path, Polyline, Point } from 'fabric';
import type { FabricObject } from 'fabric';
import { ToolType } from '@/types';
import type { TouchPoint } from '@/types';
import { historyManager } from '@/utils';
import { BaseTool } from './BaseTool';

interface EditablePoint {
  marker: Circle;
  index: number;
  type: 'anchor' | 'control';
  segmentIndex?: number;
}

interface InteractionState {
  selectable: boolean;
  evented: boolean;
  hasControls: boolean;
  hasBorders: boolean;
  lockMovementX: boolean;
  lockMovementY: boolean;
  lockScalingX: boolean;
  lockScalingY: boolean;
  lockRotation: boolean;
}

const EDIT_MARKER_STYLE = {
  anchor: {
    radius: 7,
    strokeWidth: 2,
    fill: '#4a9eff',
    stroke: '#ffffff'
  },
  control: {
    radius: 5,
    strokeWidth: 1,
    fill: '#ff9f4a',
    stroke: '#ffffff'
  },
  hitPadding: 6
};

export class EditTool extends BaseTool {
  type = ToolType.EDIT;
  name = 'Edit';
  icon = 'edit-nodes';

  private selectedObject: FabricObject | null = null;
  private editPoints: EditablePoint[] = [];
  private activePoint: EditablePoint | null = null;
  private isDragging: boolean = false;
  private hasChanges: boolean = false;
  private editedSinceSelect: boolean = false;
  private lastZoom: number = 1;
  private cursorIsPointer: boolean = false;
  private upperCanvasEl: HTMLCanvasElement | null = null;
  private suppressSelectionClear: boolean = false;
  private lastPointer: Point | null = null;
  private interactionStates: Map<FabricObject, InteractionState> = new Map();
  private priorObjectState: {
    hasBorders: boolean;
    hasControls: boolean;
    lockMovementX: boolean;
    lockMovementY: boolean;
    objectCaching: boolean;
  } | null = null;

  protected setupEventListeners(): void {
    if (!this.canvas) return;

    this.canvas.selection = false;
    this.canvas.targetFindTolerance = 8;
    this.canvas.skipTargetFind = false;
    this.captureInteractionStates();
    this.applyEditInteractionState();

    this.canvas.on('selection:created', this.handleSelectionChange);
    this.canvas.on('selection:updated', this.handleSelectionChange);
    this.canvas.on('selection:cleared', this.handleSelectionCleared);
    this.canvas.on('object:added', this.handleObjectAdded);
    this.canvas.on('object:removed', this.handleObjectRemoved);
    this.canvas.on('after:render', this.handleAfterRender);

    this.upperCanvasEl = (this.canvas as any).upperCanvasEl ?? null;
    if (this.upperCanvasEl) {
      this.upperCanvasEl.addEventListener('mousedown', this.handlePointerCapture, { capture: true });
    }

    this.lastZoom = this.canvas.getZoom();

    const activeObj = this.canvas.getActiveObject();
    if (activeObj && (activeObj instanceof Path || activeObj instanceof Polyline)) {
      this.selectObject(activeObj);
    } else {
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
    }
  }

  protected cleanupEventListeners(): void {
    if (!this.canvas) return;

    this.canvas.off('selection:created', this.handleSelectionChange);
    this.canvas.off('selection:updated', this.handleSelectionChange);
    this.canvas.off('selection:cleared', this.handleSelectionCleared);
    this.canvas.off('object:added', this.handleObjectAdded);
    this.canvas.off('object:removed', this.handleObjectRemoved);
    this.canvas.off('after:render', this.handleAfterRender);

    this.clearEditPoints();
    this.setCursorPointer(false);
    this.restoreInteractionStates();
    this.selectedObject = null;

    if (this.upperCanvasEl) {
      this.upperCanvasEl.removeEventListener('mousedown', this.handlePointerCapture, { capture: true });
      this.upperCanvasEl = null;
    }
  }

  private handlePointerCapture = (event: MouseEvent): void => {
    if (!this.canvas || event.button !== 0) return;

    const pointer = this.canvas.getPointer(event);
    const point = new Point(pointer.x, pointer.y);
    this.lastPointer = point;
    const preferType = event.altKey ? 'control' : 'anchor';
    const clickedPoint = this.findPointAtPosition(point, preferType);
    if (!clickedPoint) return;

    this.activePoint = clickedPoint;
    this.isDragging = true;
    this.suppressSelectionClear = true;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };

  private handleSelectionChange = (): void => {
    if (!this.canvas) return;

    const activeObj = this.canvas.getActiveObject();
    if (activeObj && (activeObj instanceof Path || activeObj instanceof Polyline)) {
      this.selectObject(activeObj);
    } else {
      this.clearEditPoints();
      this.selectedObject = null;
    }
  };

  private handleSelectionCleared = (event?: { e?: Event }): void => {
    const shouldRestore =
      this.suppressSelectionClear || this.isPointerOverEditPoint(event?.e);

    if (shouldRestore && this.selectedObject && this.canvas) {
      this.suppressSelectionClear = false;
      this.canvas.setActiveObject(this.selectedObject);
      this.canvas.requestRenderAll();
      return;
    }
    this.clearEditPoints();
    this.selectedObject = null;
  };

  private handleObjectAdded = (event: { target?: FabricObject }): void => {
    const added = event?.target;
    if (!added || (added as any)._editMarker) return;

    if (!this.interactionStates.has(added)) {
      this.interactionStates.set(added, this.captureInteractionState(added));
    }

    this.applyEditInteractionState(added);
  };

  private handleObjectRemoved = (event: { target?: FabricObject }): void => {
    const removed = event?.target;
    if (!removed) return;

    if (this.interactionStates.has(removed)) {
      this.interactionStates.delete(removed);
    }

    if ((removed as any)._editMarker) {
      this.editPoints = this.editPoints.filter((ep) => ep.marker !== removed);
      return;
    }

    if (removed === this.selectedObject) {
      this.activePoint = null;
      this.isDragging = false;
      this.clearEditPoints(false);
      this.selectedObject = null;
    }
  };

  private handleAfterRender = (): void => {
    if (!this.canvas || this.editPoints.length === 0) return;
    const zoom = this.canvas.getZoom();
    if (Math.abs(zoom - this.lastZoom) < 0.0001) return;
    this.lastZoom = zoom;
    this.updateMarkerSizes();
  };

  onMouseDown(point: Point, event: MouseEvent): void {
    if (event.button !== 0) return;
    this.suppressSelectionClear = false;
    this.lastPointer = point;

    // Check if clicking on an edit point first
    const preferType = event.altKey ? 'control' : 'anchor';
    const clickedPoint = this.findPointAtPosition(point, preferType);
    if (clickedPoint) {
      this.activePoint = clickedPoint;
      this.isDragging = true;
      this.suppressSelectionClear = true;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      return;
    }

    // Let Fabric handle selection when not clicking a node
  }

  onMouseMove(point: Point, _event: MouseEvent): void {
    this.lastPointer = point;
    if (this.isDragging && this.activePoint && this.selectedObject) {
      this.movePoint(this.activePoint, point);
      return;
    }

    const hovered = this.findPointAtPosition(point) !== null;
    this.setCursorPointer(hovered);
  }

  onMouseUp(_point: Point, _event: MouseEvent): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.activePoint = null;
      this.canvas?.requestRenderAll();
      if (this.hasChanges) {
        historyManager.saveState();
        this.hasChanges = false;
      }
    }
    this.suppressSelectionClear = false;
    this.setCursorPointer(false);
  }

  onTouchStart(point: TouchPoint): void {
    const fabricPoint = new Point(point.x, point.y);
    this.lastPointer = fabricPoint;
    const clickedPoint = this.findPointAtPosition(fabricPoint, 'anchor');

    if (clickedPoint) {
      this.activePoint = clickedPoint;
      this.isDragging = true;
    }
  }

  onTouchMove(point: TouchPoint): void {
    if (this.isDragging && this.activePoint && this.selectedObject) {
      const fabricPoint = new Point(point.x, point.y);
      this.lastPointer = fabricPoint;
      this.movePoint(this.activePoint, fabricPoint);
    }
  }

  onTouchEnd(_point: TouchPoint): void {
    this.isDragging = false;
    this.activePoint = null;
    if (this.hasChanges) {
      historyManager.saveState();
      this.hasChanges = false;
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.clearEditPoints();
      this.canvas?.discardActiveObject();
      this.canvas?.requestRenderAll();
    }
  }

  private selectObject(obj: Path | Polyline): void {
    if (this.selectedObject === obj) return;

    this.clearEditPoints();
    this.selectedObject = obj;

    this.priorObjectState = {
      hasBorders: obj.hasBorders ?? true,
      hasControls: obj.hasControls ?? true,
      lockMovementX: obj.lockMovementX ?? false,
      lockMovementY: obj.lockMovementY ?? false,
      objectCaching: obj.objectCaching ?? true
    };

    // Disable object's own controls while editing points
    obj.set({
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      objectCaching: false
    });

    if (obj instanceof Polyline) {
      this.createPolylineEditPoints(obj);
    } else if (obj instanceof Path) {
      this.createPathEditPoints(obj);
    }

    this.updateMarkerSizes(false);
    this.bringEditPointsToFront();
    this.canvas?.requestRenderAll();
  }

  private createPolylineEditPoints(polyline: Polyline): void {
    if (!this.canvas) return;

    const points = polyline.points ?? [];
    const matrix = polyline.calcTransformMatrix();
    const pathOffset = (polyline as any).pathOffset ?? { x: 0, y: 0 };

    points.forEach((pt, index) => {
      // Transform point from polyline local space to canvas space
      const canvasPoint = this.transformPoint(
        pt.x - pathOffset.x,
        pt.y - pathOffset.y,
        matrix
      );

      const marker = new Circle({
        left: canvasPoint.x,
        top: canvasPoint.y,
        ...this.getMarkerDefaults('anchor'),
        angle: 0
      });

      (marker as any)._editMarker = true;
      (marker as any).excludeFromExport = true;
      (marker as any).isHelper = true;

      this.canvas!.add(marker);

      this.editPoints.push({
        marker,
        index,
        type: 'anchor'
      });
    });
  }

  private createPathEditPoints(path: Path): void {
    if (!this.canvas || !path.path) return;

    const pathData = path.path;
    const matrix = path.calcTransformMatrix();
    const pathOffset = (path as any).pathOffset ?? { x: 0, y: 0 };
    let pointIndex = 0;

    for (let i = 0; i < pathData.length; i++) {
      const segment = pathData[i];
      const command = segment[0];

      if (command === 'M' || command === 'L') {
        // Move or Line - has one anchor point
        const x = segment[1] as number;
        const y = segment[2] as number;
        const transformedPoint = this.transformPoint(
          x - pathOffset.x,
          y - pathOffset.y,
          matrix
        );

        this.createAnchorMarker(transformedPoint, pointIndex, i);
        pointIndex++;
      } else if (command === 'C') {
        // Cubic bezier - has 2 control points and 1 anchor
        // Control point 1
        const cp1x = segment[1] as number;
        const cp1y = segment[2] as number;
        const cp1Transformed = this.transformPoint(
          cp1x - pathOffset.x,
          cp1y - pathOffset.y,
          matrix
        );
        this.createControlMarker(cp1Transformed, pointIndex, i, 0);
        pointIndex++;

        // Control point 2
        const cp2x = segment[3] as number;
        const cp2y = segment[4] as number;
        const cp2Transformed = this.transformPoint(
          cp2x - pathOffset.x,
          cp2y - pathOffset.y,
          matrix
        );
        this.createControlMarker(cp2Transformed, pointIndex, i, 1);
        pointIndex++;

        // End anchor
        const ax = segment[5] as number;
        const ay = segment[6] as number;
        const aTransformed = this.transformPoint(
          ax - pathOffset.x,
          ay - pathOffset.y,
          matrix
        );
        this.createAnchorMarker(aTransformed, pointIndex, i);
        pointIndex++;
      } else if (command === 'Q') {
        // Quadratic bezier - has 1 control point and 1 anchor
        const cpx = segment[1] as number;
        const cpy = segment[2] as number;
        const cpTransformed = this.transformPoint(
          cpx - pathOffset.x,
          cpy - pathOffset.y,
          matrix
        );
        this.createControlMarker(cpTransformed, pointIndex, i, 0);
        pointIndex++;

        const ax = segment[3] as number;
        const ay = segment[4] as number;
        const aTransformed = this.transformPoint(
          ax - pathOffset.x,
          ay - pathOffset.y,
          matrix
        );
        this.createAnchorMarker(aTransformed, pointIndex, i);
        pointIndex++;
      }
    }
  }

  private createAnchorMarker(point: { x: number; y: number }, index: number, segmentIndex: number): void {
    if (!this.canvas) return;

    const marker = new Circle({
      left: point.x,
      top: point.y,
      ...this.getMarkerDefaults('anchor')
    });

    (marker as any)._editMarker = true;
    (marker as any).excludeFromExport = true;
    (marker as any).isHelper = true;

    this.editPoints.push({
      marker,
      index,
      type: 'anchor',
      segmentIndex
    });

    this.canvas.add(marker);
  }

  private createControlMarker(point: { x: number; y: number }, index: number, segmentIndex: number, cpIndex: number): void {
    if (!this.canvas) return;

    const marker = new Circle({
      left: point.x,
      top: point.y,
      ...this.getMarkerDefaults('control')
    });

    (marker as any)._editMarker = true;
    (marker as any).excludeFromExport = true;
    (marker as any).isHelper = true;

    this.editPoints.push({
      marker,
      index,
      type: 'control',
      segmentIndex
    });

    // Store control point index for later use
    (marker as any)._cpIndex = cpIndex;

    this.canvas.add(marker);
  }

  private getMarkerDefaults(type: 'anchor' | 'control'): {
    radius: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
    originX: 'center';
    originY: 'center';
    selectable: false;
    evented: false;
    objectCaching: false;
  } {
    const zoomScale = this.getMarkerScale();
    const style = type === 'anchor' ? EDIT_MARKER_STYLE.anchor : EDIT_MARKER_STYLE.control;

    return {
      radius: style.radius * zoomScale,
      fill: style.fill,
      stroke: style.stroke,
      strokeWidth: style.strokeWidth * zoomScale,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      objectCaching: false
    };
  }

  private setCursorPointer(enabled: boolean): void {
    if (!this.canvas || this.cursorIsPointer === enabled) return;
    const upperCanvas = (this.canvas as any).upperCanvasEl as HTMLCanvasElement | undefined;
    if (!upperCanvas) return;
    upperCanvas.style.cursor = enabled ? 'pointer' : '';
    this.cursorIsPointer = enabled;
  }

  private isPointerOverEditPoint(event?: Event): boolean {
    const point = this.getPointFromEvent(event) ?? this.lastPointer;
    if (!point) return false;
    return this.findPointAtPosition(point) !== null;
  }

  private getPointFromEvent(event?: Event): Point | null {
    if (!this.canvas || !event) return null;

    if (event instanceof MouseEvent) {
      const pointer = this.canvas.getPointer(event);
      return new Point(pointer.x, pointer.y);
    }

    const anyEvent = event as TouchEvent;
    const touch = anyEvent.touches?.[0] ?? anyEvent.changedTouches?.[0];
    if (touch) {
      const fakeMouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY
      } as MouseEvent;
      const pointer = this.canvas.getPointer(fakeMouseEvent);
      return new Point(pointer.x, pointer.y);
    }

    return null;
  }

  private transformPoint(x: number, y: number, matrix: number[]): { x: number; y: number } {
    return {
      x: matrix[0] * x + matrix[2] * y + matrix[4],
      y: matrix[1] * x + matrix[3] * y + matrix[5]
    };
  }

  private inverseTransformPoint(x: number, y: number, matrix: number[]): { x: number; y: number } {
    // Calculate inverse of 2D transform matrix
    const det = matrix[0] * matrix[3] - matrix[1] * matrix[2];
    if (det === 0) return { x, y };

    const invDet = 1 / det;
    return {
      x: (matrix[3] * (x - matrix[4]) - matrix[2] * (y - matrix[5])) * invDet,
      y: (-matrix[1] * (x - matrix[4]) + matrix[0] * (y - matrix[5])) * invDet
    };
  }

  private findPointAtPosition(
    pos: Point,
    preferType: 'anchor' | 'control' = 'anchor'
  ): EditablePoint | null {
    if (!this.canvas) return null;
    const zoom = this.canvas.getZoom();
    const hitPadding = EDIT_MARKER_STYLE.hitPadding / zoom;
    const candidates: Array<{ point: EditablePoint; dist: number }> = [];

    for (const ep of this.editPoints) {
      const mx = ep.marker.left ?? 0;
      const my = ep.marker.top ?? 0;
      const radius = (ep.marker.radius ?? 0) * (ep.marker.scaleX ?? 1);
      const threshold = radius + hitPadding;
      const dist = Math.hypot(pos.x - mx, pos.y - my);

      if (dist <= threshold) {
        candidates.push({ point: ep, dist });
      }
    }

    if (candidates.length === 0) return null;

    const preferred = candidates.filter((candidate) => candidate.point.type === preferType);
    const list = preferred.length > 0 ? preferred : candidates;

    return list.reduce((closest, candidate) => (
      candidate.dist < closest.dist ? candidate : closest
    )).point;
  }

  private getMarkerScale(): number {
    const zoom = this.canvas?.getZoom() ?? 1;
    return 1 / zoom;
  }

  private updateMarkerSizes(requestRender: boolean = true): void {
    if (!this.canvas || this.editPoints.length === 0) return;
    const zoomScale = this.getMarkerScale();

    for (const ep of this.editPoints) {
      const style = ep.type === 'anchor' ? EDIT_MARKER_STYLE.anchor : EDIT_MARKER_STYLE.control;
      ep.marker.set({
        radius: style.radius * zoomScale,
        strokeWidth: style.strokeWidth * zoomScale
      });
    }

    if (requestRender) {
      this.canvas.requestRenderAll();
    }
  }

  private bringEditPointsToFront(): void {
    if (!this.canvas) return;
    for (const ep of this.editPoints) {
      this.canvas.bringObjectToFront(ep.marker);
    }
  }

  private captureInteractionStates(): void {
    if (!this.canvas) return;
    this.interactionStates.clear();
    this.canvas.getObjects().forEach((obj) => {
      if ((obj as any)._editMarker) return;
      this.interactionStates.set(obj, this.captureInteractionState(obj));
    });
  }

  private captureInteractionState(obj: FabricObject): InteractionState {
    return {
      selectable: obj.selectable ?? true,
      evented: obj.evented ?? true,
      hasControls: obj.hasControls ?? true,
      hasBorders: obj.hasBorders ?? true,
      lockMovementX: obj.lockMovementX ?? false,
      lockMovementY: obj.lockMovementY ?? false,
      lockScalingX: obj.lockScalingX ?? false,
      lockScalingY: obj.lockScalingY ?? false,
      lockRotation: obj.lockRotation ?? false
    };
  }

  private applyEditInteractionState(target?: FabricObject): void {
    if (!this.canvas) return;
    const objects = target ? [target] : this.canvas.getObjects();

    objects.forEach((obj) => {
      if ((obj as any)._editMarker) return;
      if (obj instanceof Path || obj instanceof Polyline) {
        obj.set({
          selectable: true,
          evented: true,
          hasControls: false,
          hasBorders: false,
          lockMovementX: true,
          lockMovementY: true,
          lockScalingX: true,
          lockScalingY: true,
          lockRotation: true
        });
      } else {
        obj.set({
          selectable: false,
          evented: false,
          hasControls: false,
          hasBorders: false
        });
      }
    });
  }

  private restoreInteractionStates(): void {
    if (!this.canvas) return;
    for (const [obj, state] of this.interactionStates) {
      if (!this.canvas.getObjects().includes(obj)) continue;
      obj.set({
        selectable: state.selectable,
        evented: state.evented,
        hasControls: state.hasControls,
        hasBorders: state.hasBorders,
        lockMovementX: state.lockMovementX,
        lockMovementY: state.lockMovementY,
        lockScalingX: state.lockScalingX,
        lockScalingY: state.lockScalingY,
        lockRotation: state.lockRotation
      });
    }
    this.interactionStates.clear();
    this.canvas.requestRenderAll();
  }

  private movePoint(editPoint: EditablePoint, newPos: Point): void {
    if (!this.selectedObject || !this.canvas) return;

    // Update marker position
    editPoint.marker.set({
      left: newPos.x,
      top: newPos.y
    });

    const matrix = this.selectedObject.calcTransformMatrix();
    const pathOffset = (this.selectedObject as any).pathOffset ?? { x: 0, y: 0 };
    const localBase = this.inverseTransformPoint(newPos.x, newPos.y, matrix);
    const localPos = {
      x: localBase.x + pathOffset.x,
      y: localBase.y + pathOffset.y
    };

    if (this.selectedObject instanceof Polyline) {
      this.updatePolylinePoint(this.selectedObject, editPoint.index, localPos);
    } else if (this.selectedObject instanceof Path) {
      this.updatePathPoint(this.selectedObject, editPoint, localPos);
    }

    this.hasChanges = true;
    this.editedSinceSelect = true;
    this.canvas.requestRenderAll();
  }

  private updatePolylinePoint(polyline: Polyline, index: number, pos: { x: number; y: number }): void {
    const points = polyline.points;
    if (!points || index >= points.length) return;

    const anchorIndex = this.getPolylineAnchorIndex(polyline, index);
    const anchorBefore = anchorIndex !== null
      ? this.getPointInParentPlane(polyline, points[anchorIndex])
      : null;

    points[index] = new Point(pos.x, pos.y);

    // Force polyline to update
    polyline.set({ points: [...points] });
    this.updateObjectDimensions(polyline);

    if (anchorBefore) {
      const anchorAfter = this.getPointInParentPlane(polyline, points[anchorIndex!]);
      const diff = anchorAfter.subtract(anchorBefore);
      polyline.left -= diff.x;
      polyline.top -= diff.y;
    }
    polyline.dirty = true;
    polyline.setCoords();
    this.syncEditPointsWithObject();
  }

  private updatePathPoint(path: Path, editPoint: EditablePoint, pos: { x: number; y: number }): void {
    if (!path.path || editPoint.segmentIndex === undefined) return;

    const anchor = this.getPathAnchor(path, editPoint);
    const anchorBefore = anchor ? this.getPathAnchorInParentPlane(path, anchor) : null;

    const segment = path.path[editPoint.segmentIndex];
    const command = segment[0];

    if (editPoint.type === 'anchor') {
      if (command === 'M' || command === 'L') {
        segment[1] = pos.x;
        segment[2] = pos.y;
      } else if (command === 'C') {
        segment[5] = pos.x;
        segment[6] = pos.y;
      } else if (command === 'Q') {
        segment[3] = pos.x;
        segment[4] = pos.y;
      }
    } else if (editPoint.type === 'control') {
      const cpIndex = (editPoint.marker as any)._cpIndex ?? 0;

      if (command === 'C') {
        if (cpIndex === 0) {
          segment[1] = pos.x;
          segment[2] = pos.y;
        } else {
          segment[3] = pos.x;
          segment[4] = pos.y;
        }
      } else if (command === 'Q') {
        segment[1] = pos.x;
        segment[2] = pos.y;
      }
    }

    // Force path to recalculate
    path.set({ path: [...path.path] });
    this.updateObjectDimensions(path);

    if (anchorBefore && anchor) {
      const anchorAfter = this.getPathAnchorInParentPlane(path, anchor);
      const diff = anchorAfter.subtract(anchorBefore);
      path.left -= diff.x;
      path.top -= diff.y;
    }
    path.dirty = true;
    path.setCoords();
    this.syncEditPointsWithObject();
  }

  private updateObjectDimensions(obj: FabricObject): void {
    if (typeof (obj as any).setDimensions === 'function') {
      (obj as any).setDimensions();
    } else if (typeof (obj as any)._setPositionDimensions === 'function') {
      (obj as any)._setPositionDimensions({});
    }
  }

  private getPolylineAnchorIndex(polyline: Polyline, editedIndex: number): number | null {
    const points = polyline.points ?? [];
    if (points.length <= 1) return null;
    if (editedIndex !== 0) return 0;
    return points.length > 1 ? 1 : null;
  }

  private getPathAnchor(
    path: Path,
    editPoint: EditablePoint
  ): { segmentIndex: number; xIndex: number; yIndex: number } | null {
    if (!path.path) return null;
    const skipSegment = editPoint.type === 'anchor' ? editPoint.segmentIndex : undefined;

    for (let i = 0; i < path.path.length; i++) {
      if (skipSegment !== undefined && i === skipSegment) continue;
      const segment = path.path[i];
      const command = segment[0];

      if (command === 'M' || command === 'L') {
        return { segmentIndex: i, xIndex: 1, yIndex: 2 };
      }
      if (command === 'C') {
        return { segmentIndex: i, xIndex: 5, yIndex: 6 };
      }
      if (command === 'Q') {
        return { segmentIndex: i, xIndex: 3, yIndex: 4 };
      }
    }

    return null;
  }

  private getPathAnchorInParentPlane(
    path: Path,
    anchor: { segmentIndex: number; xIndex: number; yIndex: number }
  ): Point {
    const segment = path.path?.[anchor.segmentIndex];
    const x = (segment?.[anchor.xIndex] as number) ?? 0;
    const y = (segment?.[anchor.yIndex] as number) ?? 0;
    return this.getPointInParentPlane(path, new Point(x, y));
  }

  private getPointInParentPlane(
    obj: { pathOffset?: { x: number; y: number } | Point; calcOwnMatrix: () => number[] },
    point: Point | { x: number; y: number }
  ): Point {
    const offsetValue = obj.pathOffset ?? { x: 0, y: 0 };
    const offset = offsetValue instanceof Point ? offsetValue : new Point(offsetValue.x, offsetValue.y);
    const basePoint = point instanceof Point ? point : new Point(point.x, point.y);
    return basePoint.subtract(offset).transform(obj.calcOwnMatrix());
  }

  private syncEditPointsWithObject(): void {
    if (!this.canvas || !this.selectedObject || this.editPoints.length === 0) return;

    if (this.selectedObject instanceof Polyline) {
      const polyline = this.selectedObject;
      const points = polyline.points ?? [];
      const matrix = polyline.calcTransformMatrix();
      const pathOffset = (polyline as any).pathOffset ?? { x: 0, y: 0 };

      for (const ep of this.editPoints) {
        const pt = points[ep.index];
        if (!pt) continue;
        const canvasPoint = this.transformPoint(
          pt.x - pathOffset.x,
          pt.y - pathOffset.y,
          matrix
        );
        ep.marker.set({ left: canvasPoint.x, top: canvasPoint.y });
      }
      return;
    }

    if (this.selectedObject instanceof Path) {
      const path = this.selectedObject;
      if (!path.path) return;
      const matrix = path.calcTransformMatrix();
      const pathOffset = (path as any).pathOffset ?? { x: 0, y: 0 };

      for (const ep of this.editPoints) {
        if (ep.segmentIndex === undefined) continue;
        const segment = path.path[ep.segmentIndex];
        if (!segment) continue;
        const command = segment[0];

        let x: number | null = null;
        let y: number | null = null;

        if (ep.type === 'anchor') {
          if (command === 'M' || command === 'L') {
            x = segment[1] as number;
            y = segment[2] as number;
          } else if (command === 'C') {
            x = segment[5] as number;
            y = segment[6] as number;
          } else if (command === 'Q') {
            x = segment[3] as number;
            y = segment[4] as number;
          }
        } else if (ep.type === 'control') {
          const cpIndex = (ep.marker as any)._cpIndex ?? 0;
          if (command === 'C') {
            if (cpIndex === 0) {
              x = segment[1] as number;
              y = segment[2] as number;
            } else {
              x = segment[3] as number;
              y = segment[4] as number;
            }
          } else if (command === 'Q') {
            x = segment[1] as number;
            y = segment[2] as number;
          }
        }

        if (x === null || y === null) continue;

        const canvasPoint = this.transformPoint(
          x - pathOffset.x,
          y - pathOffset.y,
          matrix
        );
        ep.marker.set({ left: canvasPoint.x, top: canvasPoint.y });
      }
    }
  }

  private clearEditPoints(restoreObject: boolean = true): void {
    if (!this.canvas) return;

    for (const ep of this.editPoints) {
      this.canvas.remove(ep.marker);
    }
    this.editPoints = [];

    // Restore object controls if there was a selected object
    if (restoreObject && this.selectedObject && this.canvas.getObjects().includes(this.selectedObject)) {
      if (this.editedSinceSelect) {
        // Force full recalculation of bounding box for Polyline/Path
        if (this.selectedObject instanceof Polyline && this.selectedObject.points) {
          // Re-set points to trigger full recalculation
          this.selectedObject.set({ points: [...this.selectedObject.points] });
        } else if (this.selectedObject instanceof Path && this.selectedObject.path) {
          // Re-set path to trigger full recalculation
          this.selectedObject.set({ path: [...this.selectedObject.path] });
        }
        if (typeof (this.selectedObject as any).setDimensions === 'function') {
          (this.selectedObject as any).setDimensions();
        } else if (typeof (this.selectedObject as any)._setPositionDimensions === 'function') {
          (this.selectedObject as any)._setPositionDimensions({});
        }
        this.selectedObject.setCoords();
        this.selectedObject.dirty = true;
      }
      this.selectedObject.set({
        hasControls: this.priorObjectState?.hasControls ?? true,
        hasBorders: this.priorObjectState?.hasBorders ?? true,
        lockMovementX: this.priorObjectState?.lockMovementX ?? false,
        lockMovementY: this.priorObjectState?.lockMovementY ?? false,
        objectCaching: this.editedSinceSelect ? false : (this.priorObjectState?.objectCaching ?? true)
      });
      this.canvas.requestRenderAll();
    }
    this.priorObjectState = null;
    this.editedSinceSelect = false;
  }

 

  cancel(): void {
    this.clearEditPoints();
    this.selectedObject = null;
    super.cancel();
  }

  getPreview(): FabricObject | null {
    return null;
  }
}
