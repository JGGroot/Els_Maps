import type { Point } from 'fabric';
import { ToolType } from '@/types';
import { BaseTool } from './BaseTool';

export class SelectionTool extends BaseTool {
  type = ToolType.SELECT;
  name = 'Select';
  icon = 'cursor';

  protected setupEventListeners(): void {
    if (!this.canvas) return;

    this.canvas.selection = true;
    this.canvas.forEachObject((obj) => {
      obj.selectable = true;
      obj.evented = true;
    });
  }

  protected cleanupEventListeners(): void {
    // Selection events are handled by canvas
  }

  onMouseDown(point: Point, _event: MouseEvent): void {
    // Fabric.js handles selection automatically
    void point;
  }

  onMouseMove(point: Point, _event: MouseEvent): void {
    void point;
  }

  onMouseUp(point: Point, _event: MouseEvent): void {
    void point;
  }

  onKeyDown(event: KeyboardEvent): void {
    if (!this.canvas) return;

    if (event.key === 'Delete' || event.key === 'Backspace') {
      const activeObjects = this.canvas.getActiveObjects();
      if (activeObjects.length > 0) {
        activeObjects.forEach((obj) => this.canvas!.remove(obj));
        this.canvas.discardActiveObject();
        this.canvas.requestRenderAll();
      }
    }

    if (event.key === 'Escape') {
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
    }
  }
}
