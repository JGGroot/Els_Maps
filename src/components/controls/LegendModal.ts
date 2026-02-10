import type { DetectedColor } from '@/utils/colorDetector';

export interface LegendItem {
  id: string;
  color: string;
  label: string;
}

export interface LegendConfig {
  items: LegendItem[];
  fontSize: number;
  fontFamily: string;
  borderWidth: number;
  borderColor: string;
  backgroundOpacity: number; // 0-100
  title: string;
  showTitle: boolean;
}

export interface LegendModalResult {
  confirmed: boolean;
  config: LegendConfig;
}

const DEFAULT_CONFIG: LegendConfig = {
  items: [],
  fontSize: 14,
  fontFamily: 'IBM Plex Sans',
  borderWidth: 2,
  borderColor: '#ffffff',
  backgroundOpacity: 70,
  title: 'Legend',
  showTitle: true
};

const AVAILABLE_FONTS = [
  'IBM Plex Sans',
  'Arial',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Comic Sans MS'
];

export class LegendModal {
  private overlay: HTMLDivElement;
  private resolve: ((result: LegendModalResult) => void) | null = null;
  private config: LegendConfig = { ...DEFAULT_CONFIG };
  private savedConfig: LegendConfig | null = null;
  private itemsContainer: HTMLElement | null = null;
  private draggedItem: HTMLElement | null = null;
  private draggedIndex: number = -1;

  constructor(parent: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'app-modal-overlay legend-modal-overlay';
    this.overlay.setAttribute('aria-hidden', 'true');

    this.overlay.innerHTML = `
      <div class="app-modal-card legend-modal-card" role="dialog" aria-modal="true">
        <div class="app-modal-header">
          <h3 class="app-modal-title">Create Legend</h3>
        </div>
        <div class="app-modal-body legend-modal-body">
          <div class="legend-section">
            <div class="legend-section-header">
              <label class="legend-label">Title</label>
              <label class="legend-checkbox-label">
                <input type="checkbox" class="modern-checkbox legend-show-title" checked />
                <span>Show</span>
              </label>
            </div>
            <input type="text" class="app-modal-input legend-title-input" value="Legend" placeholder="Legend title" />
          </div>

          <div class="legend-section">
            <label class="legend-label">Colors (drag to reorder)</label>
            <div class="legend-items-container"></div>
            <p class="legend-empty-message" style="display: none;">No colors detected on canvas. Draw something first!</p>
          </div>

          <div class="legend-section legend-settings-grid">
            <div class="legend-setting">
              <label class="legend-label">Font Size</label>
              <div class="legend-slider-row">
                <input type="range" class="legend-font-size-slider" min="10" max="32" value="14" />
                <span class="legend-font-size-value">14px</span>
              </div>
            </div>

            <div class="legend-setting">
              <label class="legend-label">Font</label>
              <select class="app-modal-input legend-font-select"></select>
            </div>

            <div class="legend-setting">
              <label class="legend-label">Border Width</label>
              <div class="legend-slider-row">
                <input type="range" class="legend-border-width-slider" min="0" max="8" value="2" />
                <span class="legend-border-width-value">2px</span>
              </div>
            </div>

            <div class="legend-setting">
              <label class="legend-label">Border Color</label>
              <input type="color" class="legend-border-color" value="#ffffff" />
            </div>

            <div class="legend-setting legend-setting-full">
              <label class="legend-label">Background Opacity</label>
              <div class="legend-slider-row">
                <input type="range" class="legend-bg-opacity-slider" min="0" max="100" value="70" />
                <span class="legend-bg-opacity-value">70%</span>
              </div>
            </div>
          </div>

          <div class="legend-preview-section">
            <label class="legend-label">Preview</label>
            <div class="legend-preview-container">
              <div class="legend-preview"></div>
            </div>
          </div>
        </div>
        <div class="app-modal-actions">
          <button class="app-modal-btn app-modal-btn-ghost legend-cancel-btn" type="button">Cancel</button>
          <button class="app-modal-btn app-modal-btn-primary legend-ok-btn" type="button">Place on Canvas</button>
        </div>
      </div>
    `;

    parent.appendChild(this.overlay);
    this.setupElements();
    this.setupEventListeners();
    this.injectStyles();
  }

