import type { FabricObject, Point } from 'fabric';
import type { ITool, ToolContext, ToolType } from '@/types';
import type { TouchPoint } from '@/types';

export abstract class BaseTool implements ITool {
  abstract type: ToolType;
  abstract name: string;
  abstract icon: string;

  protected context: ToolContext | null = null;
  protected drawing: boolean = false;

  activate(context: ToolContext): void {
    this.context = context;
    this.setupEventListeners();
  }

  deactivate(): void {
    this.cancel();
    this.cleanupEventListeners();
    this.context = null;
  }

  protected abstract setupEventListeners(): void;
  protected abstract cleanupEventListeners(): void;

  onMouseDown?(point: Point, event: MouseEvent): void;
  onMouseMove?(point: Point, event: MouseEvent): void;
  onMouseUp?(point: Point, event: MouseEvent): void;

  onTouchStart?(point: TouchPoint): void;
  onTouchMove?(point: TouchPoint): void;
  onTouchEnd?(point: TouchPoint): void;

  onKeyDown?(event: KeyboardEvent): void;

  onActionConfirm?(): void;
  onActionCancel?(): void;

  isDrawing(): boolean {
    return this.drawing;
  }

  getPreview(): FabricObject | null {
    return null;
  }

  cancel(): void {
    this.drawing = false;
    this.context?.hideActionButton();
    this.context?.updateReticle(0, 0, false);
  }

  protected get canvas() {
    return this.context?.canvas ?? null;
  }

  protected get isMobile() {
    return this.context?.isMobile ?? false;
  }

  protected get config() {
    return this.context?.config;
  }
}
