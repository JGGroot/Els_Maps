import { Circle, Line, Path, Polyline, Point } from 'fabric';
import type { FabricObject, TMat2D, Canvas } from 'fabric';
import { ToolType } from '@/types';
import type { TouchPoint } from '@/types';
import { historyManager, snapManager } from '@/utils';
import { BaseTool } from './BaseTool';

// ============================================================================
// Types & Enums
// ============================================================================

const enum PointType {
  ANCHOR = 'anchor',
  CONTROL = 'control'
}

interface EditPoint {
  marker: Circle;
  index: number;
  type: PointType;
  segmentIndex?: number;
  controlPointIndex?: number;
  handleLine?: Line;
  connectedAnchorIndex?: number;
}

interface ObjectInteractionState {
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

interface MarkerStyle {
  radius: number;
  strokeWidth: number;
  fill: string;
  stroke: string;
  hoverFill: string;
  activeFill: string;
}

type EditableObject = Path | Polyline;

// ============================================================================
// Constants
// ============================================================================

const MARKER_STYLES: Record<PointType, MarkerStyle> = {
  [PointType.ANCHOR]: {
    radius: 6,
    strokeWidth: 2,
    fill: '#ffffff',
    stroke: '#2196f3',
    hoverFill: '#e3f2fd',
    activeFill: '#2196f3'
  },
  [PointType.CONTROL]: {
    radius: 5,
    strokeWidth: 1.5,
    fill: '#ffffff',
    stroke: '#ff9800',
    hoverFill: '#fff3e0',
    activeFill: '#ff9800'
  }
};

const HANDLE_LINE_STYLE = {
  stroke: '#9e9e9e',
  strokeWidth: 1,
  strokeDashArray: [4, 4],
  selectable: false,
  evented: false,
  excludeFromExport: true
};

const HIT_TOLERANCE = 8;
const NUDGE_AMOUNT = 1;
const NUDGE_AMOUNT_SHIFT = 10;

// ============================================================================
// Utility Functions
// ============================================================================

function transformPoint(x: number, y: number, matrix: number[]): Point {
  return new Point(
    matrix[0] * x + matrix[2] * y + matrix[4],
    matrix[1] * x + matrix[3] * y + matrix[5]
  );
}

function inverseTransformPoint(x: number, y: number, matrix: number[]): Point {
  const det = matrix[0] * matrix[3] - matrix[1] * matrix[2];
  if (Math.abs(det) < 1e-10) return new Point(x, y);

  const invDet = 1 / det;
  return new Point(
    (matrix[3] * (x - matrix[4]) - matrix[2] * (y - matrix[5])) * invDet,
    (-matrix[1] * (x - matrix[4]) + matrix[0] * (y - matrix[5])) * invDet
  );
}

function getPathOffset(obj: FabricObject): Point {
  const offset = (obj as any).pathOffset;
  if (!offset) return new Point(0, 0);
  return offset instanceof Point ? offset : new Point(offset.x ?? 0, offset.y ?? 0);
}

function isEditableObject(obj: FabricObject | null | undefined): obj is EditableObject {
  return obj instanceof Path || obj instanceof Polyline;
}

// ============================================================================
// EditMarkerManager - Handles creation and styling of edit point markers
// ============================================================================

class EditMarkerManager {
  private canvas: Canvas;
  private editPoints: EditPoint[] = [];
  private handleLines: Line[] = [];
  private lastZoom: number = 1;
  private sharedAnchorTolerance: number = 0.5;

  constructor(canvas: Canvas) {
    this.canvas = canvas;
    this.lastZoom = canvas.getZoom();
  }

  createMarkersForObject(obj: EditableObject): EditPoint[] {
    this.clear();

    if (obj instanceof Polyline) {
      this.createPolylineMarkers(obj);
    } else if (obj instanceof Path) {
      this.createPathMarkers(obj);
    }

    this.updateAllMarkerSizes();
    this.bringMarkersToFront();
    return this.editPoints;
  }

  private createPolylineMarkers(polyline: Polyline): void {
    const points = polyline.points ?? [];
    const matrix = polyline.calcTransformMatrix();
    const pathOffset = getPathOffset(polyline);

    points.forEach((pt, index) => {
      const canvasPoint = transformPoint(
        pt.x - pathOffset.x,
        pt.y - pathOffset.y,
        matrix
      );
      this.createMarker(canvasPoint, index, PointType.ANCHOR);
    });
  }

