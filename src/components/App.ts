import { Point } from 'fabric';
import { jsPDF } from 'jspdf';
import { CanvasEngine, canvasLockManager } from '@/canvas';
import { ToolManager, type ToolManagerCallbacks } from '@/tools';
import { ToolType } from '@/types';
import { historyManager, snapManager, settingsManager } from '@/utils';
import { MainLayout } from './layout/MainLayout';
import { DesktopSidebar, type FileActionCallbacks, type StrokeColorCallbacks, type EditActionCallbacks, type CanvasLockCallbacks, type SettingsCallbacks } from './layout/DesktopSidebar';
import { SettingsModal } from './layout/SettingsModal';
import { PropertiesPanel, type ProjectCallbacks } from './layout/PropertiesPanel';
import { CanvasContainer } from './canvas/CanvasContainer';
import { ImportManager } from '@/import';
import { ExportManager } from '@/export';
import { ClipboardManager } from '@/import';
import { StorageManager } from '@/storage';
import { ExportFormat, type ExportOptions } from '@/types';
import { ConfirmModal } from './controls/ConfirmModal';
import { ToastManager } from './controls/ToastManager';
import { UnsavedChangesModal, type UnsavedChoice } from './controls/UnsavedChangesModal';
import { TextInputModal } from './controls/TextInputModal';

export class App {
  private container: HTMLElement;
  private layout: MainLayout | null = null;
  private canvasContainer: CanvasContainer | null = null;
  private engine: CanvasEngine | null = null;
  private toolManager: ToolManager | null = null;

  private desktopSidebar: DesktopSidebar | null = null;
  private propertiesPanel: PropertiesPanel | null = null;
  private settingsModal: SettingsModal | null = null;
  private confirmModal: ConfirmModal | null = null;
  private toastManager: ToastManager | null = null;
  private unsavedModal: UnsavedChangesModal | null = null;
  private renameModal: TextInputModal | null = null;

  private importManager: ImportManager;
  private exportManager: ExportManager;
  private clipboardManager: ClipboardManager;
  private storageManager: StorageManager;

