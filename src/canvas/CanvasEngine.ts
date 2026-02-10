import { Canvas, FabricObject, Point, Polyline, Path } from 'fabric';
import type { CanvasConfig, CanvasEventType, CanvasEngineEvents } from '@/types';
import { CANVAS_DEFAULTS, ZOOM } from '@/constants';
import {
  clamp,
  applyPostLoadVisualState,
  CANVAS_OBJECT_PROPS,
  getThemeCanvasBackground
} from '@/utils';
import { themeManager } from '@/utils/ThemeManager';

type EventCallback<T extends CanvasEventType> = (
  data: CanvasEngineEvents[T]
) => void;

export class CanvasEngine {
  private static instance: CanvasEngine | null = null;
  private canvas: Canvas | null = null;
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private themeUnsubscribe: (() => void) | null = null;
  private listeners: Map<CanvasEventType, Set<EventCallback<CanvasEventType>>> =
    new Map();

  private constructor() {}

  static getInstance(): CanvasEngine {
    if (!CanvasEngine.instance) {
      CanvasEngine.instance = new CanvasEngine();
    }
    return CanvasEngine.instance;
  }

  async initialize(
    container: HTMLElement,
    config?: Partial<CanvasConfig>
  ): Promise<Canvas> {
    this.container = container;

    const canvasEl = document.createElement('canvas');
    canvasEl.id = 'main-canvas';
    container.appendChild(canvasEl);

    // Prevent browser native drag behavior (fixes Edge ghost image issue)
    container.setAttribute('draggable', 'false');
    container.addEventListener('dragstart', (e) => e.preventDefault());
    canvasEl.setAttribute('draggable', 'false');
    canvasEl.addEventListener('dragstart', (e) => e.preventDefault());

    const { width, height } = container.getBoundingClientRect();

    this.canvas = new Canvas(canvasEl, {
      width,
      height,
      backgroundColor: config?.backgroundColor ?? getThemeCanvasBackground(),
      selection: config?.selection ?? true,
      preserveObjectStacking: config?.preserveObjectStacking ?? true,
      selectionColor: CANVAS_DEFAULTS.selectionColor,
      selectionBorderColor: CANVAS_DEFAULTS.selectionBorderColor,
      selectionLineWidth: CANVAS_DEFAULTS.selectionLineWidth,
      renderOnAddRemove: true,
      stopContextMenu: true,
      fireRightClick: true,
      // Performance optimizations
      enableRetinaScaling: false, // Disable 2x rendering for better performance
      skipOffscreen: true // Skip rendering objects outside viewport
    });

    // Also prevent drag on Fabric's upper canvas (the interactive layer)
    const upperCanvas = this.canvas.upperCanvasEl;
    if (upperCanvas) {
      upperCanvas.setAttribute('draggable', 'false');
      upperCanvas.addEventListener('dragstart', (e) => e.preventDefault());
    }

    this.setupResizeObserver();
    this.setupCanvasEvents();
    this.setupThemeListener();
    this.emit('canvas:ready', this.canvas);

    return this.canvas;
  }

