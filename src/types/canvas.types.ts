import type { Canvas, FabricObject } from 'fabric';

export interface CanvasConfig {
  width: number;
  height: number;
  backgroundColor: string;
  selection: boolean;
  preserveObjectStacking: boolean;
}

export interface CanvasState {
  zoom: number;
  viewportTransform: number[];
  selectedObjects: FabricObject[];
  isDirty: boolean;
}

export interface LockedCanvasState {
  locked: boolean;
  width: number;
  height: number;
  imageId: string | null;
  offsetX: number;
  offsetY: number;
}

export interface ViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type CanvasEventType =
  | 'canvas:ready'
  | 'canvas:zoom'
  | 'canvas:pan'
  | 'selection:changed'
  | 'object:modified';

export interface CanvasEngineEvents {
  'canvas:ready': Canvas;
  'canvas:zoom': number;
  'canvas:pan': { x: number; y: number };
  'selection:changed': FabricObject[];
  'object:modified': FabricObject;
}
