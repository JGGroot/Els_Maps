import type { Canvas, Point } from 'fabric';
import type { ITool, ToolConfig, ToolContext, ToolType } from '@/types';
import type { TouchPoint, ActionButtonMode } from '@/types';
import { TOOL_DEFAULTS } from '@/constants';
import { SelectionTool } from './SelectionTool';
import { EditTool } from './EditTool';
import { PanTool } from './PanTool';
import { PolylineTool } from './PolylineTool';
import { BezierPenTool } from './BezierPenTool';
import { AutosplineTool } from './AutosplineTool';
import { TSplineTool } from './TSplineTool';
import { RectangleTool } from './RectangleTool';
import { EllipseTool } from './EllipseTool';
import { TextTool } from './TextTool';
import { isMobileDevice } from '@/utils';

type ToolEventType = 'tool:changed' | 'drawing:started' | 'drawing:ended';
type ToolEventCallback = (tool: ITool) => void;

export interface ToolManagerCallbacks {
  showActionButton: (mode: ActionButtonMode) => void;
  hideActionButton: () => void;
  updateReticle: (x: number, y: number, visible: boolean) => void;
}

export class ToolManager {
  private tools: Map<ToolType, ITool> = new Map();
  private activeTool: ITool | null = null;
  private canvas: Canvas | null = null;
  private config: ToolConfig;
  private isMobile: boolean;
  private callbacks: ToolManagerCallbacks;
  private listeners: Map<ToolEventType, Set<ToolEventCallback>> = new Map();

  constructor(callbacks: ToolManagerCallbacks) {
    this.config = { ...TOOL_DEFAULTS };
    this.isMobile = isMobileDevice();
    this.callbacks = callbacks;

    this.registerTool(new SelectionTool());
    this.registerTool(new EditTool());
    this.registerTool(new PanTool());
    this.registerTool(new PolylineTool());
    this.registerTool(new BezierPenTool());
    this.registerTool(new AutosplineTool());
    this.registerTool(new TSplineTool());
    this.registerTool(new RectangleTool());
    this.registerTool(new EllipseTool());
    this.registerTool(new TextTool());
  }

  setCanvas(canvas: Canvas): void {
    this.canvas = canvas;
  }

  private registerTool(tool: ITool): void {
    this.tools.set(tool.type, tool);
  }

  setActiveTool(type: ToolType): void {
    if (this.activeTool) {
      this.activeTool.deactivate();
    }

    const tool = this.tools.get(type);
    if (!tool || !this.canvas) return;

    const context: ToolContext = {
      canvas: this.canvas,
      config: this.config,
      isMobile: this.isMobile,
      showActionButton: this.callbacks.showActionButton,
      hideActionButton: this.callbacks.hideActionButton,
      updateReticle: this.callbacks.updateReticle
    };

    tool.activate(context);
    this.activeTool = tool;
    this.emit('tool:changed', tool);
  }

  getActiveTool(): ITool | null {
    return this.activeTool;
  }

  getActiveToolType(): ToolType | null {
    return this.activeTool?.type ?? null;
  }

  getAllTools(): ITool[] {
    return Array.from(this.tools.values());
  }

  setConfig(config: Partial<ToolConfig>): void {
    this.config = { ...this.config, ...config };
    // Update active tool's context immediately
    if (this.activeTool && this.canvas) {
      const context: ToolContext = {
        canvas: this.canvas,
        config: this.config,
        isMobile: this.isMobile,
        showActionButton: this.callbacks.showActionButton,
        hideActionButton: this.callbacks.hideActionButton,
        updateReticle: this.callbacks.updateReticle
      };
      (this.activeTool as any).context = context;
    }
  }

  getConfig(): ToolConfig {
    return { ...this.config };
  }

  handleMouseDown(point: Point, event: MouseEvent): void {
    this.activeTool?.onMouseDown?.(point, event);
  }

  handleMouseMove(point: Point, event: MouseEvent): void {
    this.activeTool?.onMouseMove?.(point, event);
  }

  handleMouseUp(point: Point, event: MouseEvent): void {
    this.activeTool?.onMouseUp?.(point, event);
  }

  handleTouchStart(point: TouchPoint): void {
    this.activeTool?.onTouchStart?.(point);
  }

  handleTouchMove(point: TouchPoint): void {
    this.activeTool?.onTouchMove?.(point);
  }

  handleTouchEnd(point: TouchPoint): void {
    this.activeTool?.onTouchEnd?.(point);
  }

  handleKeyDown(event: KeyboardEvent): void {
    this.activeTool?.onKeyDown?.(event);
  }

  handleActionConfirm(): void {
    this.activeTool?.onActionConfirm?.();
  }

  handleActionCancel(): void {
    this.activeTool?.onActionCancel?.();
  }

  cancelActiveOperation(): void {
    this.activeTool?.cancel();
  }

  isDrawing(): boolean {
    return this.activeTool?.isDrawing() ?? false;
  }

  on(event: ToolEventType, callback: ToolEventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  private emit(event: ToolEventType, tool: ITool): void {
    this.listeners.get(event)?.forEach((cb) => cb(tool));
  }
}