  private setupResizeObserver(): void {
    if (!this.container) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.resize(width, height);
      }
    });

    this.resizeObserver.observe(this.container);
  }

  private setupThemeListener(): void {
    this.themeUnsubscribe = themeManager.subscribe((_theme) => {
      if (this.canvas) {
        this.canvas.backgroundColor = getThemeCanvasBackground();
        this.canvas.requestRenderAll();
      }
    });
  }

  private setupCanvasEvents(): void {
    if (!this.canvas) return;

    this.canvas.on('selection:created', () => {
      this.emit('selection:changed', this.canvas!.getActiveObjects());
    });

    this.canvas.on('selection:updated', () => {
      this.emit('selection:changed', this.canvas!.getActiveObjects());
    });

    this.canvas.on('selection:cleared', () => {
      this.emit('selection:changed', []);
    });

    this.canvas.on('object:modified', (e) => {
      if (e.target) {
        // Ensure Polyline and Path objects update their bounding box after transformations
        if (e.target instanceof Polyline || e.target instanceof Path) {
          if (typeof (e.target as any)._setPositionDimensions === 'function') {
            (e.target as any)._setPositionDimensions({});
          }
          e.target.setCoords();
        }
        this.emit('object:modified', e.target);
      }
    });
  }

  resize(width: number, height: number): void {
    if (!this.canvas) return;

    this.canvas.setDimensions({ width, height });
    this.canvas.requestRenderAll();
  }

  getCanvas(): Canvas | null {
    return this.canvas;
  }

  setZoom(level: number, point?: { x: number; y: number }): void {
    if (!this.canvas) return;

    const clampedZoom = clamp(level, ZOOM.min, ZOOM.max);

    if (point) {
      this.canvas.zoomToPoint(new Point(point.x, point.y), clampedZoom);
    } else {
      this.canvas.setZoom(clampedZoom);
    }

    this.emit('canvas:zoom', clampedZoom);
    this.canvas.requestRenderAll();
  }

  getZoom(): number {
    return this.canvas?.getZoom() ?? ZOOM.default;
  }

  setPan(x: number, y: number): void {
    if (!this.canvas) return;

    const vpt = this.canvas.viewportTransform;
    if (vpt) {
      vpt[4] = x;
      vpt[5] = y;
      this.canvas.setViewportTransform(vpt);
      this.emit('canvas:pan', { x, y });
      this.canvas.requestRenderAll();
    }
  }

  relativePan(deltaX: number, deltaY: number): void {
    if (!this.canvas) return;

    const vpt = this.canvas.viewportTransform;
    if (vpt) {
      vpt[4] += deltaX;
      vpt[5] += deltaY;
      this.canvas.setViewportTransform(vpt);
      this.emit('canvas:pan', { x: vpt[4], y: vpt[5] });
      this.canvas.requestRenderAll();
    }
  }

  getPan(): { x: number; y: number } {
    const vpt = this.canvas?.viewportTransform;
    return {
      x: vpt?.[4] ?? 0,
      y: vpt?.[5] ?? 0
    };
  }

  addObject(obj: FabricObject): void {
    if (!this.canvas) return;
    this.canvas.add(obj);
    this.canvas.requestRenderAll();
  }

  removeObject(obj: FabricObject): void {
    if (!this.canvas) return;
    this.canvas.remove(obj);
    this.canvas.requestRenderAll();
  }

  clearSelection(): void {
    this.canvas?.discardActiveObject();
    this.canvas?.requestRenderAll();
  }

  setSelectionMode(enabled: boolean): void {
    if (!this.canvas) return;
    this.canvas.selection = enabled;
    this.canvas.forEachObject((obj) => {
      obj.selectable = enabled;
      obj.evented = enabled;
    });
  }

  toJSON(): object {
    return this.canvas?.toObject([...CANVAS_OBJECT_PROPS]) ?? {};
  }

  async loadFromJSON(json: object): Promise<void> {
    if (!this.canvas) return;
    await this.canvas.loadFromJSON(json);
    applyPostLoadVisualState(this.canvas);
  }

  toDataURL(options?: { format?: 'png' | 'jpeg'; quality?: number; multiplier?: number }): string {
    if (!this.canvas) return '';
    return this.canvas.toDataURL({
      format: options?.format ?? 'png',
      quality: options?.quality ?? 1,
      multiplier: options?.multiplier ?? 1
    });
  }

  on<T extends CanvasEventType>(
    event: T,
    callback: EventCallback<T>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<CanvasEventType>);

    return () => {
      this.listeners.get(event)?.delete(callback as EventCallback<CanvasEventType>);
    };
  }

  private emit<T extends CanvasEventType>(
    event: T,
    data: CanvasEngineEvents[T]
  ): void {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }

  dispose(): void {
    this.themeUnsubscribe?.();
    this.resizeObserver?.disconnect();
    this.canvas?.dispose();
    this.canvas = null;
    this.container = null;
    this.listeners.clear();
    CanvasEngine.instance = null;
  }
}
