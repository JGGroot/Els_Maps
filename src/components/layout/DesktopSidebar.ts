import { ToolType } from '@/types';
import type { ITool } from '@/types';
import { LAYOUT } from '@/constants';
import { ToolButton } from '../controls/ToolButton';
import { themeManager } from '@/utils';
import { createColorPalettePicker } from '../controls/ColorPalettePicker';
import type { ColorPalettePickerInstance } from '../controls/ColorPalettePicker';

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
  onStrokeDashChange: (dashed: boolean) => void;
}

export interface SnapCallbacks {
  onSnapToggle: (enabled: boolean) => void;
}

export interface CanvasLockCallbacks {
  onUnlockCanvas: () => void;
}

export interface SettingsCallbacks {
  onSettingsOpen: () => void;
}

export interface LegendCallbacks {
  onCreateLegend: () => void;
}

export interface NorthPointerCallbacks {
  onAddNorthPointer: () => void;
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
  private legendCallbacks: LegendCallbacks | null = null;
  private northPointerCallbacks: NorthPointerCallbacks | null = null;
  private snapEnabled: boolean = true;
  private strokeDashed: boolean = false;
  private undoBtn: HTMLButtonElement | null = null;
  private redoBtn: HTMLButtonElement | null = null;
  private strokeColorPicker: ColorPalettePickerInstance | null = null;
  private lockStatusEl: HTMLElement | null = null;
  private logoImg: HTMLImageElement | null = null;
  private themeUnsubscribe: (() => void) | null = null;

  constructor(parent: HTMLElement, tools: ITool[], onToolSelect: (type: ToolType) => void) {
    this.onToolSelect = onToolSelect;

    this.element = document.createElement('aside');
    this.element.className = 'fixed left-0 top-0 h-full bg-surface border-r border-border z-sidebar flex flex-col';
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
    clearBtn.addEventListener('click', () => this.editCallbacks?.onClearAll());
    buttonsContainer.appendChild(clearBtn);

    // Create legend button
    const legendBtn = this.createActionButton('Create Legend', 'legend');
    legendBtn.addEventListener('click', () => this.legendCallbacks?.onCreateLegend());
    buttonsContainer.appendChild(legendBtn);

    // Add north pointer button
    const northPointerBtn = this.createActionButton('Add North Pointer', 'compass');
    northPointerBtn.addEventListener('click', () => this.northPointerCallbacks?.onAddNorthPointer());
    buttonsContainer.appendChild(northPointerBtn);

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

    // Stroke color palette picker
    const colorLabel = document.createElement('label');
    colorLabel.className = 'block text-xs text-textMuted mb-1';
    colorLabel.textContent = 'Stroke Color';
    container.appendChild(colorLabel);

    this.strokeColorPicker = createColorPalettePicker('#ffffff', (color) => {
      this.strokeCallbacks?.onStrokeColorChange(color);
    });
    container.appendChild(this.strokeColorPicker.element);

    // Stroke width
    const widthLabel = document.createElement('label');
    widthLabel.className = 'block text-xs text-textMuted mt-2 mb-1';
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

    // Dashed + Snap toggles side by side
    const toggleRow = document.createElement('div');
    toggleRow.className = 'flex items-center gap-4 pt-2';

    const dashedInput = document.createElement('input');
    dashedInput.type = 'checkbox';
    dashedInput.id = 'global-dash-toggle';
    dashedInput.checked = this.strokeDashed;
    dashedInput.className = 'modern-checkbox';
    dashedInput.addEventListener('change', (e) => {
      const dashed = (e.target as HTMLInputElement).checked;
      this.strokeDashed = dashed;
      this.strokeCallbacks?.onStrokeDashChange(dashed);
    });
    const dashedLabel = document.createElement('label');
    dashedLabel.className = 'text-sm text-textMuted flex items-center gap-1.5 cursor-pointer';
    dashedLabel.htmlFor = 'global-dash-toggle';
    dashedLabel.textContent = 'Dashed';
    dashedLabel.prepend(dashedInput);
    toggleRow.appendChild(dashedLabel);

    const snapInput = document.createElement('input');
    snapInput.type = 'checkbox';
    snapInput.id = 'global-snap-toggle';
    snapInput.checked = this.snapEnabled;
    snapInput.className = 'modern-checkbox';
    snapInput.addEventListener('change', (e) => {
      const enabled = (e.target as HTMLInputElement).checked;
      this.snapEnabled = enabled;
      this.snapCallbacks?.onSnapToggle(enabled);
    });
    const snapLabel = document.createElement('label');
    snapLabel.className = 'text-sm text-textMuted flex items-center gap-1.5 cursor-pointer';
    snapLabel.htmlFor = 'global-snap-toggle';
    snapLabel.textContent = 'Snap';
    snapLabel.prepend(snapInput);
    toggleRow.appendChild(snapLabel);

    container.appendChild(toggleRow);

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

  setLegendCallbacks(callbacks: LegendCallbacks): void {
    this.legendCallbacks = callbacks;
  }

  setNorthPointerCallbacks(callbacks: NorthPointerCallbacks): void {
    this.northPointerCallbacks = callbacks;
  }

  setSnapEnabled(enabled: boolean): void {
    this.snapEnabled = enabled;
    const input = this.element.querySelector('#global-snap-toggle') as HTMLInputElement | null;
    if (input) input.checked = enabled;
  }

  setStrokeColor(color: string): void {
    this.strokeColorPicker?.setColor(color);
  }

  setStrokeDashed(dashed: boolean): void {
    this.strokeDashed = dashed;
    const input = this.element.querySelector('#global-dash-toggle') as HTMLInputElement | null;
    if (input) input.checked = dashed;
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
