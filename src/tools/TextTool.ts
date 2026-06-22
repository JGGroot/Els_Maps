import { Textbox, Point, Circle } from 'fabric';
import type { FabricObject } from 'fabric';
import { ToolType } from '@/types';
import type { TouchPoint } from '@/types';
import { BaseTool } from './BaseTool';
import { LAYOUT } from '@/constants';

export class TextTool extends BaseTool {
  type = ToolType.TEXT;
  name = 'Text';
  icon = 'abc';

  private activeText: Textbox | null = null;
  private placementIndicator: Circle | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  protected setupEventListeners(): void {
    if (!this.canvas) return;

    this.canvas.selection = false;
    this.canvas.skipTargetFind = true;
    this.canvas.forEachObject((obj) => {
      obj.selectable = false;
      obj.evented = false;
    });

    this.keydownHandler = (e: KeyboardEvent) => this.onKeyDown(e);
    window.addEventListener('keydown', this.keydownHandler);
  }

  protected cleanupEventListeners(): void {
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }

    if (this.canvas) {
      this.canvas.selection = true;
      this.canvas.skipTargetFind = false;
      this.canvas.forEachObject((obj) => {
        obj.selectable = true;
        obj.evented = true;
      });
    }
  }

  onMouseDown(point: Point, event: MouseEvent): void {
    if (event.button === 2) {
      this.finishEditing();
      return;
    }

    // Clicking an existing text box edits it instead of stacking a new one.
    const existing = this.findTextboxAt(point);
    if (existing) {
      // A click inside the box already being edited just repositions the caret,
      // which Fabric handles natively — don't restart the edit session.
      if (existing === this.activeText && existing.isEditing) return;
      this.editExisting(existing, event);
      return;
    }

    this.placeText(point);
  }

  onMouseMove(point: Point, _event: MouseEvent): void {
    if (!this.drawing) {
      this.updatePlacementIndicator(point);
    }
  }

  onMouseUp(_point: Point, _event: MouseEvent): void {
    // Text is placed on mousedown
  }

  onTouchStart(point: TouchPoint): void {
    const fabricPoint = new Point(point.x, point.y);

    const existing = this.findTextboxAt(fabricPoint);
    if (existing) {
      if (!(existing === this.activeText && existing.isEditing)) {
        this.editExisting(existing);
      }
    } else {
      this.placeText(fabricPoint);
    }

    if (this.isMobile) {
      this.context?.updateReticle(point.x, point.y - LAYOUT.reticleOffset, true);
    }
  }

  onTouchMove(point: TouchPoint): void {
    if (this.isMobile) {
      this.context?.updateReticle(point.x, point.y - LAYOUT.reticleOffset, true);
    }
  }

  onTouchEnd(point: TouchPoint): void {
    if (this.isMobile) {
      this.context?.updateReticle(0, 0, false);
    }
    void point;
  }

  onKeyDown(event: KeyboardEvent): void {
    // Escape commits the text box, keeping whatever was typed (empty boxes are
    // discarded by finishEditing). Enter is intentionally left to Fabric so it
    // inserts a newline, as expected in a multi-line rich text box.
    if (event.key === 'Escape') {
      this.finishEditing();
    }
  }

  onActionConfirm(): void {
    this.finishEditing();
  }

  onActionCancel(): void {
    this.cancelEditing();
  }

  private placeText(point: Point): void {
    if (!this.canvas) return;

    // If already editing text, finish that first
    if (this.activeText && this.activeText.isEditing) {
      this.finishEditing();
    }

    this.clearPlacementIndicator();

    // Calculate font size based on stroke width (scaled for readability)
    const fontSize = Math.max(16, (this.config?.strokeWidth ?? 2) * 8);

    // Default box width scales with font size so the caret has room to breathe.
    const width = Math.max(200, fontSize * 12);

    // Create new Textbox (rich, resizable, word-wrapping editable text)
    const text = new Textbox('', {
      left: point.x,
      top: point.y,
      width,
      fontFamily: this.config?.fontFamily ?? 'IBM Plex Sans',
      fontSize: fontSize,
      fill: this.config?.strokeColor ?? '#ffffff',
      stroke: 'transparent',
      strokeWidth: 0,
      textAlign: 'left',
      selectable: true,
      evented: true,
      originX: 'left',
      originY: 'top',
      cursorColor: this.config?.strokeColor ?? '#ffffff',
      cursorWidth: 2,
      editingBorderColor: '#4a9eff',
      padding: 5
    });

    this.activeText = text;
    this.canvas.add(text);
    this.drawing = true;

    if (this.isMobile) {
      this.context?.showActionButton('both');
    }

    // Enable canvas interactions for text editing
    this.canvas.selection = true;
    this.canvas.skipTargetFind = false;
    text.selectable = true;
    text.evented = true;

    // Set as active object and enter editing mode
    this.canvas.setActiveObject(text);
    text.enterEditing();
    text.selectAll();

    this.canvas.requestRenderAll();
  }

  /** Topmost editable text box under the given scene point, if any. */
  private findTextboxAt(point: Point): Textbox | null {
    if (!this.canvas) return null;

    const objects = this.canvas.getObjects();
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (!(obj instanceof Textbox)) continue;
      if ((obj as any).isHelper) continue;
      obj.setCoords();
      if (obj.containsPoint(point)) return obj;
    }
    return null;
  }

  /** Enter editing on an existing text box rather than creating a new one. */
  private editExisting(textbox: Textbox, event?: MouseEvent): void {
    if (!this.canvas) return;

    // Commit any other box currently being edited first.
    if (this.activeText && this.activeText !== textbox && this.activeText.isEditing) {
      this.finishEditing();
    }

    this.clearPlacementIndicator();

    this.activeText = textbox;
    this.drawing = true;

    // Enable canvas + this box for text editing.
    this.canvas.selection = true;
    this.canvas.skipTargetFind = false;
    textbox.selectable = true;
    textbox.evented = true;

    this.canvas.setActiveObject(textbox);
    textbox.enterEditing();

    // Drop the caret where the user clicked instead of selecting everything.
    if (event) {
      try {
        const index = textbox.getSelectionStartFromPointer(event);
        textbox.selectionStart = index;
        textbox.selectionEnd = index;
      } catch {
        // Fall back to Fabric's default caret position.
      }
    }

    if (this.isMobile) {
      this.context?.showActionButton('both');
    }

    this.canvas.requestRenderAll();
  }

  private updatePlacementIndicator(point: Point): void {
    if (!this.canvas) return;

    const zoom = this.canvas.getZoom();
    const radius = 3 / zoom;
    const strokeWidth = 1 / zoom;

    if (!this.placementIndicator) {
      this.placementIndicator = new Circle({
        radius,
        fill: this.config?.strokeColor ?? '#ffffff',
        stroke: 'transparent',
        strokeWidth,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        opacity: 0.6
      });
      (this.placementIndicator as any).isHelper = true;
      this.canvas.add(this.placementIndicator);
    }

    this.placementIndicator.set({
      left: point.x,
      top: point.y,
      radius,
      fill: this.config?.strokeColor ?? '#ffffff'
    });
    this.canvas.bringObjectToFront(this.placementIndicator);
    this.canvas.requestRenderAll();
  }

  private clearPlacementIndicator(): void {
    if (this.placementIndicator && this.canvas) {
      this.canvas.remove(this.placementIndicator);
      this.placementIndicator = null;
    }
  }

  private finishEditing(): void {
    if (!this.canvas) return;

    if (this.activeText) {
      // Exit editing mode
      if (this.activeText.isEditing) {
        this.activeText.exitEditing();
      }

      // Remove if empty
      if (!this.activeText.text || this.activeText.text.trim() === '') {
        this.canvas.remove(this.activeText);
      } else {
        // Make sure text is properly configured for selection
        this.activeText.selectable = true;
        this.activeText.evented = true;
      }

      this.activeText = null;
    }

    this.resetState();
    this.canvas.requestRenderAll();
  }

  private cancelEditing(): void {
    if (!this.canvas) return;

    if (this.activeText) {
      if (this.activeText.isEditing) {
        this.activeText.exitEditing();
      }
      this.canvas.remove(this.activeText);
      this.activeText = null;
    }

    this.clearPlacementIndicator();
    this.resetState();
  }

  private resetState(): void {
    this.drawing = false;
    this.context?.hideActionButton();
    this.context?.updateReticle(0, 0, false);

    // Re-disable object interaction for tool mode
    if (this.canvas) {
      this.canvas.selection = false;
      this.canvas.skipTargetFind = true;
      this.canvas.discardActiveObject();
      this.canvas.forEachObject((obj) => {
        // Don't disable the active text if still around
        if (obj !== this.activeText) {
          obj.selectable = false;
          obj.evented = false;
        }
      });
    }
  }

  cancel(): void {
    // Switching tools should commit the box (keeping typed content), not discard
    // it. Empty boxes are dropped by finishEditing.
    this.finishEditing();
    super.cancel();
  }

  getPreview(): FabricObject | null {
    return this.activeText;
  }
}
