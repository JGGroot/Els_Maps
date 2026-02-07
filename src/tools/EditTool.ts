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
  private priorObjectState: {
    hasBorders: boolean;
    hasControls: boolean;
    lockMovementX: boolean;
    lockMovementY: boolean;
    objectCaching: boolean;
  } | null = null;

  protected setupEventListeners(): void {
    if (!this.canvas) return;

    this.canvas.selection = true;
    this.canvas.targetFindTolerance = 8;
    this.canvas.forEachObject((obj) => {
      obj.selectable = true;
      obj.evented = true;
    });

    this.canvas.on('selection:created', this.handleSelectionChange);
    this.canvas.on('selection:updated', this.handleSelectionChange);
    this.canvas.on('selection:cleared', this.handleSelectionCleared);
  }

  protected cleanupEventListeners(): void {
    if (!this.canvas) return;

    this.canvas.off('selection:created', this.handleSelectionChange);
    this.canvas.off('selection:updated', this.handleSelectionChange);
    this.canvas.off('selection:cleared', this.handleSelectionCleared);

    this.clearEditPoints();
    this.selectedObject = null;
  }

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

  private handleSelectionCleared = (): void => {
    this.clearEditPoints();
    this.selectedObject = null;
  };

  onMouseDown(point: Point, event: MouseEvent): void {
    if (event.button !== 0) return;

    // Check if clicking on an edit point first
    const clickedPoint = this.findPointAtPosition(point);
    if (clickedPoint) {
      this.activePoint = clickedPoint;
      this.isDragging = true;
      event.stopPropagation();
      return;
    }

    // Stop propagation to prevent canvas selection
    event.stopPropagation();

    // Only select if we don't already have points loaded
    if (this.editPoints.length === 0) {
      let clickedObject: FabricObject | null = null;

      const target = (this.canvas as any).findTarget?.(event) as FabricObject | undefined;
      if (target && (target instanceof Path || target instanceof Polyline)) {
        clickedObject = target;
      } else {
        // Fallback: manual hit test
        const objects = this.canvas?.getObjects() ?? [];

        for (let i = objects.length - 1; i >= 0; i--) {
          const obj = objects[i];
          if (!obj.selectable || !(obj instanceof Path || obj instanceof Polyline)) continue;

          if (obj.containsPoint?.(new Point(point.x, point.y))) {
            clickedObject = obj;
            break;
          }
        }
      }
      
      if (clickedObject && (clickedObject instanceof Path || clickedObject instanceof Polyline)) {
        this.canvas?.setActiveObject(clickedObject);
        this.selectObject(clickedObject);
      }
    }
  }

  onMouseMove(point: Point, _event: MouseEvent): void {
    if (this.isDragging && this.activePoint && this.selectedObject) {
      this.movePoint(this.activePoint, point);
    }
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
  }

  onTouchStart(point: TouchPoint): void {
    const fabricPoint = new Point(point.x, point.y);
    const clickedPoint = this.findPointAtPosition(fabricPoint);

    if (clickedPoint) {
      this.activePoint = clickedPoint;
      this.isDragging = true;
    }
  }

  onTouchMove(point: TouchPoint): void {
    if (this.isDragging && this.activePoint && this.selectedObject) {
      const fabricPoint = new Point(point.x, point.y);
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
        radius: 7,
        fill: '#4a9eff',
        stroke: '#ffffff',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        hoverCursor: 'pointer',
        angle: 0,
        scaleX: 1,
        scaleY: 1
      });

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
      radius: 7,
      fill: '#4a9eff',
      stroke: '#ffffff',
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false
    });

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
      radius: 5,
      fill: '#ff9f4a',
      stroke: '#ffffff',
      strokeWidth: 1,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false
    });

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

  private findPointAtPosition(pos: Point): EditablePoint | null {
    const threshold = 20;

    for (const ep of this.editPoints) {
      const mx = ep.marker.left ?? 0;
      const my = ep.marker.top ?? 0;
      const dist = Math.hypot(pos.x - mx, pos.y - my);

      if (dist < threshold) {
        return ep;
      }
    }

    return null;
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

    points[index] = new Point(pos.x, pos.y);

    // Force polyline to update
    polyline.set({ points: [...points] });
    if (typeof (polyline as any)._setPositionDimensions === 'function') {
      (polyline as any)._setPositionDimensions({});
    }
    polyline.dirty = true;
    polyline.setCoords();
  }

  private updatePathPoint(path: Path, editPoint: EditablePoint, pos: { x: number; y: number }): void {
    if (!path.path || editPoint.segmentIndex === undefined) return;

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
    if (typeof (path as any)._setPositionDimensions === 'function') {
      (path as any)._setPositionDimensions({});
    }
    path.dirty = true;
    path.setCoords();
  }

  private clearEditPoints(): void {
    if (!this.canvas) return;

    for (const ep of this.editPoints) {
      this.canvas.remove(ep.marker);
    }
    this.editPoints = [];

    // Restore object controls if there was a selected object
    if (this.selectedObject) {
      if (this.editedSinceSelect) {
        // Force full recalculation of bounding box for Polyline/Path
        if (this.selectedObject instanceof Polyline && this.selectedObject.points) {
          // Re-set points to trigger full recalculation
          this.selectedObject.set({ points: [...this.selectedObject.points] });
        } else if (this.selectedObject instanceof Path && this.selectedObject.path) {
          // Re-set path to trigger full recalculation
          this.selectedObject.set({ path: [...this.selectedObject.path] });
        }
        if (typeof (this.selectedObject as any)._setPositionDimensions === 'function') {
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
