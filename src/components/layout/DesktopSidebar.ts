import { ToolType } from '@/types';
import type { ITool } from '@/types';
import { LAYOUT } from '@/constants';
import { ToolButton } from '../controls/ToolButton';
import { themeManager } from '@/utils';

// Import logos
import logoLight from '@/assets/logos/ElsMapsLogo_LightMode.png';
import logoDark from '@/assets/logos/ElsMapsLogo_DarkMode.png';

export interface FileActionCallbacks {
  onImport: () => void;
  onExportPNG: () => void;
  onExportJPG: () => void;
  onExportPDF: () => void;
  onCopyToClipboard: () => void;
}

export interface EditActionCallbacks {
  onUndo: () => void;
  onRedo: () => void;
  onClearAll: () => void;
}

export interface StrokeColorCallbacks {
  onStrokeColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
}

export interface SnapCallbacks {
  onSnapToggle: (enabled: boolean) => void;
}

export interface CanvasLockCallbacks {
  onCanvasLockToggle: (enabled: boolean) => void;
  onUnlockCanvas: () => void;
  isCanvasLocked: () => boolean;
}

export interface SettingsCallbacks {
  onSettingsOpen: () => void;
}

export class DesktopSidebar {
  private element: HTMLElement;
  private toolButtons: Map<ToolType, ToolButton> = new Map();
  private onToolSelect: (type: ToolType) => void;
  private fileCallbacks: FileActionCallbacks | null = null;
  private editCallbacks: EditActionCallbacks | null = null;
  private strokeCallbacks: StrokeColorCallbacks | null = null;
  private snapCallbacks: SnapCallbacks | null = null;
  private canvasLockCallbacks: CanvasLockCallbacks | null = null;
  private settingsCallbacks: SettingsCallbacks | null = null;
  private snapEnabled: boolean = true;
  private canvasLockEnabled: boolean = false;
  private undoBtn: HTMLButtonElement | null = null;
  private redoBtn: HTMLButtonElement | null = null;
  private lockStatusEl: HTMLElement | null = null;
  private logoImg: HTMLImageElement | null = null;
  private themeUnsubscribe: (() => void) | null = null;

