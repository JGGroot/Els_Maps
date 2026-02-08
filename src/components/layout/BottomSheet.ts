import type { FabricObject } from 'fabric';
import { LAYOUT } from '@/constants';

export interface BottomSheetCallbacks {
  onStrokeColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onFillColorChange: (color: string) => void;
  onFontSizeChange: (size: number) => void;
  onImageLockChange: (locked: boolean) => void;
  onLockCanvasToImage: () => void;
}

export class BottomSheet {
  private element: HTMLElement;
  private handleEl: HTMLElement;
  private contentEl: HTMLElement;
  private callbacks: BottomSheetCallbacks;
  private isOpen: boolean = false;
  private startY: number = 0;
  private currentY: number = 0;

  constructor(parent: HTMLElement, callbacks: BottomSheetCallbacks) {
    this.callbacks = callbacks;

    this.element = document.createElement('div');
    this.element.className = 'bottom-sheet fixed left-0 right-0 bg-surface border-t border-border z-sheet md:hidden';
    this.element.style.cssText = `
      bottom: ${LAYOUT.toolbarHeight}px;
      height: ${LAYOUT.bottomSheetMaxHeight}px;
      transform: translateY(100%);
      border-radius: 16px 16px 0 0;
    `;

    this.handleEl = document.createElement('div');
    this.handleEl.className = 'flex justify-center py-3 cursor-grab active:cursor-grabbing';
    this.handleEl.innerHTML = `<div class="w-10 h-1 bg-border rounded-full"></div>`;
    this.element.appendChild(this.handleEl);

    this.contentEl = document.createElement('div');
    this.contentEl.className = 'p-4 overflow-y-auto';
    this.contentEl.style.height = `${LAYOUT.bottomSheetMaxHeight - 40}px`;
    this.element.appendChild(this.contentEl);

    this.bindEvents();
    parent.appendChild(this.element);
  }

  private bindEvents(): void {
    this.handleEl.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.handleEl.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.handleEl.addEventListener('touchend', this.onTouchEnd, { passive: false });
  }

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    this.startY = e.touches[0].clientY;
    this.currentY = this.startY;
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    this.currentY = e.touches[0].clientY;
    const deltaY = this.currentY - this.startY;

    if (this.isOpen) {
      const newTransform = Math.max(0, deltaY);
      this.element.style.transform = `translateY(${newTransform}px)`;
    } else {
      const newTransform = Math.min(0, deltaY);
      this.element.style.transform = `translateY(calc(100% + ${newTransform}px))`;
    }
  };

  private onTouchEnd = (): void => {
    const deltaY = this.currentY - this.startY;
    const threshold = 50;

    if (this.isOpen && deltaY > threshold) {
      this.close();
    } else if (!this.isOpen && deltaY < -threshold) {
      this.open();
    } else {
      this.element.style.transform = this.isOpen ? 'translateY(0)' : 'translateY(100%)';
    }
  };

  open(): void {
    this.isOpen = true;
    this.element.style.transform = 'translateY(0)';
  }

  close(): void {
    this.isOpen = false;
    this.element.style.transform = 'translateY(100%)';
  }

  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  updateContent(selectedObject: FabricObject | null): void {
    if (!selectedObject) {
      this.contentEl.innerHTML = `
        <p class="text-textMuted text-sm text-center">Select an object to view properties</p>
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
          <input type="color" value="${textColor}" class="w-full h-12 rounded cursor-pointer bg-charcoal border border-border" id="sheet-fill-color"/>
        </div>
        <div>
          <label class="block text-sm text-textMuted mb-2">Font Size: <span id="font-size-value">${fontSize}px</span></label>
          <input type="range" min="8" max="120" value="${fontSize}" class="w-full h-8" id="sheet-font-size"/>
        </div>
      `;
    } else if (!isImage) {
      // Shape properties (stroke)
      html += `
        <div>
          <label class="block text-sm text-textMuted mb-2">Stroke Color</label>
          <input type="color" value="${stroke}" class="w-full h-12 rounded cursor-pointer bg-charcoal border border-border" id="sheet-stroke-color"/>
        </div>
        <div>
          <label class="block text-sm text-textMuted mb-2">Stroke Width: <span id="width-value">${strokeWidth}px</span></label>
          <input type="range" min="1" max="20" value="${strokeWidth}" class="w-full h-8" id="sheet-stroke-width"/>
        </div>
      `;
    }

    if (isImage) {
      html += `
        <div class="flex items-center gap-2">
          <input type="checkbox" id="sheet-image-lock" ${isLocked ? 'checked' : ''}/>
          <label for="sheet-image-lock" class="text-sm text-textMuted">Lock Image</label>
        </div>
        <div class="mt-3">
          <button id="sheet-lock-canvas-to-image" class="w-full px-3 py-2 bg-accent hover:bg-accent/80 rounded text-sm text-white transition-colors">
            Lock Canvas to Image
          </button>
          <p class="text-xs text-textMuted mt-1">Exports will crop to this image's bounds</p>
        </div>
      `;
    }

    html += '</div>';
    this.contentEl.innerHTML = html;

    // Attach event listeners
    if (isText) {
      const fillInput = this.contentEl.querySelector('#sheet-fill-color') as HTMLInputElement;
      const fontSizeInput = this.contentEl.querySelector('#sheet-font-size') as HTMLInputElement;
      const fontSizeValue = this.contentEl.querySelector('#font-size-value') as HTMLSpanElement;

      fillInput?.addEventListener('input', (e) => {
        this.callbacks.onFillColorChange((e.target as HTMLInputElement).value);
      });

      fontSizeInput?.addEventListener('input', (e) => {
        const size = Number((e.target as HTMLInputElement).value);
        if (fontSizeValue) fontSizeValue.textContent = `${size}px`;
        this.callbacks.onFontSizeChange(size);
      });
    } else if (!isImage) {
      const colorInput = this.contentEl.querySelector('#sheet-stroke-color') as HTMLInputElement;
      const widthInput = this.contentEl.querySelector('#sheet-stroke-width') as HTMLInputElement;
      const widthValue = this.contentEl.querySelector('#width-value') as HTMLSpanElement;

      colorInput?.addEventListener('input', (e) => {
        this.callbacks.onStrokeColorChange((e.target as HTMLInputElement).value);
      });

      widthInput?.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value;
        if (widthValue) widthValue.textContent = `${value}px`;
        this.callbacks.onStrokeWidthChange(Number(value));
      });
    }

    const lockInput = this.contentEl.querySelector('#sheet-image-lock') as HTMLInputElement | null;
    lockInput?.addEventListener('change', (e) => {
      this.callbacks.onImageLockChange((e.target as HTMLInputElement).checked);
    });

    const lockCanvasBtn = this.contentEl.querySelector('#sheet-lock-canvas-to-image') as HTMLButtonElement | null;
    lockCanvasBtn?.addEventListener('click', () => {
      this.callbacks.onLockCanvasToImage();
    });
  }

  showForSelection(obj: FabricObject): void {
    this.updateContent(obj);
    this.open();
  }

  getElement(): HTMLElement {
    return this.element;
  }

  destroy(): void {
    this.handleEl.removeEventListener('touchstart', this.onTouchStart);
    this.handleEl.removeEventListener('touchmove', this.onTouchMove);
    this.handleEl.removeEventListener('touchend', this.onTouchEnd);
    this.element.remove();
  }
}