  private createPathMarkers(path: Path): void {
    if (!path.path) return;

    const matrix = path.calcTransformMatrix();
    const pathOffset = getPathOffset(path);
    let pointIndex = 0;

    // First pass: create anchors and track their positions
    const anchorPositions: Map<number, { canvasPoint: Point; segmentIndex: number }> = new Map();

    for (let segIdx = 0; segIdx < path.path.length; segIdx++) {
      const segment = path.path[segIdx];
      const command = segment[0];

      let anchorX: number | null = null;
      let anchorY: number | null = null;

      if (command === 'M' || command === 'L') {
        anchorX = segment[1] as number;
        anchorY = segment[2] as number;
      } else if (command === 'C') {
        anchorX = segment[5] as number;
        anchorY = segment[6] as number;
      } else if (command === 'Q') {
        anchorX = segment[3] as number;
        anchorY = segment[4] as number;
      }

      if (anchorX !== null && anchorY !== null) {
        const canvasPoint = transformPoint(
          anchorX - pathOffset.x,
          anchorY - pathOffset.y,
          matrix
        );
        anchorPositions.set(pointIndex, { canvasPoint, segmentIndex: segIdx });
        pointIndex++;
      }
    }

    // Second pass: create all markers with proper connections
    pointIndex = 0;
    let anchorIndex = 0;
    let prevAnchorCanvasPoint: Point | null = null;

    for (let segIdx = 0; segIdx < path.path.length; segIdx++) {
      const segment = path.path[segIdx];
      const command = segment[0];

      if (command === 'M' || command === 'L') {
        const x = segment[1] as number;
        const y = segment[2] as number;
        const canvasPoint = transformPoint(x - pathOffset.x, y - pathOffset.y, matrix);
        const sharedMarker = this.findSharedAnchorMarker(canvasPoint);
        this.createMarker(canvasPoint, pointIndex, PointType.ANCHOR, segIdx, undefined, sharedMarker);
        prevAnchorCanvasPoint = canvasPoint;
        anchorIndex++;
        pointIndex++;
      } else if (command === 'C') {
        // Control point 1 (connected to previous anchor)
        const cp1x = segment[1] as number;
        const cp1y = segment[2] as number;
        const cp1Canvas = transformPoint(cp1x - pathOffset.x, cp1y - pathOffset.y, matrix);

        const cp1Marker = this.createMarker(cp1Canvas, pointIndex, PointType.CONTROL, segIdx, 0);
        if (prevAnchorCanvasPoint && cp1Marker) {
          this.createHandleLine(prevAnchorCanvasPoint, cp1Canvas, cp1Marker);
        }
        pointIndex++;

        // Control point 2 (connected to this segment's anchor)
        const cp2x = segment[3] as number;
        const cp2y = segment[4] as number;
        const cp2Canvas = transformPoint(cp2x - pathOffset.x, cp2y - pathOffset.y, matrix);

        const anchorX = segment[5] as number;
        const anchorY = segment[6] as number;
        const anchorCanvas = transformPoint(anchorX - pathOffset.x, anchorY - pathOffset.y, matrix);

        const cp2Marker = this.createMarker(cp2Canvas, pointIndex, PointType.CONTROL, segIdx, 1);
        if (cp2Marker) {
          this.createHandleLine(anchorCanvas, cp2Canvas, cp2Marker);
        }
        pointIndex++;

        // Anchor point
        const sharedMarker = this.findSharedAnchorMarker(anchorCanvas);
        this.createMarker(anchorCanvas, pointIndex, PointType.ANCHOR, segIdx, undefined, sharedMarker);
        prevAnchorCanvasPoint = anchorCanvas;
        anchorIndex++;
        pointIndex++;
      } else if (command === 'Q') {
        // Control point (connected to both anchors)
        const cpx = segment[1] as number;
        const cpy = segment[2] as number;
        const cpCanvas = transformPoint(cpx - pathOffset.x, cpy - pathOffset.y, matrix);

        const anchorX = segment[3] as number;
        const anchorY = segment[4] as number;
        const anchorCanvas = transformPoint(anchorX - pathOffset.x, anchorY - pathOffset.y, matrix);

        const cpMarker = this.createMarker(cpCanvas, pointIndex, PointType.CONTROL, segIdx, 0);
        if (prevAnchorCanvasPoint && cpMarker) {
          this.createHandleLine(prevAnchorCanvasPoint, cpCanvas, cpMarker);
        }
        if (cpMarker) {
          this.createHandleLine(anchorCanvas, cpCanvas, cpMarker);
        }
        pointIndex++;

        // Anchor point
        const sharedMarker = this.findSharedAnchorMarker(anchorCanvas);
        this.createMarker(anchorCanvas, pointIndex, PointType.ANCHOR, segIdx, undefined, sharedMarker);
        prevAnchorCanvasPoint = anchorCanvas;
        anchorIndex++;
        pointIndex++;
      }
    }
  }

  private createMarker(
    position: Point,
    index: number,
    type: PointType,
    segmentIndex?: number,
    controlPointIndex?: number,
    existingMarker?: Circle | null
  ): EditPoint | null {
    const style = MARKER_STYLES[type];
    const zoomScale = this.getZoomScale();
    const marker = existingMarker ?? new Circle({
      left: position.x,
      top: position.y,
      radius: style.radius * zoomScale,
      fill: style.fill,
      stroke: style.stroke,
      strokeWidth: style.strokeWidth * zoomScale,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      objectCaching: false
    });

    if (!existingMarker) {
      this.setMarkerMetadata(marker);
      this.canvas.add(marker);
    }

    const editPoint: EditPoint = {
      marker,
      index,
      type,
      segmentIndex,
      controlPointIndex
    };

    this.editPoints.push(editPoint);
    return editPoint;
  }

  private findSharedAnchorMarker(position: Point): Circle | null {
    const tolerance = this.sharedAnchorTolerance * this.getZoomScale();
    for (const ep of this.editPoints) {
      if (ep.type !== PointType.ANCHOR) continue;
      const x = ep.marker.left ?? 0;
      const y = ep.marker.top ?? 0;
      if (Math.hypot(position.x - x, position.y - y) <= tolerance) {
        return ep.marker;
      }
    }
    return null;
  }

  private createHandleLine(anchor: Point, control: Point, editPoint: EditPoint): void {
    const zoomScale = this.getZoomScale();

    const line = new Line([anchor.x, anchor.y, control.x, control.y], {
      ...HANDLE_LINE_STYLE,
      strokeWidth: HANDLE_LINE_STYLE.strokeWidth * zoomScale,
      objectCaching: false
    });

    this.setMarkerMetadata(line);
    this.canvas.add(line);
    this.handleLines.push(line);
    editPoint.handleLine = line;
  }

  private setMarkerMetadata(obj: FabricObject): void {
    (obj as any)._editMarker = true;
    (obj as any).excludeFromExport = true;
    (obj as any).isHelper = true;
  }

  updateMarkerPosition(editPoint: EditPoint, position: Point): void {
    editPoint.marker.set({ left: position.x, top: position.y });
  }

  updateHandleLineForMarker(editPoint: EditPoint, anchorPos: Point): void {
    if (!editPoint.handleLine) return;
    const markerPos = new Point(editPoint.marker.left ?? 0, editPoint.marker.top ?? 0);
    editPoint.handleLine.set({
      x1: anchorPos.x,
      y1: anchorPos.y,
      x2: markerPos.x,
      y2: markerPos.y
    });
  }

  setMarkerState(editPoint: EditPoint, state: 'normal' | 'hover' | 'active'): void {
    const style = MARKER_STYLES[editPoint.type];
    let fill: string;

    switch (state) {
      case 'hover':
        fill = style.hoverFill;
        break;
      case 'active':
        fill = style.activeFill;
        break;
      default:
        fill = style.fill;
    }

    editPoint.marker.set({ fill });
    this.canvas.requestRenderAll();
  }

  updateAllMarkerSizes(): void {
    const zoomScale = this.getZoomScale();

    for (const ep of this.editPoints) {
      const style = MARKER_STYLES[ep.type];
      ep.marker.set({
        radius: style.radius * zoomScale,
        strokeWidth: style.strokeWidth * zoomScale
      });
    }

    for (const line of this.handleLines) {
      line.set({
        strokeWidth: HANDLE_LINE_STYLE.strokeWidth * zoomScale
      });
    }
  }