  private spacePanning: boolean = false;
  private panStartPoint: Point | null = null;
  private currentProjectId: string | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.importManager = new ImportManager();
    this.exportManager = new ExportManager();
    this.clipboardManager = new ClipboardManager();
    this.storageManager = new StorageManager();
  }

  async init(): Promise<void> {
    this.layout = new MainLayout(this.container);
    this.confirmModal = new ConfirmModal(this.layout.getElement());
    this.toastManager = new ToastManager(this.layout.getElement());
    this.unsavedModal = new UnsavedChangesModal(this.layout.getElement());
    this.renameModal = new TextInputModal(this.layout.getElement());

    this.canvasContainer = new CanvasContainer(this.layout.getCanvasArea());
    this.engine = await this.canvasContainer.init();

    const canvas = this.engine?.getCanvas();
    if (canvas) {
      this.clipboardManager.setCanvas(canvas);
      historyManager.setCanvas(canvas);
      canvasLockManager.setCanvas(canvas);
      await this.storageManager.init(canvas);

      // Check for autosave and offer to restore
      const hasAutosave = await this.storageManager.hasAutosave();
      if (hasAutosave) {
        const restore = this.confirmModal
          ? await this.confirmModal.open({
              title: 'Restore autosave?',
              message: 'We found an autosaved session from your last visit.',
              confirmLabel: 'Restore',
              cancelLabel: 'Start fresh'
            })
          : confirm('Found an autosaved session. Would you like to restore it?');

        if (restore) {
          await this.storageManager.loadAutosave();
        }
      }

      // Start autosave
      this.storageManager.startAutosave();
    }

    this.setupToolManager();
    this.setupMouseEvents();
    this.setupUI();
    this.setupCanvasEvents();

    this.toolManager?.setActiveTool(ToolType.SELECT);
  }

  private setupToolManager(): void {
    const callbacks: ToolManagerCallbacks = {
      showActionButton: () => {},
      hideActionButton: () => {},
      updateReticle: () => {}
    };

    this.toolManager = new ToolManager(callbacks);

    const canvas = this.engine?.getCanvas();
    if (canvas) {
      this.toolManager.setCanvas(canvas);
    }
  }

  private setupMouseEvents(): void {
    const canvasEl = this.canvasContainer?.getElement();
    if (!canvasEl) return;

    // Track spacebar key state
    let spacePressed = false;
    const isEditingText = (): boolean => {
      const canvas = this.engine?.getCanvas();
      if (!canvas) return false;
      const activeObj = canvas.getActiveObject();
      return activeObj?.type === 'i-text' && (activeObj as any).isEditing === true;
    };

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat) {
        // Don't intercept spacebar when editing text
        if (isEditingText()) return;
        e.preventDefault();
        spacePressed = true;
        canvasEl.style.cursor = 'grab';
      }
    }, { capture: true });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        spacePressed = false;
        canvasEl.style.cursor = '';
      }
    }, { capture: true });

    const handleSpacePanStart = (e: MouseEvent): boolean => {
      if (!spacePressed) return false;
      const canvas = this.engine?.getCanvas();
      if (!canvas) return false;

      e.preventDefault();
      e.stopPropagation();

      this.spacePanning = true;
      this.panStartPoint = new Point(e.clientX, e.clientY);
      canvasEl.style.cursor = 'grabbing';
      return true;
    };

    const handleSpacePanMove = (e: MouseEvent): boolean => {
      const canvas = this.engine?.getCanvas();
      if (!canvas || !this.spacePanning || !this.panStartPoint) return false;

      const deltaX = e.clientX - this.panStartPoint.x;
      const deltaY = e.clientY - this.panStartPoint.y;

      this.panStartPoint = new Point(e.clientX, e.clientY);

      canvas.relativePan(new Point(deltaX, deltaY));
      canvas.requestRenderAll();
      return true;
    };

    const handleSpacePanEnd = (): void => {
      if (!this.spacePanning) return;
      this.spacePanning = false;
      this.panStartPoint = null;
      canvasEl.style.cursor = spacePressed ? 'grab' : '';
    };

    canvasEl.addEventListener('mousedown', (e) => {
      const canvas = this.engine?.getCanvas();
      if (!canvas) return;

      // Blur any focused buttons/inputs to prevent spacebar triggering them
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      // Handle spacebar panning
      if (handleSpacePanStart(e)) return;

      // Get canvas coordinates using fabric's pointer method
      const pointer = canvas.getPointer(e);
      const point = new Point(pointer.x, pointer.y);
      this.toolManager?.handleMouseDown(point, e);
    });

    canvasEl.addEventListener('mousemove', (e) => {
      const canvas = this.engine?.getCanvas();
      if (!canvas) return;

      // Handle spacebar panning drag
      if (handleSpacePanMove(e)) return;

      const pointer = canvas.getPointer(e);
      const point = new Point(pointer.x, pointer.y);
      this.toolManager?.handleMouseMove(point, e);
    });

    canvasEl.addEventListener('mouseup', (e) => {
      const canvas = this.engine?.getCanvas();
      if (!canvas) return;

      const pointer = canvas.getPointer(e);
      const point = new Point(pointer.x, pointer.y);

      if (this.spacePanning) {
        handleSpacePanEnd();
        return;
      }

      this.toolManager?.handleMouseUp(point, e);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.spacePanning) {
        handleSpacePanMove(e);
      }
    });
    window.addEventListener('mouseup', () => {
      if (this.spacePanning) {
        handleSpacePanEnd();
      }
    });

    canvasEl.addEventListener('wheel', (e) => {
      e.preventDefault();

      const canvas = this.engine?.getCanvas();
      if (!canvas) return;

      const pointer = canvas.getPointer(e);
      const point = new Point(pointer.x, pointer.y);

      const fastFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const slowFactor = e.deltaY > 0 ? 0.95 : 1.05;
      const zoomFactor = (e.ctrlKey || e.metaKey) ? fastFactor : slowFactor;

      const currentZoom = canvas.getZoom();
      const newZoom = Math.min(Math.max(currentZoom * zoomFactor, 0.1), 5);

      canvas.zoomToPoint(point, newZoom);
      canvas.requestRenderAll();
    }, { passive: false });

    canvasEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    window.addEventListener('keydown', (e) => {
      // Handle Ctrl/Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        historyManager.undo();
        return;
      }
      // Handle Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'y') && e.shiftKey) {
        e.preventDefault();
        historyManager.redo();
        return;
      }
      // Handle Ctrl/Cmd+V for paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        void this.handlePasteFromClipboard();
        return;
      }
      this.toolManager?.handleKeyDown(e);
    });
  }

  private async handlePasteFromClipboard(): Promise<void> {
    try {
      const success = await this.clipboardManager.pasteFromClipboard();
      if (success) {
        console.log('Image pasted from clipboard');
      } else {
        console.error('Failed to paste image from clipboard');
      }
    } catch (error) {
      console.error('Paste error:', error);
    }
  }

  private setupUI(): void {
    if (!this.layout || !this.toolManager) return;

    const tools = this.toolManager.getAllTools();

    this.desktopSidebar = new DesktopSidebar(
      this.layout.getElement(),
      tools,
      this.handleToolSelect
    );

    // Set up file action callbacks
    const fileCallbacks: FileActionCallbacks = {
      onImport: () => this.handleImport(),
      onExportPNG: () => this.handleExportPNG(),
      onExportJPG: () => this.handleExportJPG(),
      onExportPDF: () => this.handleExportPDF(),
      onCopyToClipboard: () => this.handleCopyToClipboard()
    };

    // Set up stroke/color callbacks
    const strokeCallbacks: StrokeColorCallbacks = {
      onStrokeColorChange: (color: string) => {
        this.toolManager?.setConfig({ strokeColor: color });
      },
      onStrokeWidthChange: (width: number) => {
        this.toolManager?.setConfig({ strokeWidth: width });
      }
    };

    this.desktopSidebar.setFileCallbacks(fileCallbacks);
    this.desktopSidebar.setStrokeCallbacks(strokeCallbacks);
    this.desktopSidebar.setSnapCallbacks({
      onSnapToggle: (enabled: boolean) => {
        snapManager.setEnabled(enabled);
      }
    });
    this.desktopSidebar.setSnapEnabled(snapManager.isEnabled());

    // Set up canvas lock callbacks
    const canvasLockCallbacks: CanvasLockCallbacks = {
      onUnlockCanvas: () => {
        canvasLockManager.unlock();
      }
    };
    this.desktopSidebar.setCanvasLockCallbacks(canvasLockCallbacks);

    // Subscribe to canvas lock changes
    canvasLockManager.subscribe((state) => {
      this.desktopSidebar?.updateCanvasLockStatus(state.locked);
    });

    // Set up edit action callbacks
    const editCallbacks: EditActionCallbacks = {
      onUndo: () => {
        const canvas = this.engine?.getCanvas();
        if (canvas && historyManager.undo()) {
          canvas.renderAll();
          this.desktopSidebar?.updateUndoRedoButtons(
            historyManager.canUndo(),
            historyManager.canRedo()
          );
        }
      },
      onRedo: () => {
        const canvas = this.engine?.getCanvas();
        if (canvas && historyManager.redo()) {
          canvas.renderAll();
          this.desktopSidebar?.updateUndoRedoButtons(
            historyManager.canUndo(),
            historyManager.canRedo()
          );
        }
      },
      onClearAll: async () => {
        const confirmed = this.confirmModal
          ? await this.confirmModal.open({
              title: 'Clear all drawings?',
              message: 'This cannot be undone.',
              confirmLabel: 'Clear All',
              cancelLabel: 'Cancel',
              tone: 'danger'
            })
          : confirm('Clear all drawings? This cannot be undone.');

        if (!confirmed) return;

        const canvas = this.engine?.getCanvas();
        if (canvas) {
          canvas.clear();
          historyManager.clear();
          this.desktopSidebar?.updateUndoRedoButtons(false, false);
        }
      }
    };

    this.desktopSidebar.setEditCallbacks(editCallbacks);

    // Set up settings callbacks
    this.settingsModal = new SettingsModal(this.layout.getElement());
    this.settingsModal.setCallbacks({
      onDefaultStrokeColorChange: (color) => {
        // Update the current stroke color to match the new default
        this.toolManager?.setConfig({ strokeColor: color });
        this.desktopSidebar?.setStrokeColor(color);
      },
      onDefaultStrokeWidthChange: (width) => {
        // Update the current stroke width to match the new default
        this.toolManager?.setConfig({ strokeWidth: width });
        this.desktopSidebar?.setStrokeWidth(width);
      },
      onDefaultFontChange: (font) => {
        // Update the current font to match the new default
        this.toolManager?.setConfig({ fontFamily: font });
      }
    });
    const settingsCallbacks: SettingsCallbacks = {
      onSettingsOpen: () => this.settingsModal?.open()
    };
    this.desktopSidebar.setSettingsCallbacks(settingsCallbacks);

    // Initialize tool manager with default settings
    const defaultSettings = settingsManager.getSettings();
    this.toolManager?.setConfig({
      strokeColor: defaultSettings.defaultStrokeColor,
      strokeWidth: defaultSettings.defaultStrokeWidth,
      fontFamily: defaultSettings.defaultFont
    });

    // Update sidebar UI with saved default values
    this.desktopSidebar?.setStrokeColor(defaultSettings.defaultStrokeColor);
    this.desktopSidebar?.setStrokeWidth(defaultSettings.defaultStrokeWidth);

    const propertyCallbacks = {
      onStrokeColorChange: (color: string) => {
        this.updateSelectedObjectProperty('stroke', color);
      },
      onStrokeWidthChange: (width: number) => {
        this.updateSelectedObjectProperty('strokeWidth', width);
      },
      onFillColorChange: (color: string) => {
        this.updateSelectedObjectProperty('fill', color);
      },
      onFontSizeChange: (size: number) => {
        this.updateSelectedObjectProperty('fontSize', size);
      },
      onFontFamilyChange: (fontFamily: string) => {
        this.updateSelectedObjectProperty('fontFamily', fontFamily);
      },
      onImageLockChange: (locked: boolean) => {
        this.updateSelectedObjectLock(locked);
      },
      onLockCanvasToImage: () => {
        this.lockCanvasToSelectedImage();
      }
    };

    this.propertiesPanel = new PropertiesPanel(
      this.layout.getElement(),
      propertyCallbacks
    );
    if (this.toastManager) {
      this.propertiesPanel.setToastManager(this.toastManager);
    }
    if (this.confirmModal) {
      this.propertiesPanel.setConfirmModal(this.confirmModal);
    }
    if (this.renameModal) {
      this.propertiesPanel.setRenameModal(this.renameModal);
    }

    // Set up project callbacks
    const projectCallbacks: ProjectCallbacks = {
      onNewProject: async () => {
        const proceed = await this.handleUnsavedBeforeOpen();
        if (!proceed) return;
        await this.newProject();
      },
      onSaveProject: (name: string) => this.saveProject(name),
      onRenameProject: (id: string, name: string) => this.renameProject(id, name),
      onLoadProject: async (id: string) => {
        const proceed = await this.handleUnsavedBeforeOpen();
        if (!proceed) return false;
        return this.loadProject(id);
      },
      onLoadAutosave: async () => {
        const proceed = await this.handleUnsavedBeforeOpen();
        if (!proceed) return false;
        const success = await this.storageManager.loadAutosave();
        if (success) {
          this.currentProjectId = null;
          historyManager.clear();
        }
        return success;
      },
      getAutosaveInfo: () => this.storageManager.getAutosaveInfo(),
      onDeleteProject: (id: string) => this.deleteProject(id),
      onListProjects: () => this.listProjects(),
      getCurrentProjectId: () => this.getCurrentProjectId()
    };
    this.propertiesPanel.setProjectCallbacks(projectCallbacks);

    this.toolManager.on('tool:changed', (tool) => {
      this.desktopSidebar?.setActiveTool(tool.type);
    });
  }

  private setupCanvasEvents(): void {
    const canvas = this.engine?.getCanvas();
    if (!canvas) return;

    this.engine?.on('selection:changed', (objects) => {
      const selectedObject = objects[0] ?? null;
      this.propertiesPanel?.updateContent(selectedObject);
    });
  }

  private handleToolSelect = (type: ToolType): void => {
    this.toolManager?.setActiveTool(type);
  };

  private handleImport = async (): Promise<void> => {
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.json,.pdf,application/pdf';
    
    input.onchange = async (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      const file = files[0];
      const canvas = this.engine?.getCanvas();
      if (!canvas) return;

      try {
        const result = await this.importManager.import(canvas, file);
        if (result.success) {
          console.log('Import successful');
          canvas.requestRenderAll();
        } else {
          console.error('Import failed');
        }
      } catch (error) {
        console.error('Import error:', error);
      }
    };

    input.click();
  };

  private handleExportPNG = async (): Promise<void> => {
    const canvas = this.engine?.getCanvas();
    if (!canvas) return;

    // Use locked region if canvas is locked
    if (canvasLockManager.isLocked()) {
      const dataUrl = canvasLockManager.toDataURL({ format: 'png', quality: 1, multiplier: 4 });
      this.downloadDataUrl(dataUrl, 'elmap-export.png');
      return;
    }

    const options: ExportOptions = {
      format: ExportFormat.PNG,
      quality: 1,
      scale: 4
    };

    await this.exportManager.export(canvas, options, 'elmap-export');
  };

  private handleExportJPG = async (): Promise<void> => {
    const canvas = this.engine?.getCanvas();
    if (!canvas) return;

    // Use locked region if canvas is locked
    if (canvasLockManager.isLocked()) {
      const dataUrl = canvasLockManager.toDataURL({ format: 'jpeg', quality: 0.95, multiplier: 4 });
      this.downloadDataUrl(dataUrl, 'elmap-export.jpg');
      return;
    }

    const options: ExportOptions = {
      format: ExportFormat.JPEG,
      quality: 0.95,
      scale: 4
    };

    await this.exportManager.export(canvas, options, 'elmap-export');
  };

  private handleExportPDF = async (): Promise<void> => {
    const canvas = this.engine?.getCanvas();
    if (!canvas) return;

    // Use locked region if canvas is locked
    if (canvasLockManager.isLocked()) {
      const lockedState = canvasLockManager.getLockedState();
      const dataUrl = canvasLockManager.toDataURL({ format: 'png', quality: 1, multiplier: 2 });

      const width = lockedState.width;
      const height = lockedState.height;
      const orientation = width > height ? 'landscape' : 'portrait';

      const pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [width, height]
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
      const blob = pdf.output('blob');

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'elmap-export.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return;
    }

    const options: ExportOptions = {
      format: ExportFormat.PDF,
      quality: 1,
      scale: 2
    };

    await this.exportManager.export(canvas, options, 'elmap-export');
  };

  private handleCopyToClipboard = async (): Promise<void> => {
    try {
      const canvas = this.engine?.getCanvas();
      if (!canvas) return;

      // Use locked region if canvas is locked
      const dataUrl = canvasLockManager.isLocked()
        ? canvasLockManager.toDataURL({ format: 'png', quality: 1, multiplier: 4 })
        : canvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: 4
          });

      // Convert data URL to blob synchronously to avoid focus issues
      const blob = this.dataUrlToBlob(dataUrl);

      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob
        })
      ]);

      console.log('Image copied to clipboard');
      this.toastManager?.showCopyToast(dataUrl);
    } catch (error) {
      console.error('Clipboard copy error:', error);
    }
  };

  private dataUrlToBlob(dataUrl: string): Blob {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    const binary = atob(parts[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
  }

  private downloadDataUrl(dataUrl: string, filename: string): void {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private updateSelectedObjectProperty(property: string, value: unknown): void {
    const canvas = this.engine?.getCanvas();
    if (!canvas) return;

    const activeObjects = canvas.getActiveObjects();
    activeObjects.forEach((obj) => {
      obj.set(property as keyof typeof obj, value);
    });
    canvas.requestRenderAll();
  }

  private updateSelectedObjectLock(locked: boolean): void {
    const canvas = this.engine?.getCanvas();
    if (!canvas) return;

    const activeObjects = canvas.getActiveObjects();
    activeObjects.forEach((obj) => {
      if (obj.type !== 'image') return;
      canvasLockManager.ensureImageId(obj as any);
      obj.set({
        __elsLocked: locked,
        lockMovementX: locked,
        lockMovementY: locked,
        lockScalingX: locked,
        lockScalingY: locked,
        lockRotation: locked,
        hasControls: !locked
      });
    });

    canvas.requestRenderAll();
  }

  private lockCanvasToSelectedImage(): void {
    const canvas = this.engine?.getCanvas();
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (!activeObject || activeObject.type !== 'image') return;

    // Lock the canvas to the selected image
    canvasLockManager.lockToImage(activeObject as any);
  }

  destroy(): void {
    this.storageManager?.dispose();
    this.engine?.dispose();
    this.layout?.destroy();
    this.desktopSidebar?.destroy();
    this.propertiesPanel?.destroy();
    this.settingsModal?.destroy();
  }

  // Project management methods
  async saveProject(name: string): Promise<boolean> {
    const id = this.currentProjectId ?? `project-${Date.now()}`;
    const success = await this.storageManager.saveProject(id, name);
    if (success) {
      this.currentProjectId = id;
      historyManager.markClean();
    }
    return success;
  }

  async loadProject(id: string): Promise<boolean> {
    const success = await this.storageManager.loadProject(id);
    if (success) {
      this.currentProjectId = id;
      historyManager.clear();
    }
    return success;
  }

  async listProjects(): Promise<Array<{ id: string; name: string; modifiedAt: number }>> {
    return this.storageManager.listProjects();
  }

  async deleteProject(id: string): Promise<boolean> {
    const success = await this.storageManager.deleteProject(id);
    if (success && this.currentProjectId === id) {
      this.currentProjectId = null;
    }
    return success;
  }

  async renameProject(id: string, name: string): Promise<boolean> {
    return this.storageManager.renameProject(id, name);
  }

  async newProject(): Promise<void> {
    const canvas = this.engine?.getCanvas();
    if (canvas) {
      canvas.clear();
      historyManager.clear();
      this.currentProjectId = null;
      await this.storageManager.clearAutosave();
    }
  }

  getCurrentProjectId(): string | null {
    return this.currentProjectId;
  }

  private async handleUnsavedBeforeOpen(): Promise<boolean> {
    if (!historyManager.getIsDirty()) return true;
    if (this.isCanvasEmpty()) return true;

    let choice: UnsavedChoice = 'cancel';
    if (this.unsavedModal) {
      choice = await this.unsavedModal.open();
    } else {
      choice = confirm('Save changes before continuing?') ? 'save' : 'discard';
    }

    if (choice === 'cancel') return false;
    if (choice === 'discard') return true;

    return this.saveCurrentProjectForPrompt();
  }

  private isCanvasEmpty(): boolean {
    const canvas = this.engine?.getCanvas();
    if (!canvas) return true;
    return canvas.getObjects().every((obj) => (obj as any).isHelper);
  }

  private async saveCurrentProjectForPrompt(): Promise<boolean> {
    const currentId = this.currentProjectId;
    let name = 'Untitled Project';

    if (currentId) {
      const projects = await this.storageManager.listProjects();
      const existing = projects.find((p) => p.id === currentId);
      name = existing?.name ?? name;
    } else {
      const inputName = prompt('Project name:', name);
      if (!inputName) return false;
      name = inputName;
    }

    return this.saveProject(name);
  }
}
