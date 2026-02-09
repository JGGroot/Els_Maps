import type { Canvas, FabricObject, Point } from 'fabric';
import type { TouchPoint } from './gesture.types';

export enum ToolType {
  SELECT = 'select',
  EDIT = 'edit',
  PAN = 'pan',
  POLYLINE = 'polyline',
  BEZIER_PEN = 'bezier_pen',
  AUTOSPLINE = 'autospline',
  TSPLINE = 'tspline',
  RECTANGLE = 'rectangle',
  ELLIPSE = 'ellipse',
  TEXT = 'text'
}

export interface ToolState {
  activeTool: ToolType;
  isDrawing: boolean;
  currentPoints: Point[];
  previewObject: FabricObject | null;
}

export interface ToolConfig {
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  opacity: number;
  fontFamily: string;
}

export interface ToolContext {
  canvas: Canvas;
  config: ToolConfig;
  isMobile: boolean;
  showActionButton: (mode: 'confirm' | 'cancel' | 'both') => void;
  hideActionButton: () => void;
  updateReticle: (x: number, y: number, visible: boolean) => void;
}

export interface ITool {
  type: ToolType;
  name: string;
  icon: string;

  activate(context: ToolContext): void;
  deactivate(): void;

  // Desktop mouse events
  onMouseDown?(point: Point, event: MouseEvent): void;
  onMouseMove?(point: Point, event: MouseEvent): void;
  onMouseUp?(point: Point, event: MouseEvent): void;

  // Touch events (single finger only)
  onTouchStart?(point: TouchPoint): void;
  onTouchMove?(point: TouchPoint): void;
  onTouchEnd?(point: TouchPoint): void;

  // Keyboard events
  onKeyDown?(event: KeyboardEvent): void;

  // Mobile action button callbacks
  onActionConfirm?(): void;
  onActionCancel?(): void;

  // State
  isDrawing(): boolean;
  getPreview(): FabricObject | null;
  cancel(): void;
}
