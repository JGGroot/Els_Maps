import { ToolType } from '@/types';
import type { ITool } from '@/types';
import { LAYOUT } from '@/constants';
import { ToolButton } from '../controls/ToolButton';

export interface FileActionCallbacks {
  onImport: () => void;
  onExportPNG: () => void;
  onExportJPG: () => void;
  onExportPDF: () => void;
  onCopyToClipboard: () => void;
}

export interface StrokeColorCallbacks {
  onStrokeColorChange: (color: string) => void;
}

export class MobileToolbar {
  private element: HTMLElement;
  private toolButtons: Map<ToolType, ToolButton> = new Map();
  private onToolSelect: (type: ToolType) => void;
  private fileCallbacks: FileActionCallbacks | null = null;
  private strokeCallbacks: StrokeColorCallbacks | null = null;
  private fileMenu: HTMLElement | null = null;
  private colorMenu: HTMLElement | null = null;
  private colorBtn: HTMLButtonElement | null = null;
  private currentColor: string = '#ffffff';

  constructor(parent: HTMLElement, tools: ITool[], onToolSelect: (type: ToolType) => void) {
    this.onToolSelect = onToolSelect;

    this.element = document.createElement('nav');
    this.element.className = 'fixed left-0 right-0 bottom-0 bg-surface border-t border-border z-toolbar flex md:hidden items-center justify-between px-2';
    this.element.style.height = `${LAYOUT.toolbarHeight}px`;

    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'flex items-center gap-2 overflow-x-auto px-2 py-2 flex-1';
    scrollContainer.style.cssText = `
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      -ms-overflow-style: none;
    `;

    tools.forEach((tool) => {
      const button = new ToolButton(
        { type: tool.type, name: tool.name, icon: tool.icon },
        this.handleToolClick,
        false
      );
      this.toolButtons.set(tool.type, button);
      scrollContainer.appendChild(button.getElement());
    });

    this.element.appendChild(scrollContainer);

    // Add color picker button
    this.colorBtn = this.createColorButton();
    this.element.appendChild(this.colorBtn);

    // Add file menu button
    const fileMenuBtn = this.createFileMenuButton();
    this.element.appendChild(fileMenuBtn);

    parent.appendChild(this.element);
  }

