import type { Canvas, FabricObject } from 'fabric';
import type { LockedCanvasState } from '@/types';
import { canvasLockManager } from '@/canvas';
import { applyPostLoadVisualState, restoreCanvasLockState, CANVAS_OBJECT_PROPS } from './canvasPersistence';

export interface HistoryState {
  json: object;
  timestamp: number;
  lockState?: LockedCanvasState;
}

export class HistoryManager {
  private canvas: Canvas | null = null;
  private history: HistoryState[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number = 50;
  private isDirty: boolean = false;
  private isRestoring: boolean = false;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  private readonly handleObjectAdded = (event: { target?: FabricObject }): void => {
    if (this.shouldTrack(event?.target)) {
      this.markDirty();
      this.scheduleSave();
    }
  };

  private readonly handleObjectModified = (event: { target?: FabricObject }): void => {
    if (this.shouldTrack(event?.target)) {
      this.markDirty();
      this.scheduleSave();
    }
  };

  private readonly handleObjectRemoved = (event: { target?: FabricObject }): void => {
    if (this.shouldTrack(event?.target)) {
      this.markDirty();
      this.scheduleSave();
    }
  };

  setCanvas(canvas: Canvas): void {
    if (this.canvas === canvas) return;

    if (this.canvas) {
      this.detachCanvasListeners();
    }

    this.canvas = canvas;
    this.attachCanvasListeners();
    this.clear();
    this.saveState();
  }

  saveState(): void {
    if (!this.canvas || this.isRestoring) return;

    // Remove any redo history if we're in the middle
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Serialize entire canvas state
    const json = this.canvas.toObject([...CANVAS_OBJECT_PROPS]);

    this.history.push({
      json,
      timestamp: Date.now(),
      lockState: canvasLockManager.getLockedState()
    });

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      const overflow = this.history.length - this.maxHistorySize;
      this.history.splice(0, overflow);
    }

    this.currentIndex = this.history.length - 1;
  }

  undo(): boolean {
    if (!this.canvas || this.currentIndex <= 0) return false;

    this.currentIndex -= 1;
    const state = this.history[this.currentIndex];
    if (!state) return false;

    this.restoreState(state);
    return true;
  }

  redo(): boolean {
    if (!this.canvas) return false;

    // Can only redo if we're behind the latest state
    if (this.currentIndex >= this.history.length - 1) return false;

    this.currentIndex += 1;
    const state = this.history[this.currentIndex];
    if (!state) return false;

    this.restoreState(state);
    return true;
  }

  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    this.isDirty = false;
  }

  private restoreState(state: HistoryState): void {
    if (!this.canvas) return;

    this.isRestoring = true;
    this.canvas
      .loadFromJSON(state.json)
      .then(() => {
        if (this.canvas) {
          applyPostLoadVisualState(this.canvas);
          restoreCanvasLockState(this.canvas, state.lockState ?? null);
        }
      })
      .catch((error) => {
        console.error('Failed to restore canvas state:', error);
      })
      .finally(() => {
        this.isRestoring = false;
      });
  }

  markDirty(): void {
    this.isDirty = true;
  }

  getIsDirty(): boolean {
    return this.isDirty;
  }

  markClean(): void {
    this.isDirty = false;
  }

  private scheduleSave(): void {
    if (this.saveTimeout || this.isRestoring) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.saveState();
    }, 0);
  }

  private shouldTrack(target?: FabricObject): boolean {
    if (this.isRestoring) return false;
    if (!target) return true;

    if ((target as any).excludeFromExport) return false;

    const selectable = target.selectable ?? true;
    const evented = target.evented ?? true;
    if (!selectable && !evented) return false;

    return true;
  }

  private attachCanvasListeners(): void {
    if (!this.canvas) return;
    this.canvas.on('object:added', this.handleObjectAdded);
    this.canvas.on('object:modified', this.handleObjectModified);
    this.canvas.on('object:removed', this.handleObjectRemoved);
  }

  private detachCanvasListeners(): void {
    if (!this.canvas) return;
    this.canvas.off('object:added', this.handleObjectAdded);
    this.canvas.off('object:modified', this.handleObjectModified);
    this.canvas.off('object:removed', this.handleObjectRemoved);
  }
}

// Singleton instance
export const historyManager = new HistoryManager();
