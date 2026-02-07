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

export class MobileToolbar {
  private element: HTMLElement;
  private toolButtons: Map<ToolType, ToolButton> = new Map();
  private onToolSelect: (type: ToolType) => void;
  private fileCallbacks: FileActionCallbacks | null = null;
  private fileMenu: HTMLElement | null = null;

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

    // Add file menu button
    const fileMenuBtn = this.createFileMenuButton();
    this.element.appendChild(fileMenuBtn);

    parent.appendChild(this.element);
  }

  private createFileMenuButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'flex items-center justify-center p-2 hover:bg-charcoal-light rounded text-white transition-colors flex-shrink-0';
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
    importBtn.className = 'w-full text-left px-4 py-2 text-white hover:bg-charcoal-light transition-colors border-b border-border flex items-center gap-2';
    importBtn.innerHTML = '<span class="icon-import"></span><span>Import Image</span>';
    importBtn.addEventListener('click', () => {
      this.fileCallbacks?.onImport();
      closeMenu();
    });
    menu.appendChild(importBtn);

    // Export PNG button
    const exportPngBtn = document.createElement('button');
    exportPngBtn.className = 'w-full text-left px-4 py-2 text-white hover:bg-charcoal-light transition-colors border-b border-border flex items-center gap-2';
    exportPngBtn.innerHTML = '<span class="icon-export"></span><span>Export PNG</span>';
    exportPngBtn.addEventListener('click', () => {
      this.fileCallbacks?.onExportPNG();
      closeMenu();
    });
    menu.appendChild(exportPngBtn);

    // Export JPG button
    const exportJpgBtn = document.createElement('button');
    exportJpgBtn.className = 'w-full text-left px-4 py-2 text-white hover:bg-charcoal-light transition-colors border-b border-border flex items-center gap-2';
    exportJpgBtn.innerHTML = '<span class="icon-export"></span><span>Export JPG</span>';
    exportJpgBtn.addEventListener('click', () => {
      this.fileCallbacks?.onExportJPG();
      closeMenu();
    });
    menu.appendChild(exportJpgBtn);

    // Copy to clipboard button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'w-full text-left px-4 py-2 text-white hover:bg-charcoal-light transition-colors flex items-center gap-2';
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
    this.element.remove();
  }
}
