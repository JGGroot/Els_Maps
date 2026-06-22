import { Textbox } from 'fabric';
import type { Canvas, FabricObject } from 'fabric';

export interface RichTextToolbarCallbacks {
  /** Called after a style change is committed so the host can snapshot history. */
  onChange?: () => void;
}

interface SelectionRange {
  start: number;
  end: number;
}

const FONT_OPTIONS = [
  'IBM Plex Sans',
  'Arial',
  'Times New Roman',
  'Comic Sans MS',
  'Georgia',
  'Courier New'
];

/**
 * Floating formatting toolbar for rich-text Textbox objects. It appears while a
 * Textbox is selected or being edited and applies styles either to the active
 * character selection (inline rich text) or to the whole box when nothing is
 * selected.
 */
export class RichTextToolbar {
  private el: HTMLDivElement;
  private canvas: Canvas | null = null;
  private target: Textbox | null = null;
  private callbacks: RichTextToolbarCallbacks;
  /** Selection captured on pointer-down, before focus shifts away from the textbox. */
  private snapshot: SelectionRange | null = null;
  private disposers: Array<() => void> = [];
  private reposition = (): void => this.positionToolbar();

  constructor(parent: HTMLElement, callbacks: RichTextToolbarCallbacks = {}) {
    this.callbacks = callbacks;

    this.el = document.createElement('div');
    this.el.className = 'rt-toolbar';
    this.el.setAttribute('aria-hidden', 'true');
    this.el.innerHTML = `
      <button class="rt-btn" data-action="bold" title="Bold"><span style="font-weight:700">B</span></button>
      <button class="rt-btn" data-action="italic" title="Italic"><span style="font-style:italic">I</span></button>
      <button class="rt-btn" data-action="underline" title="Underline"><span style="text-decoration:underline">U</span></button>
      <span class="rt-sep"></span>
      <select class="rt-select" data-control="fontFamily" title="Font family">
        ${FONT_OPTIONS.map((f) => `<option value="${f}" style="font-family:'${f}'">${f}</option>`).join('')}
      </select>
      <input class="rt-size" data-control="fontSize" type="number" min="6" max="400" step="1" title="Font size" />
      <input class="rt-color" data-control="fill" type="color" title="Text color" />
      <span class="rt-sep"></span>
      <button class="rt-btn" data-action="align-left" title="Align left">L</button>
      <button class="rt-btn" data-action="align-center" title="Align center">C</button>
      <button class="rt-btn" data-action="align-right" title="Align right">R</button>
    `;

    parent.appendChild(this.el);
    this.bindControls();
  }

  attach(canvas: Canvas): void {
    this.canvas = canvas;

    const on = <T extends string>(event: T, handler: (e: any) => void): void => {
      canvas.on(event as any, handler);
      this.disposers.push(() => canvas.off(event as any, handler));
    };

    on('text:editing:entered', (e) => this.show(e.target));
    on('text:editing:exited', () => {
      this.snapshot = null;
      // Keep the toolbar open if the box stays selected, otherwise hide it.
      if (this.canvas?.getActiveObject() !== this.target) this.hide();
    });
    on('text:selection:changed', () => {
      this.captureSnapshot();
      this.syncControls();
    });
    on('selection:created', () => this.onSelectionChange());
    on('selection:updated', () => this.onSelectionChange());
    on('selection:cleared', () => this.hide());
    on('object:moving', this.reposition);
    on('object:scaling', this.reposition);
    on('object:rotating', this.reposition);
    on('mouse:wheel', this.reposition);

    window.addEventListener('resize', this.reposition);
    window.addEventListener('scroll', this.reposition, true);
  }

  destroy(): void {
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
    window.removeEventListener('resize', this.reposition);
    window.removeEventListener('scroll', this.reposition, true);
    this.el.remove();
  }

  private onSelectionChange(): void {
    const active = this.canvas?.getActiveObject();
    if (active instanceof Textbox) {
      this.show(active);
    } else {
      this.hide();
    }
  }