  private setupElements(): void {
    // Populate font select
    const fontSelect = this.overlay.querySelector('.legend-font-select') as HTMLSelectElement;
    AVAILABLE_FONTS.forEach(font => {
      const option = document.createElement('option');
      option.value = font;
      option.textContent = font;
      option.style.fontFamily = font;
      fontSelect.appendChild(option);
    });

    this.itemsContainer = this.overlay.querySelector('.legend-items-container');
  }

  private setupEventListeners(): void {
    // Cancel button
    const cancelBtn = this.overlay.querySelector('.legend-cancel-btn');
    cancelBtn?.addEventListener('click', () => this.close(false));

    // OK button
    const okBtn = this.overlay.querySelector('.legend-ok-btn');
    okBtn?.addEventListener('click', () => this.close(true));

    // Overlay click to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close(false);
      }
    });

    // Title input
    const titleInput = this.overlay.querySelector('.legend-title-input') as HTMLInputElement;
    titleInput?.addEventListener('input', () => {
      this.config.title = titleInput.value;
      this.updatePreview();
    });

    // Show title checkbox
    const showTitleCheckbox = this.overlay.querySelector('.legend-show-title') as HTMLInputElement;
    showTitleCheckbox?.addEventListener('change', () => {
      this.config.showTitle = showTitleCheckbox.checked;
      this.updatePreview();
    });

    // Font size slider
    const fontSizeSlider = this.overlay.querySelector('.legend-font-size-slider') as HTMLInputElement;
    const fontSizeValue = this.overlay.querySelector('.legend-font-size-value') as HTMLElement;
    fontSizeSlider?.addEventListener('input', () => {
      this.config.fontSize = parseInt(fontSizeSlider.value);
      fontSizeValue.textContent = `${fontSizeSlider.value}px`;
      this.updatePreview();
    });

    // Font select
    const fontSelect = this.overlay.querySelector('.legend-font-select') as HTMLSelectElement;
    fontSelect?.addEventListener('change', () => {
      this.config.fontFamily = fontSelect.value;
      this.updatePreview();
    });

    // Border width slider
    const borderWidthSlider = this.overlay.querySelector('.legend-border-width-slider') as HTMLInputElement;
    const borderWidthValue = this.overlay.querySelector('.legend-border-width-value') as HTMLElement;
    borderWidthSlider?.addEventListener('input', () => {
      this.config.borderWidth = parseInt(borderWidthSlider.value);
      borderWidthValue.textContent = `${borderWidthSlider.value}px`;
      this.updatePreview();
    });

    // Border color
    const borderColor = this.overlay.querySelector('.legend-border-color') as HTMLInputElement;
    borderColor?.addEventListener('input', () => {
      this.config.borderColor = borderColor.value;
      this.updatePreview();
    });

    // Background opacity slider
    const bgOpacitySlider = this.overlay.querySelector('.legend-bg-opacity-slider') as HTMLInputElement;
    const bgOpacityValue = this.overlay.querySelector('.legend-bg-opacity-value') as HTMLElement;
    bgOpacitySlider?.addEventListener('input', () => {
      this.config.backgroundOpacity = parseInt(bgOpacitySlider.value);
      bgOpacityValue.textContent = `${bgOpacitySlider.value}%`;
      this.updatePreview();
    });
  }

  async open(detectedColors: DetectedColor[]): Promise<LegendModalResult> {
    if (this.resolve) {
      this.close(false);
    }

    // Initialize config with detected colors or restore saved config
    if (this.savedConfig) {
      this.config = JSON.parse(JSON.stringify(this.savedConfig));
      // Update items to match detected colors but preserve labels from saved config
      this.mergeDetectedColors(detectedColors);
    } else {
      this.config = {
        ...DEFAULT_CONFIG,
        items: detectedColors.map((c, i) => ({
          id: `color-${i}-${Date.now()}`,
          color: c.color,
          label: c.label
        }))
      };
    }

    this.updateUIFromConfig();
    this.renderItems();
    this.updatePreview();

    // Show empty message if no colors
    const emptyMsg = this.overlay.querySelector('.legend-empty-message') as HTMLElement;
    const okBtn = this.overlay.querySelector('.legend-ok-btn') as HTMLButtonElement;
    if (this.config.items.length === 0) {
      emptyMsg.style.display = 'block';
      okBtn.disabled = true;
      okBtn.style.opacity = '0.5';
    } else {
      emptyMsg.style.display = 'none';
      okBtn.disabled = false;
      okBtn.style.opacity = '1';
    }

    this.overlay.classList.add('is-open');
    this.overlay.setAttribute('aria-hidden', 'false');

    return new Promise<LegendModalResult>((resolve) => {
      this.resolve = resolve;
      window.addEventListener('keydown', this.handleKeydown);
    });
  }

  private mergeDetectedColors(detectedColors: DetectedColor[]): void {
    const existingByColor = new Map(this.config.items.map(item => [item.color, item]));
    const newItems: LegendItem[] = [];

    // Keep existing items that are still in detected colors (preserve order and labels)
    for (const item of this.config.items) {
      if (detectedColors.some(c => c.color === item.color)) {
        newItems.push(item);
      }
    }

    // Add new colors that weren't in saved config
    for (const detected of detectedColors) {
      if (!existingByColor.has(detected.color)) {
        newItems.push({
          id: `color-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          color: detected.color,
          label: detected.label
        });
      }
    }

    this.config.items = newItems;
  }

  private updateUIFromConfig(): void {
    const titleInput = this.overlay.querySelector('.legend-title-input') as HTMLInputElement;
    const showTitleCheckbox = this.overlay.querySelector('.legend-show-title') as HTMLInputElement;
    const fontSizeSlider = this.overlay.querySelector('.legend-font-size-slider') as HTMLInputElement;
    const fontSizeValue = this.overlay.querySelector('.legend-font-size-value') as HTMLElement;
    const fontSelect = this.overlay.querySelector('.legend-font-select') as HTMLSelectElement;
    const borderWidthSlider = this.overlay.querySelector('.legend-border-width-slider') as HTMLInputElement;
    const borderWidthValue = this.overlay.querySelector('.legend-border-width-value') as HTMLElement;
    const borderColor = this.overlay.querySelector('.legend-border-color') as HTMLInputElement;
    const bgOpacitySlider = this.overlay.querySelector('.legend-bg-opacity-slider') as HTMLInputElement;
    const bgOpacityValue = this.overlay.querySelector('.legend-bg-opacity-value') as HTMLElement;

    titleInput.value = this.config.title;
    showTitleCheckbox.checked = this.config.showTitle;
    fontSizeSlider.value = String(this.config.fontSize);
    fontSizeValue.textContent = `${this.config.fontSize}px`;
    fontSelect.value = this.config.fontFamily;
    borderWidthSlider.value = String(this.config.borderWidth);
    borderWidthValue.textContent = `${this.config.borderWidth}px`;
    borderColor.value = this.config.borderColor;
    bgOpacitySlider.value = String(this.config.backgroundOpacity);
    bgOpacityValue.textContent = `${this.config.backgroundOpacity}%`;
  }

  private renderItems(): void {
    if (!this.itemsContainer) return;

    this.itemsContainer.innerHTML = '';

    this.config.items.forEach((item, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'legend-item';
      itemEl.dataset.index = String(index);
      itemEl.draggable = true;

      itemEl.innerHTML = `
        <div class="legend-item-drag-handle">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="5" r="1.5"/>
            <circle cx="15" cy="5" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/>
            <circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="19" r="1.5"/>
            <circle cx="15" cy="19" r="1.5"/>
          </svg>
        </div>
        <div class="legend-item-swatch" style="background-color: ${item.color}"></div>
        <input type="text" class="legend-item-label" value="${this.escapeHtml(item.label)}" placeholder="Label" />
        <button class="legend-item-remove" title="Remove">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;

      // Label input
      const labelInput = itemEl.querySelector('.legend-item-label') as HTMLInputElement;
      labelInput.addEventListener('input', () => {
        this.config.items[index].label = labelInput.value;
        this.updatePreview();
      });

      // Remove button
      const removeBtn = itemEl.querySelector('.legend-item-remove');
      removeBtn?.addEventListener('click', () => {
        this.config.items.splice(index, 1);
        this.renderItems();
        this.updatePreview();
      });

      // Drag events
      itemEl.addEventListener('dragstart', (e) => this.handleDragStart(e, index));
      itemEl.addEventListener('dragover', (e) => this.handleDragOver(e, index));
      itemEl.addEventListener('dragend', () => this.handleDragEnd());
      itemEl.addEventListener('drop', (e) => this.handleDrop(e, index));

      this.itemsContainer!.appendChild(itemEl);
    });
  }

  private handleDragStart(e: DragEvent, index: number): void {
    this.draggedItem = e.target as HTMLElement;
    this.draggedIndex = index;
    this.draggedItem.classList.add('is-dragging');
    e.dataTransfer!.effectAllowed = 'move';
  }

  private handleDragOver(e: DragEvent, index: number): void {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';

    const items = this.itemsContainer?.querySelectorAll('.legend-item');
    items?.forEach((item, i) => {
      item.classList.remove('drag-over-top', 'drag-over-bottom');
      if (i === index && this.draggedIndex !== index) {
        if (this.draggedIndex < index) {
          item.classList.add('drag-over-bottom');
        } else {
          item.classList.add('drag-over-top');
        }
      }
    });
  }

  private handleDrop(e: DragEvent, dropIndex: number): void {
    e.preventDefault();
    if (this.draggedIndex === dropIndex) return;

    const items = [...this.config.items];
    const [draggedItem] = items.splice(this.draggedIndex, 1);
    items.splice(dropIndex, 0, draggedItem);
    this.config.items = items;

    this.renderItems();
    this.updatePreview();
  }

  private handleDragEnd(): void {
    this.draggedItem?.classList.remove('is-dragging');
    this.itemsContainer?.querySelectorAll('.legend-item').forEach(item => {
      item.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    this.draggedItem = null;
    this.draggedIndex = -1;
  }

  private updatePreview(): void {
    const preview = this.overlay.querySelector('.legend-preview') as HTMLElement;
    if (!preview) return;

    const bgOpacity = this.config.backgroundOpacity / 100;
    const bgColor = `rgba(0, 0, 0, ${bgOpacity})`;

    let html = `<div class="legend-preview-inner" style="
      font-family: ${this.config.fontFamily};
      font-size: ${this.config.fontSize}px;
      border: ${this.config.borderWidth}px solid ${this.config.borderColor};
      background: ${bgColor};
      padding: 12px;
      display: inline-block;
    ">`;

    if (this.config.showTitle && this.config.title) {
      html += `<div style="font-weight: 600; margin-bottom: 8px; color: ${this.config.borderColor};">${this.escapeHtml(this.config.title)}</div>`;
    }

    this.config.items.forEach(item => {
      html += `
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
          <div style="width: 16px; height: 16px; background: ${item.color}; flex-shrink: 0;"></div>
          <span style="color: ${this.config.borderColor};">${this.escapeHtml(item.label)}</span>
        </div>
      `;
    });

    html += '</div>';
    preview.innerHTML = html;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private handleKeydown = (e: KeyboardEvent): void => {
    if (!this.resolve) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close(false);
    }
  };

  private close(confirmed: boolean): void {
    if (!this.resolve) return;

    // Save config for next time
    if (confirmed) {
      this.savedConfig = JSON.parse(JSON.stringify(this.config));
    }

    const resolve = this.resolve;
    this.resolve = null;

    window.removeEventListener('keydown', this.handleKeydown);
    this.overlay.classList.remove('is-open');
    this.overlay.setAttribute('aria-hidden', 'true');

    resolve({
      confirmed,
      config: JSON.parse(JSON.stringify(this.config))
    });
  }

  private injectStyles(): void {
    if (document.getElementById('legend-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'legend-modal-styles';
    style.textContent = `
      .legend-modal-card {
        width: min(520px, 100%) !important;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
      }

      .legend-modal-body {
        overflow-y: auto;
        flex: 1;
        min-height: 0;
      }

      .legend-section {
        margin-bottom: 16px;
      }

      .legend-section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
      }

      .legend-label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: var(--color-muted);
        margin-bottom: 6px;
      }

      .legend-section-header .legend-label {
        margin-bottom: 0;
      }

      .legend-checkbox-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--color-muted);
        cursor: pointer;
      }

      .legend-checkbox-label .modern-checkbox {
        width: 16px;
        height: 16px;
      }

      .legend-items-container {
        max-height: 180px;
        overflow-y: auto;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background: var(--color-bg);
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-bottom: 1px solid var(--color-border);
        background: var(--color-bg);
        transition: background 0.15s ease;
      }

      .legend-item:last-child {
        border-bottom: none;
      }

      .legend-item.is-dragging {
        opacity: 0.5;
      }

      .legend-item.drag-over-top {
        box-shadow: inset 0 2px 0 var(--color-accent);
      }

      .legend-item.drag-over-bottom {
        box-shadow: inset 0 -2px 0 var(--color-accent);
      }

      .legend-item-drag-handle {
        cursor: grab;
        color: var(--color-muted);
        flex-shrink: 0;
      }

      .legend-item-drag-handle:active {
        cursor: grabbing;
      }

      .legend-item-swatch {
        width: 16px;
        height: 16px;
        border: 1px solid var(--color-border);
        flex-shrink: 0;
      }

      .legend-item-label {
        flex: 1;
        min-width: 0;
        padding: 6px 8px;
        border-radius: 6px;
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-foreground);
        font-size: 13px;
      }

      .legend-item-label:focus {
        outline: none;
        border-color: var(--color-accent);
      }

      .legend-item-remove {
        background: transparent;
        border: none;
        color: var(--color-muted);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: color 0.15s ease, background 0.15s ease;
      }

      .legend-item-remove:hover {
        color: #dc2626;
        background: rgba(220, 38, 38, 0.1);
      }

      .legend-settings-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .legend-setting-full {
        grid-column: span 2;
      }

      .legend-slider-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .legend-slider-row input[type="range"] {
        flex: 1;
      }

      .legend-slider-row span {
        font-size: 12px;
        color: var(--color-foreground);
        min-width: 40px;
        text-align: right;
      }

      .legend-border-color {
        width: 100%;
        height: 36px;
        border-radius: 8px;
        border: 1px solid var(--color-border);
        cursor: pointer;
        background: var(--color-bg);
      }

      .legend-preview-section {
        margin-top: 16px;
      }

      .legend-preview-container {
        background: repeating-linear-gradient(
          45deg,
          var(--color-bg-dark),
          var(--color-bg-dark) 10px,
          var(--color-bg) 10px,
          var(--color-bg) 20px
        );
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 16px;
        display: flex;
        justify-content: center;
      }

      .legend-preview-inner {
        color: #ffffff;
      }

      .legend-empty-message {
        text-align: center;
        padding: 20px;
        color: var(--color-muted);
        font-size: 13px;
      }
    `;
    document.head.appendChild(style);
  }

  destroy(): void {
    this.overlay.remove();
    const styles = document.getElementById('legend-modal-styles');
    styles?.remove();
  }
}
