import type { FabricObject } from 'fabric';
import { LAYOUT } from '@/constants';

export interface PropertiesPanelCallbacks {
  onStrokeColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onFillColorChange: (color: string) => void;
  onFontSizeChange: (size: number) => void;
  onImageLockChange: (locked: boolean) => void;
  onLockCanvasToImage: () => void;
}

export interface ProjectCallbacks {
  onNewProject: () => Promise<void>;
  onSaveProject: (name: string) => Promise<boolean>;
  onLoadProject: (id: string) => Promise<boolean>;
  onDeleteProject: (id: string) => Promise<boolean>;
  onListProjects: () => Promise<Array<{ id: string; name: string; modifiedAt: number; preview?: string }>>;
  getCurrentProjectId: () => string | null;
}

export class PropertiesPanel {
  private element: HTMLElement;
  private contentEl: HTMLElement;
  private projectsEl: HTMLElement;
  private shortcutsEl: HTMLElement;
  private callbacks: PropertiesPanelCallbacks;
  private projectCallbacks: ProjectCallbacks | null = null;

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

    // Add projects section
    this.projectsEl = this.createProjectsSection();
    this.element.appendChild(this.projectsEl);

    // Add shortcuts section at the bottom
    this.shortcutsEl = this.createShortcutsSection();
    this.element.appendChild(this.shortcutsEl);