  private show(target: FabricObject | undefined): void {
    if (!(target instanceof Textbox)) return;
    this.target = target;
    this.el.classList.add('is-open');
    this.el.setAttribute('aria-hidden', 'false');
    this.syncControls();
    // Position after the toolbar is laid out so offsetHeight is known.
    requestAnimationFrame(this.reposition);
  }

  private hide(): void {
    if (!this.el.classList.contains('is-open')) return;
    this.target = null;
    this.snapshot = null;
    this.el.classList.remove('is-open');
    this.el.setAttribute('aria-hidden', 'true');
  }

  private bindControls(): void {
    // Snapshot the live selection before any control steals focus from the box.
    this.el.addEventListener('pointerdown', () => this.captureSnapshot(), true);

    this.el.addEventListener('mousedown', (e) => {
      const button = (e.target as HTMLElement).closest('button[data-action]');
      if (!button) return;
      // Prevent the textbox from losing focus/editing so inline selection survives.
      e.preventDefault();
      this.handleAction(button.getAttribute('data-action') ?? '');
    });

    const fontFamily = this.el.querySelector('[data-control="fontFamily"]') as HTMLSelectElement;
    const fontSize = this.el.querySelector('[data-control="fontSize"]') as HTMLInputElement;
    const fill = this.el.querySelector('[data-control="fill"]') as HTMLInputElement;

    fontFamily.addEventListener('change', () => this.applyStyle({ fontFamily: fontFamily.value }));
    fontSize.addEventListener('change', () => {
      const size = Math.min(400, Math.max(6, Number(fontSize.value) || 16));
      fontSize.value = String(size);
      this.applyStyle({ fontSize: size });
    });
    // Apply color live while dragging the picker, but only snapshot history once
    // the user commits (closes the picker) to avoid flooding the undo stack.
    fill.addEventListener('input', () => this.applyStyle({ fill: fill.value }, false));
    fill.addEventListener('change', () => this.commit());
  }

  private handleAction(action: string): void {
    switch (action) {
      case 'bold':
        this.toggleStyle('fontWeight', 'bold', 'normal');
        break;
      case 'italic':
        this.toggleStyle('fontStyle', 'italic', 'normal');
        break;
      case 'underline':
        this.toggleBooleanStyle('underline');
        break;
      case 'align-left':
        this.applyWholeBox({ textAlign: 'left' });
        break;
      case 'align-center':
        this.applyWholeBox({ textAlign: 'center' });
        break;
      case 'align-right':
        this.applyWholeBox({ textAlign: 'right' });
        break;
    }
  }

  /** Selection range to operate on: live caret if editing, else the pointer-down snapshot. */
  private getRange(): SelectionRange | null {
    const t = this.target;
    if (!t) return null;
    if (t.isEditing) {
      return { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0 };
    }
    return this.snapshot;
  }

  private captureSnapshot(): void {
    const t = this.target;
    if (!t || !t.isEditing) return;
    this.snapshot = { start: t.selectionStart ?? 0, end: t.selectionEnd ?? 0 };
  }

  private hasSelection(range: SelectionRange | null): range is SelectionRange {
    return !!range && range.end > range.start;
  }

  private toggleStyle(key: string, onValue: string, offValue: string): void {
    const current = this.readStyle(key);
    this.applyStyle({ [key]: current === onValue ? offValue : onValue });
  }

  private toggleBooleanStyle(key: string): void {
    const current = this.readStyle(key);
    this.applyStyle({ [key]: !current });
  }

  /** Read the effective value of a style for the active range (or whole box). */
  private readStyle(key: string): unknown {
    const t = this.target;
    if (!t) return undefined;
    const range = this.getRange();
    if (this.hasSelection(range)) {
      const styles = t.getSelectionStyles(range.start, range.end, true) as Array<Record<string, unknown>>;
      if (styles.length === 0) return (t as any)[key];
      const first = styles[0]?.[key];
      const allSame = styles.every((s) => s[key] === first);
      return allSame ? first : undefined;
    }
    return (t as any)[key];
  }