  checkZoomChanged(): boolean {
    const currentZoom = this.canvas.getZoom();
    if (Math.abs(currentZoom - this.lastZoom) > 0.0001) {
      this.lastZoom = currentZoom;
      return true;
    }
    return false;
  }

  bringMarkersToFront(): void {
    // Bring handle lines first (so they're behind markers)
    for (const line of this.handleLines) {
      this.canvas.bringObjectToFront(line);
    }
    // Then bring markers on top
    for (const ep of this.editPoints) {
      this.canvas.bringObjectToFront(ep.marker);
    }
  }

  getEditPoints(): EditPoint[] {
    return this.editPoints;
  }

  clear(): void {
    for (const line of this.handleLines) {
      this.canvas.remove(line);
    }
    this.handleLines = [];

    for (const ep of this.editPoints) {
      this.canvas.remove(ep.marker);
    }
    this.editPoints = [];
  }

  private getZoomScale(): number {
    return 1 / this.canvas.getZoom();
  }
}

// ============================================================================
// InteractionStateManager - Captures and restores object interaction states
// ============================================================================

class InteractionStateManager {
  private canvas: Canvas;
  private states: Map<FabricObject, ObjectInteractionState> = new Map();

  constructor(canvas: Canvas) {
    this.canvas = canvas;
  }

  captureAll(): void {
    this.states.clear();
    this.canvas.getObjects().forEach((obj) => {
      if (!(obj as any)._editMarker) {
        this.states.set(obj, this.capture(obj));
      }
    });
  }

  captureAndApply(obj: FabricObject): void {
    if ((obj as any)._editMarker) return;
    if (!this.states.has(obj)) {
      this.states.set(obj, this.capture(obj));
    }
    this.applyEditState(obj);
  }

  removeState(obj: FabricObject): void {
    this.states.delete(obj);
  }

  applyEditStateToAll(): void {
    this.canvas.getObjects().forEach((obj) => {
      if (!(obj as any)._editMarker) {
        this.applyEditState(obj);
      }
    });
  }

