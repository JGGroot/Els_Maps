import type { FabricObject } from 'fabric';
import type { CanvasState } from '@/types';
import { ZOOM } from '@/constants';

type StateChangeCallback = (state: CanvasState) => void;

export class CanvasStateManager {
  private state: CanvasState;
  private listeners: Set<StateChangeCallback> = new Set();
  private undoStack: object[] = [];
  private redoStack: object[] = [];
  private maxHistorySize = 50;

  constructor() {
    this.state = {
      zoom: ZOOM.default,
      viewportTransform: [1, 0, 0, 1, 0, 0],
      selectedObjects: [],
      isDirty: false
    };
  }

  getState(): CanvasState {
    return { ...this.state };
  }

  setZoom(zoom: number): void {
    this.state.zoom = zoom;
    this.notifyListeners();
  }

  setViewportTransform(transform: number[]): void {
    this.state.viewportTransform = [...transform];
    this.notifyListeners();
  }

  setSelectedObjects(objects: FabricObject[]): void {
    this.state.selectedObjects = objects;
    this.notifyListeners();
  }

  setDirty(isDirty: boolean): void {
    this.state.isDirty = isDirty;
    this.notifyListeners();
  }

  pushToHistory(canvasState: object): void {
    this.undoStack.push(canvasState);
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.setDirty(true);
  }

  undo(): object | null {
    if (this.undoStack.length === 0) return null;

    const state = this.undoStack.pop()!;
    this.redoStack.push(state);
    return this.undoStack[this.undoStack.length - 1] ?? null;
  }

  redo(): object | null {
    if (this.redoStack.length === 0) return null;

    const state = this.redoStack.pop()!;
    this.undoStack.push(state);
    return state;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  subscribe(callback: StateChangeCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const stateCopy = this.getState();
    this.listeners.forEach((cb) => cb(stateCopy));
  }

  reset(): void {
    this.state = {
      zoom: ZOOM.default,
      viewportTransform: [1, 0, 0, 1, 0, 0],
      selectedObjects: [],
      isDirty: false
    };
    this.undoStack = [];
    this.redoStack = [];
    this.notifyListeners();
  }
}