  private createColorButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'flex items-center justify-center p-2 hover:bg-charcoal-light rounded transition-colors flex-shrink-0';
    button.innerHTML = `<span class="w-6 h-6 rounded border-2 border-white" style="background-color: ${this.currentColor}"></span>`;
    button.title = 'Stroke Color';
    button.addEventListener('click', () => this.toggleColorMenu());
    return button;
  }

  private toggleColorMenu(): void {
    if (this.colorMenu && this.colorMenu.parentElement) {
      this.colorMenu.remove();
      this.colorMenu = null;
    } else {
      this.colorMenu = this.createColorMenu();
      document.body.appendChild(this.colorMenu);
    }
  }

  private createColorMenu(): HTMLElement {
    const menu = document.createElement('div');
    menu.className = 'fixed bg-charcoal-dark border border-border rounded shadow-lg z-popover p-3';
    menu.style.bottom = `calc(${LAYOUT.toolbarHeight}px + 10px)`;
    menu.style.right = '50px';
    menu.style.width = '200px';

    const closeMenu = () => {
      menu.remove();
      this.colorMenu = null;
    };

    // Label
    const label = document.createElement('div');
    label.className = 'text-xs text-textMuted mb-2';
    label.textContent = 'Stroke Color';
    menu.appendChild(label);

    // Color input
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'w-full h-8 rounded cursor-pointer bg-charcoal border border-border mb-2';
    colorInput.value = this.currentColor;
    colorInput.addEventListener('input', (e) => {
      const color = (e.target as HTMLInputElement).value;
      this.setColor(color);
      this.updateSwatchSelection(menu, color);
    });
    menu.appendChild(colorInput);

    // Quick color swatches
    const quickColors = [
      '#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00',
      '#ff00ff', '#00ffff', '#ff8000', '#8000ff', '#00ff80', '#ff0080',
      '#808080', '#c0c0c0', '#800000', '#008000', '#000080', '#808000'
    ];

    const swatchContainer = document.createElement('div');
    swatchContainer.className = 'grid grid-cols-6 gap-1';

    quickColors.forEach((color) => {
      const swatch = document.createElement('button');
      swatch.className = 'w-7 h-7 rounded border border-border hover:border-white transition-colors';
      swatch.style.backgroundColor = color;
      swatch.title = color;
      swatch.dataset.color = color;
      if (color.toLowerCase() === this.currentColor.toLowerCase()) {
        swatch.classList.add('ring-2', 'ring-primary', 'ring-offset-1', 'ring-offset-charcoal-dark');
      }
      swatch.addEventListener('click', () => {
        colorInput.value = color;
        this.setColor(color);
        this.updateSwatchSelection(menu, color);
      });
      swatchContainer.appendChild(swatch);
    });

    menu.appendChild(swatchContainer);

    // Close menu when clicking outside
    const closeHandler = (e: Event) => {
      if (!menu.contains(e.target as Node) && e.target !== this.colorBtn) {
        closeMenu();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);

    return menu;
  }

  private updateSwatchSelection(menu: HTMLElement, color: string): void {
    const swatches = menu.querySelectorAll('[data-color]');
    swatches.forEach((swatch) => {
      const btn = swatch as HTMLButtonElement;
      if (btn.dataset.color?.toLowerCase() === color.toLowerCase()) {
        btn.classList.add('ring-2', 'ring-primary', 'ring-offset-1', 'ring-offset-charcoal-dark');
      } else {
        btn.classList.remove('ring-2', 'ring-primary', 'ring-offset-1', 'ring-offset-charcoal-dark');
      }
    });
  }

  private setColor(color: string): void {
    this.currentColor = color;
    if (this.colorBtn) {
      const swatch = this.colorBtn.querySelector('span');
      if (swatch) {
        swatch.style.backgroundColor = color;
      }
    }
    this.strokeCallbacks?.onStrokeColorChange(color);
  }

  private createFileMenuButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'flex items-center justify-center p-2 hover:bg-charcoal-light rounded text-foreground transition-colors flex-shrink-0';
    button.innerHTML = '<span class="icon-menu"></span>';
    button.addEventListener('click', () => this.toggleFileMenu());
    return button;
  }

  private toggleFileMenu(): void {
    if (this.fileMenu && this.fileMenu.parentElement) {
      this.fileMenu.remove();
      this.fileMenu = null;
    } else {
      this.fileMenu = this.createFileMenu();
      document.body.appendChild(this.fileMenu);
      this.positionFileMenu();
    }
  }

  private createFileMenu(): HTMLElement {
    const menu = document.createElement('div');
    menu.className = 'fixed bg-charcoal-dark border border-border rounded shadow-lg z-popover';
    menu.style.bottom = `calc(${LAYOUT.toolbarHeight}px + 10px)`;
    menu.style.right = '10px';
    menu.style.minWidth = '180px';

    const closeMenu = () => {
      menu.remove();
      this.fileMenu = null;
    };

    // Import button
    const importBtn = document.createElement('button');
    importBtn.className = 'w-full text-left px-4 py-2 text-foreground hover:bg-charcoal-light transition-colors border-b border-border flex items-center gap-2';
    importBtn.innerHTML = '<span class="icon-import"></span><span>Import Image</span>';
    importBtn.addEventListener('click', () => {
      this.fileCallbacks?.onImport();
      closeMenu();
    });
    menu.appendChild(importBtn);

    // Export PNG button
    const exportPngBtn = document.createElement('button');
    exportPngBtn.className = 'w-full text-left px-4 py-2 text-foreground hover:bg-charcoal-light transition-colors border-b border-border flex items-center gap-2';
    exportPngBtn.innerHTML = '<span class="icon-export"></span><span>Export PNG</span>';
    exportPngBtn.addEventListener('click', () => {
      this.fileCallbacks?.onExportPNG();
      closeMenu();
    });
    menu.appendChild(exportPngBtn);

    // Export JPG button
    const exportJpgBtn = document.createElement('button');
    exportJpgBtn.className = 'w-full text-left px-4 py-2 text-foreground hover:bg-charcoal-light transition-colors border-b border-border flex items-center gap-2';
    exportJpgBtn.innerHTML = '<span class="icon-export"></span><span>Export JPG</span>';
    exportJpgBtn.addEventListener('click', () => {
      this.fileCallbacks?.onExportJPG();
      closeMenu();
    });
    menu.appendChild(exportJpgBtn);

    // Export PDF button
    const exportPdfBtn = document.createElement('button');
    exportPdfBtn.className = 'w-full text-left px-4 py-2 text-foreground hover:bg-charcoal-light transition-colors border-b border-border flex items-center gap-2';
    exportPdfBtn.innerHTML = '<span class="icon-export"></span><span>Export PDF</span>';
    exportPdfBtn.addEventListener('click', () => {
      this.fileCallbacks?.onExportPDF();
      closeMenu();
    });
    menu.appendChild(exportPdfBtn);

    // Copy to clipboard button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'w-full text-left px-4 py-2 text-foreground hover:bg-charcoal-light transition-colors flex items-center gap-2';
    copyBtn.innerHTML = '<span class="icon-copy"></span><span>Copy to Clipboard</span>';
    copyBtn.addEventListener('click', () => {
      this.fileCallbacks?.onCopyToClipboard();
      closeMenu();
    });
    menu.appendChild(copyBtn);

    // Close menu when clicking outside
    const closeHandler = (e: Event) => {
      if (!menu.contains(e.target as Node)) {
        closeMenu();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);

    return menu;
  }

  private positionFileMenu(): void {
    if (!this.fileMenu) return;
    // Menu positioning is handled via inline styles
  }

  setFileCallbacks(callbacks: FileActionCallbacks): void {
    this.fileCallbacks = callbacks;
  }

  setStrokeCallbacks(callbacks: StrokeColorCallbacks): void {
    this.strokeCallbacks = callbacks;
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
    this.fileMenu?.remove();
    this.colorMenu?.remove();
    this.element.remove();
  }
}