  restoreAll(): void {
    for (const [obj, state] of this.states) {
      if (this.canvas.getObjects().includes(obj)) {
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
    }
    this.states.clear();
    this.canvas.requestRenderAll();
  }

  private capture(obj: FabricObject): ObjectInteractionState {
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

  private applyEditState(obj: FabricObject): void {
    if (isEditableObject(obj)) {
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
  }
}

// ============================================================================
// PointHitTester - Handles hit detection for edit points
// ============================================================================

class PointHitTester {
  private canvas: Canvas;
  private editPoints: EditPoint[] = [];

  constructor(canvas: Canvas) {
    this.canvas = canvas;
  }

  setEditPoints(points: EditPoint[]): void {
    this.editPoints = points;
  }

  findPointAt(
    pos: Point,
    preferType: PointType = PointType.ANCHOR
  ): EditPoint | null {
    const zoom = this.canvas.getZoom();
    const hitPadding = HIT_TOLERANCE / zoom;
    const candidates: Array<{ point: EditPoint; dist: number }> = [];

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

    // Prefer the specified type
    const preferred = candidates.filter((c) => c.point.type === preferType);
    const list = preferred.length > 0 ? preferred : candidates;

    // Return closest
    return list.reduce((closest, c) => (c.dist < closest.dist ? c : closest)).point;
  }

  isOverEditPoint(pos: Point): boolean {
    return this.findPointAt(pos) !== null;
  }
}

// ============================================================================
// EditTool - Main tool class
// ============================================================================

export class EditTool extends BaseTool {
  type = ToolType.EDIT;
  name = 'Edit';
  icon = 'edit-nodes';

  // Managers
  private markerManager: EditMarkerManager | null = null;
  private stateManager: InteractionStateManager | null = null;
  private hitTester: PointHitTester | null = null;

  // State
  private selectedObject: EditableObject | null = null;
  private activePoint: EditPoint | null = null;
  private selectedPoint: EditPoint | null = null;  // Point selected for deletion (click without drag)
  private hoveredPoint: EditPoint | null = null;
  private isDragging: boolean = false;
  private hasChanges: boolean = false;
  private editedSinceSelect: boolean = false;
  private suppressSelectionClear: boolean = false;
  private lastPointer: Point | null = null;
  private linkedAnchorGroups: Map<EditPoint, EditPoint[]> = new Map();

  // DOM references
  private upperCanvasEl: HTMLCanvasElement | null = null;

  // Prior object state for restoration
  private priorObjectState: {
    hasBorders: boolean;
    hasControls: boolean;
    lockMovementX: boolean;
    lockMovementY: boolean;
    objectCaching: boolean;
  } | null = null;

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  protected setupEventListeners(): void {
    if (!this.canvas) return;

    // Initialize managers
    this.markerManager = new EditMarkerManager(this.canvas);
    this.stateManager = new InteractionStateManager(this.canvas);
    this.hitTester = new PointHitTester(this.canvas);
    snapManager.setCanvas(this.canvas);

    // Configure canvas for edit mode
    this.canvas.selection = false;
    this.canvas.targetFindTolerance = HIT_TOLERANCE;
    this.canvas.skipTargetFind = false;

    // Capture and apply interaction states
    this.stateManager.captureAll();
    this.stateManager.applyEditStateToAll();

    // Set up canvas events
    this.canvas.on('selection:created', this.handleSelectionChange);
    this.canvas.on('selection:updated', this.handleSelectionChange);
    this.canvas.on('selection:cleared', this.handleSelectionCleared);
    this.canvas.on('object:added', this.handleObjectAdded);
    this.canvas.on('object:removed', this.handleObjectRemoved);
    this.canvas.on('after:render', this.handleAfterRender);

    // Set up pointer capture for reliable dragging
    this.upperCanvasEl = (this.canvas as any).upperCanvasEl ?? null;
    if (this.upperCanvasEl) {
      this.upperCanvasEl.addEventListener('mousedown', this.handlePointerCapture, { capture: true });
    }

    // Handle any existing selection
    const activeObj = this.canvas.getActiveObject();
    if (isEditableObject(activeObj)) {
      this.selectObject(activeObj);
    } else {
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
    }
  }

  protected cleanupEventListeners(): void {
    if (!this.canvas) return;

    // Remove canvas events
    this.canvas.off('selection:created', this.handleSelectionChange);
    this.canvas.off('selection:updated', this.handleSelectionChange);
    this.canvas.off('selection:cleared', this.handleSelectionCleared);
    this.canvas.off('object:added', this.handleObjectAdded);
    this.canvas.off('object:removed', this.handleObjectRemoved);
    this.canvas.off('after:render', this.handleAfterRender);

    // Clean up edit points
    this.clearEditPoints();
    this.setCursor('default');

    // Restore interaction states
    this.stateManager?.restoreAll();

    // Clean up pointer capture
    if (this.upperCanvasEl) {
      this.upperCanvasEl.removeEventListener('mousedown', this.handlePointerCapture, { capture: true });
      this.upperCanvasEl = null;
    }

    // Clear references
    this.selectedObject = null;
    this.markerManager = null;
    this.stateManager = null;
    this.hitTester = null;
  }

  // -------------------------------------------------------------------------
  // Event Handlers
  // -------------------------------------------------------------------------

  private handlePointerCapture = (event: MouseEvent): void => {
    if (!this.canvas || event.button !== 0) return;

    const pointer = this.canvas.getPointer(event);
    const point = new Point(pointer.x, pointer.y);
    this.lastPointer = point;

    const preferType = event.altKey ? PointType.CONTROL : PointType.ANCHOR;
    const clickedPoint = this.hitTester?.findPointAt(point, preferType);

    if (!clickedPoint) return;

    // Clear previous selection visual
    if (this.selectedPoint && this.selectedPoint !== clickedPoint) {
      this.markerManager?.setMarkerState(this.selectedPoint, 'normal');
    }

    this.activePoint = clickedPoint;
    this.selectedPoint = clickedPoint;  // Keep selected for deletion after release
    this.isDragging = true;
    this.suppressSelectionClear = true;

    // Visual feedback
    this.markerManager?.setMarkerState(clickedPoint, 'active');

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };

  private handleSelectionChange = (): void => {
    if (!this.canvas) return;

    const activeObj = this.canvas.getActiveObject();
    if (isEditableObject(activeObj)) {
      this.selectObject(activeObj);
    } else {
      this.clearEditPoints();
      this.selectedObject = null;
    }
  };

  private handleSelectionCleared = (event?: { e?: Event }): void => {
    // Check if we should suppress the clear (clicking on edit point)
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

    this.stateManager?.captureAndApply(added);
  };

  private handleObjectRemoved = (event: { target?: FabricObject }): void => {
    const removed = event?.target;
    if (!removed) return;

    this.stateManager?.removeState(removed);

    // If it's a marker, update our edit points
    if ((removed as any)._editMarker) {
      const points = this.markerManager?.getEditPoints() ?? [];
      const filtered = points.filter((ep) => ep.marker !== removed);
      this.hitTester?.setEditPoints(filtered);
      return;
    }

    // If the selected object was removed
    if (removed === this.selectedObject) {
      this.activePoint = null;
      this.isDragging = false;
      this.markerManager?.clear();
      this.hitTester?.setEditPoints([]);
      this.selectedObject = null;
    }
  };

  private handleAfterRender = (): void => {
    if (!this.markerManager) return;

    if (this.markerManager.checkZoomChanged()) {
      this.markerManager.updateAllMarkerSizes();
    }
  };

  // -------------------------------------------------------------------------
  // Mouse/Touch Handlers
  // -------------------------------------------------------------------------

  onMouseDown(point: Point, event: MouseEvent): void {
    if (event.button !== 0) return;

    this.suppressSelectionClear = false;
    this.lastPointer = point;

    // Check if clicking on an edit point
    const preferType = event.altKey ? PointType.CONTROL : PointType.ANCHOR;
    const clickedPoint = this.hitTester?.findPointAt(point, preferType);

    if (clickedPoint) {
      // Clear previous selection visual
      if (this.selectedPoint && this.selectedPoint !== clickedPoint) {
        this.markerManager?.setMarkerState(this.selectedPoint, 'normal');
      }

      this.activePoint = clickedPoint;
      this.selectedPoint = clickedPoint;  // Select point for potential deletion
      this.isDragging = true;
      this.suppressSelectionClear = true;

      this.markerManager?.setMarkerState(clickedPoint, 'active');

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      return;
    }

    // Clicking elsewhere deselects the point
    if (this.selectedPoint) {
      this.markerManager?.setMarkerState(this.selectedPoint, 'normal');
      this.selectedPoint = null;
    }

    // Let Fabric handle selection when not clicking a node
  }

  onMouseMove(point: Point, _event: MouseEvent): void {
    this.lastPointer = point;

    if (this.isDragging && this.activePoint && this.selectedObject) {
      this.movePoint(this.activePoint, point);
      return;
    }

    // Hover detection
    const hovered = this.hitTester?.findPointAt(point) ?? null;

    if (hovered !== this.hoveredPoint) {
      // Clear previous hover
      if (this.hoveredPoint && this.hoveredPoint !== this.activePoint) {
        this.markerManager?.setMarkerState(this.hoveredPoint, 'normal');
      }

      // Set new hover
      if (hovered && hovered !== this.activePoint) {
        this.markerManager?.setMarkerState(hovered, 'hover');
      }

      this.hoveredPoint = hovered;
    }

    this.setCursor(hovered ? 'pointer' : 'default');
  }

  onMouseUp(_point: Point, _event: MouseEvent): void {
    if (this.isDragging) {
      // Keep selectedPoint visually active if we have one
      if (this.activePoint) {
        if (this.activePoint === this.selectedPoint) {
          // Keep it highlighted as selected
          this.markerManager?.setMarkerState(this.activePoint, 'active');
        } else {
          this.markerManager?.setMarkerState(this.activePoint, 'normal');
        }
      }

      this.isDragging = false;
      this.activePoint = null;
      this.canvas?.requestRenderAll();

      if (this.hasChanges) {
        historyManager.saveState();
        this.hasChanges = false;
      }
    }

    this.suppressSelectionClear = false;
  }

  onTouchStart(point: TouchPoint): void {
    const fabricPoint = new Point(point.x, point.y);
    this.lastPointer = fabricPoint;

    const clickedPoint = this.hitTester?.findPointAt(fabricPoint, PointType.ANCHOR);

    if (clickedPoint) {
      // Clear previous selection visual
      if (this.selectedPoint && this.selectedPoint !== clickedPoint) {
        this.markerManager?.setMarkerState(this.selectedPoint, 'normal');
      }

      this.activePoint = clickedPoint;
      this.selectedPoint = clickedPoint;
      this.isDragging = true;
      this.markerManager?.setMarkerState(clickedPoint, 'active');
    } else if (this.selectedPoint) {
      // Touching elsewhere deselects
      this.markerManager?.setMarkerState(this.selectedPoint, 'normal');
      this.selectedPoint = null;
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
    if (this.activePoint) {
      if (this.activePoint === this.selectedPoint) {
        // Keep it highlighted as selected
        this.markerManager?.setMarkerState(this.activePoint, 'active');
      } else {
        this.markerManager?.setMarkerState(this.activePoint, 'normal');
      }
    }

    this.isDragging = false;
    this.activePoint = null;

    if (this.hasChanges) {
      historyManager.saveState();
      this.hasChanges = false;
    }
  }

  // -------------------------------------------------------------------------
  // Keyboard Handler
  // -------------------------------------------------------------------------

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      // Clear selected point first
      if (this.selectedPoint) {
        this.markerManager?.setMarkerState(this.selectedPoint, 'normal');
        this.selectedPoint = null;
        this.canvas?.requestRenderAll();
        return;
      }
      this.clearEditPoints();
      this.canvas?.discardActiveObject();
      this.canvas?.requestRenderAll();
      return;
    }

    // Delete selected point (use selectedPoint which persists after click)
    const pointToDelete = this.selectedPoint ?? this.activePoint;
    if ((event.key === 'Delete' || event.key === 'Backspace') && pointToDelete) {
      event.preventDefault();
      this.deletePoint(pointToDelete);
      return;
    }

    // Nudge with arrow keys (use selectedPoint or activePoint)
    const pointToNudge = this.selectedPoint ?? this.activePoint;
    if (pointToNudge && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      const amount = event.shiftKey ? NUDGE_AMOUNT_SHIFT : NUDGE_AMOUNT;
      let dx = 0;
      let dy = 0;

      switch (event.key) {
        case 'ArrowUp': dy = -amount; break;
        case 'ArrowDown': dy = amount; break;
        case 'ArrowLeft': dx = -amount; break;
        case 'ArrowRight': dx = amount; break;
      }

      const currentPos = new Point(
        pointToNudge.marker.left ?? 0,
        pointToNudge.marker.top ?? 0
      );
      const newPos = new Point(currentPos.x + dx, currentPos.y + dy);
      this.movePoint(pointToNudge, newPos);

      if (!this.hasChanges) {
        this.hasChanges = true;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Object Selection & Point Management
  // -------------------------------------------------------------------------

  private selectObject(obj: EditableObject): void {
    if (this.selectedObject === obj) return;

    this.clearEditPoints();
    this.selectedObject = obj;

    // Store prior state
    this.priorObjectState = {
      hasBorders: obj.hasBorders ?? true,
      hasControls: obj.hasControls ?? true,
      lockMovementX: obj.lockMovementX ?? false,
      lockMovementY: obj.lockMovementY ?? false,
      objectCaching: obj.objectCaching ?? true
    };

    // Disable object controls while editing
    obj.set({
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      objectCaching: false
    });

    // Create edit markers
    if (this.markerManager) {
      const points = this.markerManager.createMarkersForObject(obj);
      this.hitTester?.setEditPoints(points);
      this.buildLinkedAnchors();
    }

    this.canvas?.requestRenderAll();
  }

  private movePoint(editPoint: EditPoint, newPos: Point): void {
    if (!this.selectedObject || !this.canvas || !this.markerManager) return;

    const targetPos = this.getSnapPosition(editPoint, newPos);

    if (this.selectedObject instanceof Path && editPoint.type === PointType.ANCHOR) {
      const linked = this.linkedAnchorGroups.get(editPoint);
      if (linked && linked.length > 1) {
        this.updateLinkedAnchorMarkers(linked, targetPos);
        this.updatePathAnchors(this.selectedObject, linked, targetPos);
        this.hasChanges = true;
        this.editedSinceSelect = true;
        this.canvas.requestRenderAll();
        return;
      }
    }

    // Update marker visual position
    this.markerManager.updateMarkerPosition(editPoint, targetPos);

    // Convert canvas position to local object coordinates
    const matrix = this.selectedObject.calcTransformMatrix();
    const pathOffset = getPathOffset(this.selectedObject);
    const localBase = inverseTransformPoint(targetPos.x, targetPos.y, matrix);
    const localPos = new Point(
      localBase.x + pathOffset.x,
      localBase.y + pathOffset.y
    );

    // Update the object
    if (this.selectedObject instanceof Polyline) {
      this.updatePolylinePoint(this.selectedObject, editPoint.index, localPos);
    } else if (this.selectedObject instanceof Path) {
      this.updatePathPoint(this.selectedObject, editPoint, localPos);
    }

    this.hasChanges = true;
    this.editedSinceSelect = true;
    this.canvas.requestRenderAll();
  }

  private updatePolylinePoint(polyline: Polyline, index: number, pos: Point): void {
    const points = polyline.points;
    if (!points || index >= points.length) return;

    // Get anchor before update for position compensation
    const anchorIndex = this.getStableAnchorIndex(points.length, index);
    const anchorBefore = anchorIndex !== null
      ? this.getPointInParentPlane(polyline, points[anchorIndex])
      : null;

    // Update point
    points[index] = new Point(pos.x, pos.y);
    polyline.set({ points: [...points] });
    this.updateObjectDimensions(polyline);

    // Compensate for bounding box shift
    if (anchorBefore && anchorIndex !== null) {
      const anchorAfter = this.getPointInParentPlane(polyline, points[anchorIndex]);
      const diff = anchorAfter.subtract(anchorBefore);
      polyline.left = (polyline.left ?? 0) - diff.x;
      polyline.top = (polyline.top ?? 0) - diff.y;
    }

    polyline.dirty = true;
    polyline.setCoords();
    this.syncMarkersWithObject();
  }

  private getSnapPosition(editPoint: EditPoint, position: Point): Point {
    if (!snapManager.isEnabled() || editPoint.type !== PointType.ANCHOR) {
      return position;
    }

    const threshold = snapManager.getAdjustedThreshold();
    let best: { point: Point; dist: number } | null = null;

    const externalSnap = snapManager.findNearestEndpoint(position, this.selectedObject ?? undefined);
    if (externalSnap.snapped) {
      const dist = Math.hypot(
        position.x - externalSnap.point.x,
        position.y - externalSnap.point.y
      );
      best = { point: externalSnap.point, dist };
    }

    const editPoints = this.markerManager?.getEditPoints() ?? [];
    const linked = this.linkedAnchorGroups.get(editPoint);
    for (const ep of editPoints) {
      if (ep === editPoint || ep.type !== PointType.ANCHOR) continue;
      if (linked && linked.includes(ep)) continue;
      const x = ep.marker.left ?? 0;
      const y = ep.marker.top ?? 0;
      const dist = Math.hypot(position.x - x, position.y - y);
      if (dist <= threshold && (!best || dist < best.dist)) {
        best = { point: new Point(x, y), dist };
      }
    }

    return best ? best.point : position;
  }

  private updatePathPoint(path: Path, editPoint: EditPoint, pos: Point): void {
    if (!path.path || editPoint.segmentIndex === undefined) return;

    // Get anchor before update for position compensation
    const anchor = this.getPathAnchorRef(path, editPoint);
    const anchorBefore = anchor ? this.getPathAnchorWorldPos(path, anchor) : null;

    const segment = path.path[editPoint.segmentIndex];
    const command = segment[0];

    if (editPoint.type === PointType.ANCHOR) {
      // Calculate delta to move connected control points
      let oldX = 0, oldY = 0;
      if (command === 'M' || command === 'L') {
        oldX = segment[1] as number;
        oldY = segment[2] as number;
        segment[1] = pos.x;
        segment[2] = pos.y;
      } else if (command === 'C') {
        oldX = segment[5] as number;
        oldY = segment[6] as number;
        segment[5] = pos.x;
        segment[6] = pos.y;
      } else if (command === 'Q') {
        oldX = segment[3] as number;
        oldY = segment[4] as number;
        segment[3] = pos.x;
        segment[4] = pos.y;
      }

      const dx = pos.x - oldX;
      const dy = pos.y - oldY;

      // Move connected control points by the same delta
      this.moveConnectedControlPoints(path, editPoint.segmentIndex, dx, dy);
    } else if (editPoint.type === PointType.CONTROL) {
      const cpIndex = editPoint.controlPointIndex ?? 0;

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

    // Compensate for bounding box shift
    if (anchorBefore && anchor) {
      const anchorAfter = this.getPathAnchorWorldPos(path, anchor);
      const diff = anchorAfter.subtract(anchorBefore);
      path.left = (path.left ?? 0) - diff.x;
      path.top = (path.top ?? 0) - diff.y;
    }

    path.dirty = true;
    path.setCoords();
    this.syncMarkersWithObject();
  }

  private moveConnectedControlPoints(path: Path, segmentIndex: number, dx: number, dy: number): void {
    if (!path.path) return;

    const segment = path.path[segmentIndex];
    const command = segment[0];

    // For C command: move cp2 (control point connected to this anchor)
    if (command === 'C') {
      segment[3] = (segment[3] as number) + dx;
      segment[4] = (segment[4] as number) + dy;
    }

    // For Q command: move the control point
    if (command === 'Q') {
      segment[1] = (segment[1] as number) + dx;
      segment[2] = (segment[2] as number) + dy;
    }

    // Check next segment - if it's a C, move its cp1 (connected to this anchor)
    const nextSegment = path.path[segmentIndex + 1];
    if (nextSegment) {
      const nextCmd = nextSegment[0];
      if (nextCmd === 'C') {
        nextSegment[1] = (nextSegment[1] as number) + dx;
        nextSegment[2] = (nextSegment[2] as number) + dy;
      } else if (nextCmd === 'Q') {
        nextSegment[1] = (nextSegment[1] as number) + dx;
        nextSegment[2] = (nextSegment[2] as number) + dy;
      }
    }
  }

  private deletePoint(editPoint: EditPoint): void {
    if (!this.selectedObject || !this.canvas) return;

    // Only allow deleting anchor points
    if (editPoint.type !== PointType.ANCHOR) return;

    if (this.selectedObject instanceof Polyline) {
      this.deletePolylinePoint(editPoint);
    } else if (this.selectedObject instanceof Path) {
      this.deletePathPoint(editPoint);
    }
  }

  private deletePolylinePoint(editPoint: EditPoint): void {
    if (!(this.selectedObject instanceof Polyline) || !this.canvas) return;

    const points = this.selectedObject.points;
    if (!points || points.length <= 2) return; // Need at least 2 points

    // Get a stable anchor point position before deletion for compensation
    const anchorIndex = editPoint.index === 0 ? 1 : 0;
    const anchorBefore = this.getPointInParentPlane(this.selectedObject, points[anchorIndex]);

    points.splice(editPoint.index, 1);
    this.selectedObject.set({ points: [...points] });
    this.updateObjectDimensions(this.selectedObject);

    // Compensate for bounding box shift
    const newAnchorIndex = editPoint.index === 0 ? 0 : anchorIndex;
    if (points[newAnchorIndex]) {
      const anchorAfter = this.getPointInParentPlane(this.selectedObject, points[newAnchorIndex]);
      const diff = anchorAfter.subtract(anchorBefore);
      this.selectedObject.left = (this.selectedObject.left ?? 0) - diff.x;
      this.selectedObject.top = (this.selectedObject.top ?? 0) - diff.y;
    }

    this.selectedObject.dirty = true;
    this.selectedObject.setCoords();

    this.finalizePointDeletion();
  }

  private deletePathPoint(editPoint: EditPoint): void {
    if (!(this.selectedObject instanceof Path) || !this.canvas) return;

    const pathData = this.selectedObject.path;
    if (!pathData || editPoint.segmentIndex === undefined) return;

    // Count anchor points to ensure we keep at least 2
    let anchorCount = 0;
    for (const segment of pathData) {
      const cmd = segment[0];
      if (cmd === 'M' || cmd === 'L' || cmd === 'C' || cmd === 'Q') {
        anchorCount++;
      }
    }
    if (anchorCount <= 2) return;

    // Find a stable anchor to use for position compensation (not the one being deleted)
    const stableAnchorRef = this.getPathAnchorRef(this.selectedObject, editPoint);
    const anchorBefore = stableAnchorRef ? this.getPathAnchorWorldPos(this.selectedObject, stableAnchorRef) : null;

    const segmentIndex = editPoint.segmentIndex;
    const segment = pathData[segmentIndex];
    const command = segment[0];

    // Handle deletion based on segment type
    if (command === 'M') {
      // Deleting the start point: remove M and make next segment the new start
      if (pathData.length > 1) {
        const nextSeg = pathData[1];
        const nextCmd = nextSeg[0];
        // Convert next segment to M
        if (nextCmd === 'L') {
          pathData[1] = ['M', nextSeg[1], nextSeg[2]];
        } else if (nextCmd === 'C') {
          // For curve, use the endpoint as new M, lose the curve
          pathData[1] = ['M', nextSeg[5], nextSeg[6]];
        } else if (nextCmd === 'Q') {
          pathData[1] = ['M', nextSeg[3], nextSeg[4]];
        }
        pathData.splice(0, 1);
      }
    } else if (command === 'L') {
      // Simple line segment - just remove it
      pathData.splice(segmentIndex, 1);
    } else if (command === 'C') {
      // Cubic bezier - just remove it
      pathData.splice(segmentIndex, 1);
    } else if (command === 'Q') {
      // Quadratic bezier - just remove it
      pathData.splice(segmentIndex, 1);
    }

    // Update the path
    this.selectedObject.set({ path: [...pathData] });
    this.updateObjectDimensions(this.selectedObject);

    // Compensate for bounding box shift using the stable anchor
    if (anchorBefore && stableAnchorRef) {
      // Recalculate the anchor ref since indices may have shifted
      const newAnchorRef = this.findFirstAnchorRef(this.selectedObject);
      if (newAnchorRef) {
        const anchorAfter = this.getPathAnchorWorldPos(this.selectedObject, newAnchorRef);
        const diff = anchorAfter.subtract(anchorBefore);
        this.selectedObject.left = (this.selectedObject.left ?? 0) - diff.x;
        this.selectedObject.top = (this.selectedObject.top ?? 0) - diff.y;
      }
    }

    this.selectedObject.dirty = true;
    this.selectedObject.setCoords();

    this.finalizePointDeletion();
  }

  private findFirstAnchorRef(path: Path): { segmentIndex: number; xIndex: number; yIndex: number } | null {
    if (!path.path) return null;

    for (let i = 0; i < path.path.length; i++) {
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

  private finalizePointDeletion(): void {
    if (!this.selectedObject || !this.canvas) return;

    // Recreate markers
    if (this.markerManager) {
      const newPoints = this.markerManager.createMarkersForObject(this.selectedObject);
      this.hitTester?.setEditPoints(newPoints);
      this.buildLinkedAnchors();
    }

    this.activePoint = null;
    this.selectedPoint = null;
    this.hasChanges = true;
    this.editedSinceSelect = true;
    historyManager.saveState();
    this.canvas.requestRenderAll();
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private syncMarkersWithObject(): void {
    if (!this.canvas || !this.selectedObject || !this.markerManager) return;

    const editPoints = this.markerManager.getEditPoints();
    if (editPoints.length === 0) return;

    const matrix = this.selectedObject.calcTransformMatrix();
    const pathOffset = getPathOffset(this.selectedObject);

    if (this.selectedObject instanceof Polyline) {
      const points = this.selectedObject.points ?? [];

      for (const ep of editPoints) {
        const pt = points[ep.index];
        if (!pt) continue;

        const canvasPoint = transformPoint(
          pt.x - pathOffset.x,
          pt.y - pathOffset.y,
          matrix
        );
        this.markerManager.updateMarkerPosition(ep, canvasPoint);
      }
    } else if (this.selectedObject instanceof Path) {
      const path = this.selectedObject;
      if (!path.path) return;

      for (const ep of editPoints) {
        if (ep.segmentIndex === undefined) continue;

        const segment = path.path[ep.segmentIndex];
        if (!segment) continue;

        const command = segment[0];
        let x: number | null = null;
        let y: number | null = null;

        if (ep.type === PointType.ANCHOR) {
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
        } else if (ep.type === PointType.CONTROL) {
          const cpIndex = ep.controlPointIndex ?? 0;
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

        const canvasPoint = transformPoint(
          x - pathOffset.x,
          y - pathOffset.y,
          matrix
        );
        this.markerManager.updateMarkerPosition(ep, canvasPoint);

        // Update handle lines for control points
        if (ep.type === PointType.CONTROL && ep.handleLine) {
          // Find connected anchor
          const anchorPos = this.findConnectedAnchorPosition(path, ep, matrix, pathOffset);
          if (anchorPos) {
            this.markerManager.updateHandleLineForMarker(ep, anchorPos);
          }
        }
      }
    }
  }

  private findConnectedAnchorPosition(
    path: Path,
    controlPoint: EditPoint,
    matrix: number[],
    pathOffset: Point
  ): Point | null {
    if (!path.path || controlPoint.segmentIndex === undefined) return null;

    const segment = path.path[controlPoint.segmentIndex];
    const command = segment[0];
    const cpIndex = controlPoint.controlPointIndex ?? 0;

    let anchorX: number | null = null;
    let anchorY: number | null = null;

    if (command === 'C') {
      if (cpIndex === 0) {
        // First control point - connected to previous segment's anchor
        const prevSegIdx = controlPoint.segmentIndex - 1;
        if (prevSegIdx >= 0) {
          const prevSeg = path.path[prevSegIdx];
          const prevCmd = prevSeg[0];
          if (prevCmd === 'M' || prevCmd === 'L') {
            anchorX = prevSeg[1] as number;
            anchorY = prevSeg[2] as number;
          } else if (prevCmd === 'C') {
            anchorX = prevSeg[5] as number;
            anchorY = prevSeg[6] as number;
          } else if (prevCmd === 'Q') {
            anchorX = prevSeg[3] as number;
            anchorY = prevSeg[4] as number;
          }
        }
      } else {
        // Second control point - connected to this segment's anchor
        anchorX = segment[5] as number;
        anchorY = segment[6] as number;
      }
    } else if (command === 'Q') {
      // Q has one control point between two anchors
      // Connect to this segment's anchor for simplicity
      anchorX = segment[3] as number;
      anchorY = segment[4] as number;
    }

    if (anchorX === null || anchorY === null) return null;

    return transformPoint(
      anchorX - pathOffset.x,
      anchorY - pathOffset.y,
      matrix
    );
  }

  private getStableAnchorIndex(pointCount: number, editedIndex: number): number | null {
    if (pointCount <= 1) return null;
    return editedIndex !== 0 ? 0 : (pointCount > 1 ? 1 : null);
  }

  private getPointInParentPlane(
    obj: { pathOffset?: { x: number; y: number } | Point; calcOwnMatrix: () => TMat2D },
    point: Point | { x: number; y: number }
  ): Point {
    const offset = getPathOffset(obj as FabricObject);
    const basePoint = point instanceof Point ? point : new Point(point.x, point.y);
    return basePoint.subtract(offset).transform(obj.calcOwnMatrix());
  }

  private getPathAnchorRef(
    path: Path,
    editPoint?: EditPoint,
    skipSegments?: Set<number>
  ): { segmentIndex: number; xIndex: number; yIndex: number } | null {
    if (!path.path) return null;

    const skipSet = new Set<number>();
    if (skipSegments) {
      skipSegments.forEach((seg) => skipSet.add(seg));
    }

    if (editPoint && editPoint.type === PointType.ANCHOR && editPoint.segmentIndex !== undefined) {
      skipSet.add(editPoint.segmentIndex);
    }

    for (let i = 0; i < path.path.length; i++) {
      if (skipSet.has(i)) continue;

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

  private buildLinkedAnchors(): void {
    this.linkedAnchorGroups.clear();
    if (!this.markerManager || !this.canvas) return;

    const anchors = this.markerManager
      .getEditPoints()
      .filter((ep) => ep.type === PointType.ANCHOR);

    if (anchors.length < 2) return;

    const groupsByMarker = new Map<Circle, EditPoint[]>();
    for (const ep of anchors) {
      const list = groupsByMarker.get(ep.marker) ?? [];
      list.push(ep);
      groupsByMarker.set(ep.marker, list);
    }

    for (const group of groupsByMarker.values()) {
      if (group.length > 1) {
        group.forEach((ep) => this.linkedAnchorGroups.set(ep, group));
      }
    }
  }

  private updateLinkedAnchorMarkers(editPoints: EditPoint[], position: Point): void {
    if (!this.markerManager) return;
    for (const ep of editPoints) {
      this.markerManager.updateMarkerPosition(ep, position);
    }
  }

  private updatePathAnchors(path: Path, editPoints: EditPoint[], canvasPos: Point): void {
    if (!path.path) return;

    const matrix = path.calcTransformMatrix();
    const pathOffset = getPathOffset(path);
    const localBase = inverseTransformPoint(canvasPos.x, canvasPos.y, matrix);
    const localPos = new Point(
      localBase.x + pathOffset.x,
      localBase.y + pathOffset.y
    );

    const skipSegments = new Set<number>();
    editPoints.forEach((ep) => {
      if (ep.segmentIndex !== undefined) {
        skipSegments.add(ep.segmentIndex);
      }
    });

    const anchor = this.getPathAnchorRef(path, undefined, skipSegments);
    const anchorBefore = anchor ? this.getPathAnchorWorldPos(path, anchor) : null;

    for (const ep of editPoints) {
      if (ep.segmentIndex === undefined) continue;
      const segment = path.path[ep.segmentIndex];
      const command = segment[0];

      if (command === 'M' || command === 'L') {
        segment[1] = localPos.x;
        segment[2] = localPos.y;
      } else if (command === 'C') {
        segment[5] = localPos.x;
        segment[6] = localPos.y;
      } else if (command === 'Q') {
        segment[3] = localPos.x;
        segment[4] = localPos.y;
      }
    }

    path.set({ path: [...path.path] });
    this.updateObjectDimensions(path);

    if (anchorBefore && anchor) {
      const anchorAfter = this.getPathAnchorWorldPos(path, anchor);
      const diff = anchorAfter.subtract(anchorBefore);
      path.left = (path.left ?? 0) - diff.x;
      path.top = (path.top ?? 0) - diff.y;
    }

    path.dirty = true;
    path.setCoords();
    this.syncMarkersWithObject();
  }

  private getPathAnchorWorldPos(
    path: Path,
    anchor: { segmentIndex: number; xIndex: number; yIndex: number }
  ): Point {
    const segment = path.path?.[anchor.segmentIndex];
    const x = (segment?.[anchor.xIndex] as number) ?? 0;
    const y = (segment?.[anchor.yIndex] as number) ?? 0;
    return this.getPointInParentPlane(path, new Point(x, y));
  }

  private updateObjectDimensions(obj: FabricObject): void {
    if (typeof (obj as any).setDimensions === 'function') {
      (obj as any).setDimensions();
    } else if (typeof (obj as any)._setPositionDimensions === 'function') {
      (obj as any)._setPositionDimensions({});
    }
  }

  private isPointerOverEditPoint(event?: Event): boolean {
    const point = this.getPointFromEvent(event) ?? this.lastPointer;
    if (!point) return false;
    return this.hitTester?.isOverEditPoint(point) ?? false;
  }

  private getPointFromEvent(event?: Event): Point | null {
    if (!this.canvas || !event) return null;

    if (event instanceof MouseEvent) {
      const pointer = this.canvas.getPointer(event);
      return new Point(pointer.x, pointer.y);
    }

    const touchEvent = event as TouchEvent;
    const touch = touchEvent.touches?.[0] ?? touchEvent.changedTouches?.[0];
    if (touch) {
      const fakeMouseEvent = { clientX: touch.clientX, clientY: touch.clientY } as MouseEvent;
      const pointer = this.canvas.getPointer(fakeMouseEvent);
      return new Point(pointer.x, pointer.y);
    }

    return null;
  }

  private setCursor(cursor: string): void {
    if (!this.canvas) return;
    const upperCanvas = (this.canvas as any).upperCanvasEl as HTMLCanvasElement | undefined;
    if (upperCanvas) {
      upperCanvas.style.cursor = cursor;
    }
  }

  private clearEditPoints(): void {
    if (!this.canvas) return;

    this.markerManager?.clear();
    this.hitTester?.setEditPoints([]);
    this.linkedAnchorGroups.clear();

    // Restore object state if there was a selected object
    if (this.selectedObject && this.canvas.getObjects().includes(this.selectedObject)) {
      if (this.editedSinceSelect) {
        // Force full recalculation of bounding box
        if (this.selectedObject instanceof Polyline && this.selectedObject.points) {
          this.selectedObject.set({ points: [...this.selectedObject.points] });
        } else if (this.selectedObject instanceof Path && this.selectedObject.path) {
          this.selectedObject.set({ path: [...this.selectedObject.path] });
        }
        this.updateObjectDimensions(this.selectedObject);
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
    this.activePoint = null;
    this.selectedPoint = null;
    this.hoveredPoint = null;
  }

  // -------------------------------------------------------------------------
  // Public Interface
  // -------------------------------------------------------------------------

  cancel(): void {
    this.clearEditPoints();
    this.selectedObject = null;
    this.selectedPoint = null;
    super.cancel();
  }

  getPreview(): FabricObject | null {
    return null;
  }
}