    parent.appendChild(this.element);
  }

  setProjectCallbacks(callbacks: ProjectCallbacks): void {
    this.projectCallbacks = callbacks;
    this.refreshProjectsList();
  }

  private createProjectsSection(): HTMLElement {
    const section = document.createElement('div');
    section.className = 'p-4 border-t border-border';

    const header = document.createElement('div');
    header.className = 'flex justify-between items-center mb-3';

    const label = document.createElement('h2');
    label.className = 'text-sm text-textMuted cursor-pointer hover:text-white transition-colors flex items-center gap-1';
    label.innerHTML = 'Projects <span class="text-xs opacity-60">(click for grid view)</span>';
    label.addEventListener('click', () => this.showProjectsModal());
    header.appendChild(label);

    section.appendChild(header);

    // Action buttons row
    const actionsRow = document.createElement('div');
    actionsRow.className = 'flex gap-2 mb-3';

    const newBtn = document.createElement('button');
    newBtn.className = 'flex-1 px-2 py-1.5 bg-charcoal-light hover:bg-charcoal-lighter rounded text-xs text-white transition-colors';
    newBtn.textContent = 'New';
    newBtn.addEventListener('click', async () => {
      if (confirm('Start a new project? Unsaved changes will be lost.')) {
        await this.projectCallbacks?.onNewProject();
        this.refreshProjectsList();
      }
    });
    actionsRow.appendChild(newBtn);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'flex-1 px-2 py-1.5 bg-accent hover:bg-accent/80 rounded text-xs text-white transition-colors';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async () => {
      const currentId = this.projectCallbacks?.getCurrentProjectId();
      let name = 'Untitled Project';

      if (currentId) {
        // Update existing project
        const projects = await this.projectCallbacks?.onListProjects();
        const existing = projects?.find(p => p.id === currentId);
        name = existing?.name ?? name;
      } else {
        // New project - ask for name
        const inputName = prompt('Project name:', name);
        if (!inputName) return;
        name = inputName;
      }

      const success = await this.projectCallbacks?.onSaveProject(name);
      if (success) {
        this.showToast('Project saved!');
        this.refreshProjectsList();
      }
    });
    actionsRow.appendChild(saveBtn);

    const saveAsBtn = document.createElement('button');
    saveAsBtn.className = 'flex-1 px-2 py-1.5 bg-charcoal-light hover:bg-charcoal-lighter rounded text-xs text-white transition-colors';
    saveAsBtn.textContent = 'Save As';
    saveAsBtn.addEventListener('click', async () => {
      const name = prompt('Project name:', 'Untitled Project');
      if (!name) return;

      const success = await this.projectCallbacks?.onSaveProject(name);
      if (success) {
        this.showToast('Project saved!');
        this.refreshProjectsList();
      }
    });
    actionsRow.appendChild(saveAsBtn);

    section.appendChild(actionsRow);

    // Projects list
    const listContainer = document.createElement('div');
    listContainer.id = 'projects-list';
    listContainer.className = 'max-h-96 overflow-y-auto space-y-1';
    listContainer.innerHTML = '<p class="text-xs text-textMuted">No saved projects</p>';
    section.appendChild(listContainer);

    return section;
  }

  private async refreshProjectsList(): Promise<void> {
    const listContainer = this.projectsEl.querySelector('#projects-list');
    if (!listContainer || !this.projectCallbacks) return;

    const projects = await this.projectCallbacks.onListProjects();
    const currentId = this.projectCallbacks.getCurrentProjectId();

    if (projects.length === 0) {
      listContainer.innerHTML = '<p class="text-xs text-textMuted">No saved projects</p>';
      return;
    }

    listContainer.innerHTML = '';

    projects.forEach((project) => {
      const row = document.createElement('div');
      row.className = `flex items-center justify-between p-2 rounded text-xs ${
        project.id === currentId ? 'bg-accent/20 border border-accent' : 'bg-charcoal hover:bg-charcoal-light'
      } transition-colors cursor-pointer`;

      const info = document.createElement('div');
      info.className = 'flex-1 min-w-0';

      const name = document.createElement('div');
      name.className = 'text-white truncate';
      name.textContent = project.name;
      info.appendChild(name);

      const date = document.createElement('div');
      date.className = 'text-textMuted text-[10px]';
      date.textContent = new Date(project.modifiedAt).toLocaleDateString();
      info.appendChild(date);

      row.appendChild(info);

      // Load button
      row.addEventListener('click', async (e) => {
        if ((e.target as HTMLElement).closest('.delete-btn')) return;
        const success = await this.projectCallbacks?.onLoadProject(project.id);
        if (success) {
          this.showToast('Project loaded!');
          this.refreshProjectsList();
        }
      });

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn ml-2 p-1 text-textMuted hover:text-red-500 transition-colors';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.title = 'Delete project';
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Delete "${project.name}"?`)) {
          await this.projectCallbacks?.onDeleteProject(project.id);
          this.refreshProjectsList();
        }
      });
      row.appendChild(deleteBtn);

      listContainer.appendChild(row);
    });
  }

  private showToast(message: string): void {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-accent text-white px-4 py-2 rounded shadow-lg z-50 animate-fade-in';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 2000);
  }

  private async showProjectsModal(): Promise<void> {
    if (!this.projectCallbacks) return;

    const projects = await this.projectCallbacks.onListProjects();
    const currentId = this.projectCallbacks.getCurrentProjectId();

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4';

    const dialog = document.createElement('div');
    dialog.className = 'bg-surface rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col';

    const header = document.createElement('div');
    header.className = 'flex justify-between items-center mb-4';
    header.innerHTML = `
      <h3 class="text-lg font-semibold text-white">All Projects</h3>
      <button class="close-btn text-textMuted hover:text-white text-2xl">&times;</button>
    `;
    dialog.appendChild(header);

    const gridContainer = document.createElement('div');
    gridContainer.className = 'flex-1 overflow-y-auto';

    if (projects.length === 0) {
      gridContainer.innerHTML = '<p class="text-textMuted text-center py-8">No saved projects yet</p>';
    } else {
      const grid = document.createElement('div');
      grid.className = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';

      // Sort by modifiedAt descending (newest first)
      const sortedProjects = [...projects].sort((a, b) => b.modifiedAt - a.modifiedAt);

      sortedProjects.forEach((project) => {
        const card = document.createElement('div');
        card.className = `bg-charcoal rounded-lg overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-accent ${
          project.id === currentId ? 'ring-2 ring-accent' : ''
        }`;

        const preview = document.createElement('div');
        preview.className = 'aspect-video bg-charcoal-dark flex items-center justify-center';
        if (project.preview) {
          preview.innerHTML = `<img src="${project.preview}" alt="${project.name}" class="w-full h-full object-contain" />`;
        } else {
          preview.innerHTML = '<span class="text-textMuted text-xs">No preview</span>';
        }
        card.appendChild(preview);

        const info = document.createElement('div');
        info.className = 'p-3';
        info.innerHTML = `
          <div class="text-white text-sm font-medium truncate">${project.name}</div>
          <div class="text-textMuted text-xs">${new Date(project.modifiedAt).toLocaleDateString()} ${new Date(project.modifiedAt).toLocaleTimeString()}</div>
        `;
        card.appendChild(info);

        card.addEventListener('click', async () => {
          const success = await this.projectCallbacks?.onLoadProject(project.id);
          if (success) {
            this.showToast('Project loaded!');
            this.refreshProjectsList();
            modal.remove();
          }
        });

        grid.appendChild(card);
      });

      gridContainer.appendChild(grid);
    }

    dialog.appendChild(gridContainer);
    modal.appendChild(dialog);
    document.body.appendChild(modal);

    // Close handlers
    const closeBtn = header.querySelector('.close-btn');
    closeBtn?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
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
        <div class="mt-3">
          <button id="lock-canvas-to-image" class="w-full px-3 py-2 bg-accent hover:bg-accent/80 rounded text-sm text-white transition-colors">
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

    const lockCanvasBtn = this.contentEl.querySelector('#lock-canvas-to-image') as HTMLButtonElement | null;
    lockCanvasBtn?.addEventListener('click', () => {
      this.callbacks.onLockCanvasToImage();
    });
  }

  getElement(): HTMLElement {
    return this.element;
  }

  destroy(): void {
    this.element.remove();
  }
}
