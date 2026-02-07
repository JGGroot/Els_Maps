import { ToolType } from '@/types';
import type { ITool } from '@/types';
import { LAYOUT } from '@/constants';
import { ToolButton } from '../controls/ToolButton';

export interface FileActionCallbacks {
  onImport: () => void;
  onExportPNG: () => void;
  onExportJPG: () => void;
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

export class DesktopSidebar {
  private element: HTMLElement;
  private toolButtons: Map<ToolType, ToolButton> = new Map();
  private onToolSelect: (type: ToolType) => void;
  private fileCallbacks: FileActionCallbacks | null = null;
  private editCallbacks: EditActionCallbacks | null = null;
  private strokeCallbacks: StrokeColorCallbacks | null = null;
  private undoBtn: HTMLButtonElement | null = null;
  private redoBtn: HTMLButtonElement | null = null;

  constructor(parent: HTMLElement, tools: ITool[], onToolSelect: (type: ToolType) => void) {
    this.onToolSelect = onToolSelect;

    this.element = document.createElement('aside');
    this.element.className = 'fixed left-0 top-0 h-full bg-surface border-r border-border z-sidebar hidden md:flex flex-col';
    this.element.style.width = `${LAYOUT.sidebarWidth}px`;

    const header = document.createElement('div');
    header.className = 'p-4 border-b border-border';
    header.innerHTML = `<h1 class="text-lg font-semibold text-white">El's Maps</h1>`;
    this.element.appendChild(header);

    // Add stroke/color section at the top
    const strokeSection = this.createStrokeSection();
    this.element.appendChild(strokeSection);

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
    this.element.appendChild(toolsSection);

    // Add edit actions section
    const editSection = this.createEditSection();
    this.element.appendChild(editSection);

    // Add file actions section
    const fileSection = this.createFileSection();
    this.element.appendChild(fileSection);

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
    });
    container.appendChild(colorInput);

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
    widthValue.className = 'text-xs text-white min-w-8 text-right';
    widthValue.textContent = '2px';
    widthInputContainer.appendChild(widthValue);

    container.appendChild(widthInputContainer);

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

    // Export buttons row
    const exportRow = document.createElement('div');
    exportRow.className = 'flex gap-2';

    const exportPngBtn = this.createActionButton('PNG', 'export');
    exportPngBtn.addEventListener('click', () => this.fileCallbacks?.onExportPNG());
    exportRow.appendChild(exportPngBtn);

    const exportJpgBtn = this.createActionButton('JPG', 'export');
    exportJpgBtn.addEventListener('click', () => this.fileCallbacks?.onExportJPG());
    exportRow.appendChild(exportJpgBtn);

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
    button.className = 'flex items-center justify-center gap-2 px-3 py-2 bg-charcoal-light hover:bg-charcoal-lighter rounded text-sm text-white transition-colors flex-1';
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
    this.toolButtons.forEach((button) => button.destroy());
    this.toolButtons.clear();
    this.element.remove();
  }
}
