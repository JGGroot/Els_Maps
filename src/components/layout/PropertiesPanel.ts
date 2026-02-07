import type { FabricObject } from 'fabric';
import { LAYOUT } from '@/constants';

export interface PropertiesPanelCallbacks {
  onStrokeColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onImageLockChange: (locked: boolean) => void;
}

export class PropertiesPanel {
  private element: HTMLElement;
  private contentEl: HTMLElement;
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

    parent.appendChild(this.element);
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
    const isLocked = Boolean(
      selectedObject.lockMovementX ||
      selectedObject.lockMovementY ||
      selectedObject.lockScalingX ||
      selectedObject.lockScalingY ||
      selectedObject.lockRotation
    );

    this.contentEl.innerHTML = `
      <div class="space-y-4">
        <div>
          <label class="block text-sm text-textMuted mb-2">Stroke Color</label>
          <input type="color" value="${stroke}" class="w-full h-10 rounded cursor-pointer bg-charcoal border border-border" id="stroke-color"/>
        </div>
        <div>
          <label class="block text-sm text-textMuted mb-2">Stroke Width</label>
          <input type="range" min="1" max="20" value="${strokeWidth}" class="w-full" id="stroke-width"/>
          <span class="text-sm text-white">${strokeWidth}px</span>
        </div>
        ${
          isImage
            ? `
        <div class="flex items-center gap-2">
          <input type="checkbox" id="image-lock" ${isLocked ? 'checked' : ''}/>
          <label for="image-lock" class="text-sm text-textMuted">Lock Image</label>
        </div>
        `
            : ''
        }
      </div>
    `;

    const colorInput = this.contentEl.querySelector('#stroke-color') as HTMLInputElement;
    const widthInput = this.contentEl.querySelector('#stroke-width') as HTMLInputElement;

    colorInput?.addEventListener('input', (e) => {
      this.callbacks.onStrokeColorChange((e.target as HTMLInputElement).value);
    });

    widthInput?.addEventListener('input', (e) => {
      this.callbacks.onStrokeWidthChange(Number((e.target as HTMLInputElement).value));
    });

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