  constructor(parent: HTMLElement, tools: ITool[], onToolSelect: (type: ToolType) => void) {
    this.onToolSelect = onToolSelect;

    this.element = document.createElement('aside');
    this.element.className = 'fixed left-0 top-0 h-full bg-surface border-r border-border z-sidebar hidden md:flex flex-col';
    this.element.style.width = `${LAYOUT.sidebarWidth}px`;

    const header = document.createElement('div');
    header.className = 'p-3 border-b border-border flex items-center justify-between';

    // Logo image that switches with theme
    this.logoImg = document.createElement('img');
    this.logoImg.src = themeManager.getTheme() === 'dark' ? logoDark : logoLight;
    this.logoImg.alt = "El's Maps";
    this.logoImg.className = 'h-16 w-auto';
    header.appendChild(this.logoImg);

    // Subscribe to theme changes
    this.themeUnsubscribe = themeManager.subscribe((theme) => {
      if (this.logoImg) {
        this.logoImg.src = theme === 'dark' ? logoDark : logoLight;
      }
    });

    // Settings button
    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'settings-btn p-1.5 rounded hover:bg-charcoal-light transition-colors text-muted hover:text-foreground';
    settingsBtn.setAttribute('aria-label', 'Settings');
    settingsBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    `;
    settingsBtn.addEventListener('click', () => {
      this.settingsCallbacks?.onSettingsOpen();
    });
    header.appendChild(settingsBtn);

    this.element.appendChild(header);

    // Create scrollable content container
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'flex-1 overflow-y-auto flex flex-col min-h-0';

    // Add stroke/color section at the top
    const strokeSection = this.createStrokeSection();
    scrollContainer.appendChild(strokeSection);

    const toolsSection = document.createElement('div');
    toolsSection.className = 'p-4 border-t border-border';

    const toolsLabel = document.createElement('h2');
    toolsLabel.className = 'text-sm text-textMuted mb-3';
    toolsLabel.textContent = 'Tools';
    toolsSection.appendChild(toolsLabel);

    const toolsGrid = document.createElement('div');
    toolsGrid.className = 'grid grid-cols-4 gap-2';

    tools.forEach((tool) => {
      const button = new ToolButton(
        { type: tool.type, name: tool.name, icon: tool.icon },
        this.handleToolClick,
        false
      );
      this.toolButtons.set(tool.type, button);
      toolsGrid.appendChild(button.getElement());
    });

    toolsSection.appendChild(toolsGrid);
    scrollContainer.appendChild(toolsSection);

    // Add edit actions section
    const editSection = this.createEditSection();
    scrollContainer.appendChild(editSection);

    // Add file actions section
    const fileSection = this.createFileSection();
    scrollContainer.appendChild(fileSection);

    this.element.appendChild(scrollContainer);
    parent.appendChild(this.element);
  }

  private createEditSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'p-4 border-t border-border';

    const label = document.createElement('h2');
    label.className = 'text-sm text-textMuted mb-3';
    label.textContent = 'Edit';
    section.appendChild(label);

    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'flex flex-col gap-2';

    // Undo button
    this.undoBtn = this.createActionButton('Undo', 'undo');
    this.undoBtn.addEventListener('click', () => this.editCallbacks?.onUndo());
    buttonsContainer.appendChild(this.undoBtn);

    // Redo button
    this.redoBtn = this.createActionButton('Redo', 'redo');
    this.redoBtn.addEventListener('click', () => this.editCallbacks?.onRedo());
    buttonsContainer.appendChild(this.redoBtn);

    // Clear all button
    const clearBtn = this.createActionButton('Clear All', 'clear');
    clearBtn.addEventListener('click', () => {
      if (confirm('Clear all drawings? This cannot be undone.')) {
        this.editCallbacks?.onClearAll();
      }
    });
    buttonsContainer.appendChild(clearBtn);

    section.appendChild(buttonsContainer);
    return section;
  }

  private createStrokeSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'p-4 border-b border-border';

    const label = document.createElement('h2');
    label.className = 'text-sm text-textMuted mb-3';
    label.textContent = 'Drawing Style';
    section.appendChild(label);

    const container = document.createElement('div');
    container.className = 'space-y-3';

    // Stroke color
    const colorLabel = document.createElement('label');
    colorLabel.className = 'block text-xs text-textMuted mb-1';
    colorLabel.textContent = 'Stroke Color';
    container.appendChild(colorLabel);

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.id = 'global-stroke-color';
    colorInput.className = 'w-full h-8 rounded cursor-pointer bg-charcoal border border-border';
    colorInput.value = '#ffffff';
    colorInput.addEventListener('input', (e) => {
      this.strokeCallbacks?.onStrokeColorChange((e.target as HTMLInputElement).value);
      this.updateQuickColorSelection((e.target as HTMLInputElement).value);
    });
    container.appendChild(colorInput);

    // Quick color swatches
    const quickColors = [
      '#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00',
      '#ff00ff', '#00ffff', '#ff8000', '#8000ff', '#00ff80', '#ff0080',
      '#808080', '#c0c0c0', '#800000', '#008000', '#000080', '#808000'
    ];

    const swatchContainer = document.createElement('div');
    swatchContainer.className = 'grid grid-cols-6 gap-1 mt-2';
    swatchContainer.id = 'quick-color-swatches';

    quickColors.forEach((color) => {
      const swatch = document.createElement('button');
      swatch.className = 'w-6 h-6 rounded border border-border hover:border-white transition-colors';
      swatch.style.backgroundColor = color;
      swatch.title = color;
      swatch.dataset.color = color;
      if (color === '#ffffff') {
        swatch.classList.add('ring-2', 'ring-primary', 'ring-offset-1', 'ring-offset-surface');
      }
      swatch.addEventListener('click', () => {
        colorInput.value = color;
        this.strokeCallbacks?.onStrokeColorChange(color);
        this.updateQuickColorSelection(color);
      });
      swatchContainer.appendChild(swatch);
    });

    container.appendChild(swatchContainer);

    // Stroke width
    const widthLabel = document.createElement('label');
    widthLabel.className = 'block text-xs text-textMuted mb-1';
    widthLabel.textContent = 'Stroke Width';
    container.appendChild(widthLabel);

    const widthInputContainer = document.createElement('div');
    widthInputContainer.className = 'flex items-center gap-2';

    const widthInput = document.createElement('input');
    widthInput.type = 'range';
    widthInput.id = 'global-stroke-width';
    widthInput.min = '1';
    widthInput.max = '20';
    widthInput.value = '2';
    widthInput.className = 'flex-1';
    widthInput.addEventListener('input', (e) => {
      this.strokeCallbacks?.onStrokeWidthChange(Number((e.target as HTMLInputElement).value));
      widthValue.textContent = (e.target as HTMLInputElement).value + 'px';
    });
    widthInputContainer.appendChild(widthInput);

    const widthValue = document.createElement('span');
    widthValue.id = 'global-stroke-width-value';
    widthValue.className = 'text-xs text-foreground min-w-8 text-right';
    widthValue.textContent = '2px';
    widthInputContainer.appendChild(widthValue);

    container.appendChild(widthInputContainer);

    const snapRow = document.createElement('div');
    snapRow.className = 'flex items-center gap-2 pt-2';

    const snapInput = document.createElement('input');
    snapInput.type = 'checkbox';
    snapInput.id = 'global-snap-toggle';
    snapInput.checked = this.snapEnabled;
    snapInput.addEventListener('change', (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      this.snapEnabled = enabled;
      this.snapCallbacks?.onSnapToggle(enabled);
    });
    snapRow.appendChild(snapInput);

    const snapLabel = document.createElement('label');
    snapLabel.className = 'text-xs text-textMuted';
    snapLabel.htmlFor = 'global-snap-toggle';
    snapLabel.textContent = 'Snap to endpoints';
    snapRow.appendChild(snapLabel);

    container.appendChild(snapRow);

    section.appendChild(container);
    return section;
  }

  private createFileSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'p-4 border-t border-border mt-auto';

    const label = document.createElement('h2');
    label.className = 'text-sm text-textMuted mb-3';
    label.textContent = 'File';
    section.appendChild(label);

    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'flex flex-col gap-2';

    // Import button
    const importBtn = this.createActionButton('Import Image', 'import');
    importBtn.addEventListener('click', () => this.fileCallbacks?.onImport());
    buttonsContainer.appendChild(importBtn);

    // Canvas Lock toggle
    const lockRow = document.createElement('div');
    lockRow.className = 'flex items-center gap-2 py-1';

    const lockInput = document.createElement('input');
    lockInput.type = 'checkbox';
    lockInput.id = 'canvas-lock-toggle';
    lockInput.checked = this.canvasLockEnabled;
    lockInput.addEventListener('change', (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      this.canvasLockEnabled = enabled;
      this.canvasLockCallbacks?.onCanvasLockToggle(enabled);
    });
    lockRow.appendChild(lockInput);

    const lockLabel = document.createElement('label');
    lockLabel.className = 'text-xs text-textMuted';
    lockLabel.htmlFor = 'canvas-lock-toggle';
    lockLabel.textContent = 'Lock export to image';
    lockRow.appendChild(lockLabel);

    buttonsContainer.appendChild(lockRow);

    // Lock status indicator
    this.lockStatusEl = document.createElement('div');
    this.lockStatusEl.className = 'text-xs text-accent hidden items-center gap-1 py-1';
    this.lockStatusEl.innerHTML = `
      <span>Canvas locked</span>
      <button class="unlock-btn text-textMuted hover:text-foreground ml-auto">[Unlock]</button>
    `;
    this.lockStatusEl.querySelector('.unlock-btn')?.addEventListener('click', () => {
      this.canvasLockCallbacks?.onUnlockCanvas();
    });
    buttonsContainer.appendChild(this.lockStatusEl);

    // Export buttons row
    const exportRow = document.createElement('div');
    exportRow.className = 'flex gap-2';

    const exportPngBtn = this.createActionButton('PNG', 'export');
    exportPngBtn.addEventListener('click', () => this.fileCallbacks?.onExportPNG());
    exportRow.appendChild(exportPngBtn);

    const exportJpgBtn = this.createActionButton('JPG', 'export');
    exportJpgBtn.addEventListener('click', () => this.fileCallbacks?.onExportJPG());
    exportRow.appendChild(exportJpgBtn);

    const exportPdfBtn = this.createActionButton('PDF', 'export');
    exportPdfBtn.addEventListener('click', () => this.fileCallbacks?.onExportPDF());
    exportRow.appendChild(exportPdfBtn);

    buttonsContainer.appendChild(exportRow);

    // Copy to clipboard button
    const copyBtn = this.createActionButton('Copy to Clipboard', 'copy');
    copyBtn.addEventListener('click', () => this.fileCallbacks?.onCopyToClipboard());
    buttonsContainer.appendChild(copyBtn);

    section.appendChild(buttonsContainer);
    return section;
  }

  private createActionButton(label: string, icon: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'flex items-center justify-center gap-2 px-3 py-2 bg-charcoal-light hover:bg-charcoal-lighter rounded text-sm text-foreground transition-colors flex-1';
    button.innerHTML = `
      <span class="icon-${icon}"></span>
      <span>${label}</span>
    `;
    return button;
  }

  setFileCallbacks(callbacks: FileActionCallbacks): void {
    this.fileCallbacks = callbacks;
  }

  setEditCallbacks(callbacks: EditActionCallbacks): void {
    this.editCallbacks = callbacks;
  }

  setStrokeCallbacks(callbacks: StrokeColorCallbacks): void {
    this.strokeCallbacks = callbacks;
  }

  setSnapCallbacks(callbacks: SnapCallbacks): void {
    this.snapCallbacks = callbacks;
  }

  setCanvasLockCallbacks(callbacks: CanvasLockCallbacks): void {
    this.canvasLockCallbacks = callbacks;
  }

  setSettingsCallbacks(callbacks: SettingsCallbacks): void {
    this.settingsCallbacks = callbacks;
  }

  setSnapEnabled(enabled: boolean): void {
    this.snapEnabled = enabled;
    const input = this.element.querySelector('#global-snap-toggle') as HTMLInputElement | null;
    if (input) input.checked = enabled;
  }

  setCanvasLockEnabled(enabled: boolean): void {
    this.canvasLockEnabled = enabled;
    const input = this.element.querySelector('#canvas-lock-toggle') as HTMLInputElement | null;
    if (input) input.checked = enabled;
  }

  setStrokeColor(color: string): void {
    const colorInput = this.element.querySelector('#global-stroke-color') as HTMLInputElement | null;
    if (colorInput) {
      colorInput.value = color;
    }
    this.updateQuickColorSelection(color);
  }

  setStrokeWidth(width: number): void {
    const widthInput = this.element.querySelector('#global-stroke-width') as HTMLInputElement | null;
    const widthValue = this.element.querySelector('#global-stroke-width-value') as HTMLElement | null;
    if (widthInput) {
      widthInput.value = String(width);
    }
    if (widthValue) {
      widthValue.textContent = width + 'px';
    }
  }

  updateCanvasLockStatus(isLocked: boolean): void {
    if (this.lockStatusEl) {
      if (isLocked) {
        this.lockStatusEl.classList.remove('hidden');
        this.lockStatusEl.classList.add('flex');
      } else {
        this.lockStatusEl.classList.add('hidden');
        this.lockStatusEl.classList.remove('flex');
      }
    }
  }

  updateUndoRedoButtons(canUndo: boolean, canRedo: boolean): void {
    if (this.undoBtn) {
      this.undoBtn.disabled = !canUndo;
      this.undoBtn.style.opacity = canUndo ? '1' : '0.5';
      this.undoBtn.style.cursor = canUndo ? 'pointer' : 'not-allowed';
    }
    if (this.redoBtn) {
      this.redoBtn.disabled = !canRedo;
      this.redoBtn.style.opacity = canRedo ? '1' : '0.5';
      this.redoBtn.style.cursor = canRedo ? 'pointer' : 'not-allowed';
    }
  }

  private updateQuickColorSelection(color: string): void {
    const swatches = this.element.querySelectorAll('#quick-color-swatches button');
    swatches.forEach((swatch) => {
      const btn = swatch as HTMLButtonElement;
      if (btn.dataset.color?.toLowerCase() === color.toLowerCase()) {
        btn.classList.add('ring-2', 'ring-primary', 'ring-offset-1', 'ring-offset-surface');
      } else {
        btn.classList.remove('ring-2', 'ring-primary', 'ring-offset-1', 'ring-offset-surface');
      }
    });
  }

  private handleToolClick = (type: ToolType): void => {
    this.onToolSelect(type);
  };

  setActiveTool(type: ToolType): void {
    this.toolButtons.forEach((button, toolType) => {
      button.setActive(toolType === type);
    });
  }

  getElement(): HTMLElement {
    return this.element;
  }

  destroy(): void {
    this.themeUnsubscribe?.();
    this.toolButtons.forEach((button) => button.destroy());
    this.toolButtons.clear();
    this.element.remove();
  }
}
