import type { FabricObject } from 'fabric';
import { LAYOUT } from '@/constants';

export interface PropertiesPanelCallbacks {
  onStrokeColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onFillColorChange: (color: string) => void;
  onFontSizeChange: (size: number) => void;
  onImageLockChange: (locked: boolean) => void;
}

export class PropertiesPanel {
  private element: HTMLElement;
  private contentEl: HTMLElement;
  private shortcutsEl: HTMLElement;
  private callbacks: PropertiesPanelCallbacks;

  constructor(parent: HTMLElement, callbacks: PropertiesPanelCallbacks) {
    this.callbacks = callbacks;

    this.element = document.createElement('aside');
    this.element.className = 'fixed right-0 top-0 h-full bg-surface border-l border-border z-sidebar hidden md:flex flex-col';
    this.element.style.width = `${LAYOUT.sidebarWidth}px`;

    const header = document.createElement('div');
    header.className = 'p-4 border-b border-border';
    header.innerHTML = `<h2 class="text-lg font-semibold text-white">Properties</h2>`;
    this.element.appendChild(header);

    this.contentEl = document.createElement('div');
    this.contentEl.className = 'p-4 flex-1 overflow-y-auto';
    this.updateContent(null);
    this.element.appendChild(this.contentEl);

    // Add shortcuts section at the bottom
    this.shortcutsEl = this.createShortcutsSection();
    this.element.appendChild(this.shortcutsEl);

    parent.appendChild(this.element);
  }

  private createShortcutsSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'p-4 border-t border-border mt-auto';

    const label = document.createElement('h2');
    label.className = 'text-sm text-textMuted mb-3';
    label.textContent = 'Shortcuts';
    section.appendChild(label);

    const shortcuts = [
      { key: 'Space + Drag', action: 'Pan canvas' },
      { key: 'Scroll', action: 'Zoom' },
      { key: 'Ctrl+Z', action: 'Undo' },
      { key: 'Ctrl+Shift+Z', action: 'Redo' },
      { key: 'Ctrl+V', action: 'Paste image' },
      { key: 'Delete', action: 'Delete selected' },
      { key: 'Escape', action: 'Cancel / Deselect' },
      { key: 'Enter', action: 'Finish drawing' },
      { key: 'Right-click', action: 'Finish drawing' },
    ];

    const list = document.createElement('div');
    list.className = 'space-y-1 text-xs';

    shortcuts.forEach(({ key, action }) => {
      const row = document.createElement('div');
      row.className = 'flex justify-between items-center';

      const keySpan = document.createElement('span');
      keySpan.className = 'text-white font-mono bg-charcoal px-1 rounded';
      keySpan.textContent = key;

      const actionSpan = document.createElement('span');
      actionSpan.className = 'text-textMuted';
      actionSpan.textContent = action;

      row.appendChild(keySpan);
      row.appendChild(actionSpan);
      list.appendChild(row);
    });

    section.appendChild(list);
    return section;
  }

  updateContent(selectedObject: FabricObject | null): void {
    if (!selectedObject) {
      this.contentEl.innerHTML = `
        <p class="text-textMuted text-sm">Select an object to view properties</p>
      `;
      return;
    }

    const stroke = (selectedObject.stroke as string) || '#ffffff';
    const strokeWidth = selectedObject.strokeWidth || 2;
    const isImage = selectedObject.type === 'image';
    const isText = selectedObject.type === 'i-text' || selectedObject.type === 'text';
    const isLocked = Boolean(
      selectedObject.lockMovementX ||
      selectedObject.lockMovementY ||
      selectedObject.lockScalingX ||
      selectedObject.lockScalingY ||
      selectedObject.lockRotation
    );

    // For text objects, use fill instead of stroke
    const textColor = isText ? ((selectedObject.fill as string) || '#ffffff') : '';
    const fontSize = isText ? ((selectedObject as any).fontSize || 16) : 0;

    let html = '<div class="space-y-4">';

    if (isText) {
      // Text-specific properties
      html += `
        <div>
          <label class="block text-sm text-textMuted mb-2">Text Color</label>
          <input type="color" value="${textColor}" class="w-full h-10 rounded cursor-pointer bg-charcoal border border-border" id="fill-color"/>
        </div>
        <div>
          <label class="block text-sm text-textMuted mb-2">Font Size</label>
          <input type="range" min="8" max="120" value="${fontSize}" class="w-full" id="font-size"/>
          <span class="text-sm text-white" id="font-size-value">${fontSize}px</span>
        </div>
      `;
    } else if (!isImage) {
      // Shape properties (stroke)
      html += `
        <div>
          <label class="block text-sm text-textMuted mb-2">Stroke Color</label>
          <input type="color" value="${stroke}" class="w-full h-10 rounded cursor-pointer bg-charcoal border border-border" id="stroke-color"/>
        </div>
        <div>
          <label class="block text-sm text-textMuted mb-2">Stroke Width</label>
          <input type="range" min="1" max="20" value="${strokeWidth}" class="w-full" id="stroke-width"/>
          <span class="text-sm text-white">${strokeWidth}px</span>
        </div>
      `;
    }

    if (isImage) {
      html += `
        <div class="flex items-center gap-2">
          <input type="checkbox" id="image-lock" ${isLocked ? 'checked' : ''}/>
          <label for="image-lock" class="text-sm text-textMuted">Lock Image</label>
        </div>
      `;
    }

    html += '</div>';
    this.contentEl.innerHTML = html;

    // Attach event listeners
    if (isText) {
      const fillInput = this.contentEl.querySelector('#fill-color') as HTMLInputElement;
      const fontSizeInput = this.contentEl.querySelector('#font-size') as HTMLInputElement;
      const fontSizeValue = this.contentEl.querySelector('#font-size-value') as HTMLSpanElement;

      fillInput?.addEventListener('input', (e) => {
        this.callbacks.onFillColorChange((e.target as HTMLInputElement).value);
      });

      fontSizeInput?.addEventListener('input', (e) => {
        const size = Number((e.target as HTMLInputElement).value);
        this.callbacks.onFontSizeChange(size);
        if (fontSizeValue) fontSizeValue.textContent = `${size}px`;
      });
    } else if (!isImage) {
      const colorInput = this.contentEl.querySelector('#stroke-color') as HTMLInputElement;
      const widthInput = this.contentEl.querySelector('#stroke-width') as HTMLInputElement;

      colorInput?.addEventListener('input', (e) => {
        this.callbacks.onStrokeColorChange((e.target as HTMLInputElement).value);
      });

      widthInput?.addEventListener('input', (e) => {
        this.callbacks.onStrokeWidthChange(Number((e.target as HTMLInputElement).value));
      });
    }

    const lockInput = this.contentEl.querySelector('#image-lock') as HTMLInputElement | null;
    lockInput?.addEventListener('change', (e) => {
      this.callbacks.onImageLockChange((e.target as HTMLInputElement).checked);
    });
  }

  getElement(): HTMLElement {
    return this.element;
  }

  destroy(): void {
    this.element.remove();
  }
}