  private applyStyle(style: Record<string, unknown>, commit = true): void {
    const t = this.target;
    if (!t) return;
    const range = this.getRange();

    if (this.hasSelection(range)) {
      t.setSelectionStyles(style, range.start, range.end);
    } else {
      this.applyWholeBox(style, commit);
      return;
    }

    t.canvas?.requestRenderAll();
    if (commit) this.commit();
    else this.syncControls();
  }

  /** Apply to the entire box, clearing any per-character overrides so it takes effect. */
  private applyWholeBox(style: Record<string, unknown>, commit = true): void {
    const t = this.target;
    if (!t) return;
    t.set(style);
    Object.keys(style).forEach((key) => this.clearCharStyle(t, key));
    t.initDimensions?.();
    t.setCoords();
    t.canvas?.requestRenderAll();
    if (commit) this.commit();
    else this.syncControls();
  }

  private clearCharStyle(t: Textbox, key: string): void {
    const styles = (t as any).styles as Record<string, Record<string, Record<string, unknown>>> | undefined;
    if (!styles) return;
    Object.values(styles).forEach((line) => {
      Object.values(line).forEach((charStyle) => {
        if (charStyle && key in charStyle) delete charStyle[key];
      });
    });
  }

  private commit(): void {
    this.syncControls();
    this.callbacks.onChange?.();
  }

  private syncControls(): void {
    const t = this.target;
    if (!t) return;

    const setActive = (action: string, active: boolean): void => {
      const btn = this.el.querySelector(`[data-action="${action}"]`);
      btn?.classList.toggle('is-active', active);
    };

    setActive('bold', this.readStyle('fontWeight') === 'bold');
    setActive('italic', this.readStyle('fontStyle') === 'italic');
    setActive('underline', this.readStyle('underline') === true);

    const align = (t.textAlign as string) || 'left';
    setActive('align-left', align === 'left');
    setActive('align-center', align === 'center');
    setActive('align-right', align === 'right');

    const fontFamily = this.el.querySelector('[data-control="fontFamily"]') as HTMLSelectElement;
    const fontSize = this.el.querySelector('[data-control="fontSize"]') as HTMLInputElement;
    const fill = this.el.querySelector('[data-control="fill"]') as HTMLInputElement;

    const family = this.readStyle('fontFamily');
    if (typeof family === 'string') fontFamily.value = family;

    const size = this.readStyle('fontSize');
    if (typeof size === 'number') fontSize.value = String(Math.round(size));

    const color = this.readStyle('fill');
    if (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) fill.value = color;
  }

  private positionToolbar(): void {
    const t = this.target;
    const canvas = this.canvas;
    if (!t || !canvas || !this.el.classList.contains('is-open')) return;

    const canvasEl = canvas.upperCanvasEl ?? canvas.getElement();
    const canvasRect = canvasEl.getBoundingClientRect();

    // getBoundingRect() is in scene coordinates; apply the viewport transform
    // (zoom + pan) to convert it to on-screen canvas pixels.
    const bounds = t.getBoundingRect();
    const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
    const zoom = canvas.getZoom();
    const screenLeft = bounds.left * vpt[0] + bounds.top * vpt[2] + vpt[4];
    const screenTop = bounds.left * vpt[1] + bounds.top * vpt[3] + vpt[5];
    const screenHeight = bounds.height * zoom;

    const margin = 10;
    const toolbarRect = this.el.getBoundingClientRect();

    let left = canvasRect.left + screenLeft;
    let top = canvasRect.top + screenTop - toolbarRect.height - margin;

    // Drop below the box if there's no room above.
    if (top < canvasRect.top + 4) {
      top = canvasRect.top + screenTop + screenHeight + margin;
    }

    // Keep the toolbar within the viewport horizontally.
    const maxLeft = window.innerWidth - toolbarRect.width - 8;
    left = Math.max(8, Math.min(left, maxLeft));

    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }
}
