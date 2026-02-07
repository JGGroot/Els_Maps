import { Point } from 'fabric';
import { CanvasEngine } from '@/canvas';
import { GestureManager, type GestureManagerCallbacks } from '@/gestures';
import { ToolManager, type ToolManagerCallbacks } from '@/tools';
import { ToolType, type ActionButtonMode } from '@/types';
import { isMobileDevice, historyManager, snapManager } from '@/utils';
import { MainLayout } from './layout/MainLayout';
import { DesktopSidebar, type FileActionCallbacks, type StrokeColorCallbacks, type EditActionCallbacks } from './layout/DesktopSidebar';
import { MobileToolbar } from './layout/MobileToolbar';
import { PropertiesPanel } from './layout/PropertiesPanel';
import { BottomSheet } from './layout/BottomSheet';
import { CanvasContainer } from './canvas/CanvasContainer';
import { Reticle } from './canvas/Reticle';
import { ActionButton } from './controls/ActionButton';
import { ImportManager } from '@/import';
import { ExportManager } from '@/export';
import { ClipboardManager } from '@/import';
import { ExportFormat, type ExportOptions } from '@/types';

export class App {
  private container: HTMLElement;
  private layout: MainLayout | null = null;
  private canvasContainer: CanvasContainer | null = null;
  private engine: CanvasEngine | null = null;
  private gestureManager: GestureManager | null = null;
  private toolManager: ToolManager | null = null;

  private desktopSidebar: DesktopSidebar | null = null;
  private mobileToolbar: MobileToolbar | null = null;
  private propertiesPanel: PropertiesPanel | null = null;
  private bottomSheet: BottomSheet | null = null;
  private reticle: Reticle | null = null;
  private actionButton: ActionButton | null = null;

  private importManager: ImportManager;
  private exportManager: ExportManager;
  private clipboardManager: ClipboardManager;

  private spacePanning: boolean = false;
  private panStartPoint: Point | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.importManager = new ImportManager();
    this.exportManager = new ExportManager();
    this.clipboardManager = new ClipboardManager();
  }

  async init(): Promise<void> {
    this.layout = new MainLayout(this.container);

    this.canvasContainer = new CanvasContainer(this.layout.getCanvasArea());
    this.engine = await this.canvasContainer.init();

    const canvas = this.engine?.getCanvas();
    if (canvas) {
      this.clipboardManager.setCanvas(canvas);
      historyManager.setCanvas(canvas);
    }

    this.setupToolManager();
    this.setupGestureManager();
    this.setupUI();
    this.setupCanvasEvents();

    this.toolManager?.setActiveTool(ToolType.SELECT);
  }

  private setupToolManager(): void {
    const callbacks: ToolManagerCallbacks = {
      showActionButton: (mode: ActionButtonMode) => this.actionButton?.show(mode),
      hideActionButton: () => this.actionButton?.hide(),
      updateReticle: (x: number, y: number, visible: boolean) =>
        this.reticle?.update(x, y, visible)
    };

    this.toolManager = new ToolManager(callbacks);

    const canvas = this.engine?.getCanvas();
    if (canvas) {
      this.toolManager.setCanvas(canvas);
    }
  }

  private setupGestureManager(): void {
    if (!this.canvasContainer || !this.engine || !this.toolManager) return;

    const callbacks: GestureManagerCallbacks = {
      onTap: (point) => {
        this.toolManager?.handleTouchStart(point);
        this.toolManager?.handleTouchEnd(point);
      },
      onDragStart: (point) => {
        this.toolManager?.handleTouchStart(point);
      },
      onDragMove: (point, _delta) => {
        this.toolManager?.handleTouchMove(point);
      },
      onDragEnd: (point) => {
        this.toolManager?.handleTouchEnd(point);
      }
    };

    this.gestureManager = new GestureManager(
      this.canvasContainer.getElement(),
      this.engine,
      callbacks
    );

    this.setupMouseEvents();
  }

  private setupMouseEvents(): void {
    const canvasEl = this.canvasContainer?.getElement();
    if (!canvasEl) return;

    // Track spacebar key state
    let spacePressed = false;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat) {
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
    const isMobile = isMobileDevice();

    this.desktopSidebar = new DesktopSidebar(
      this.layout.getElement(),
      tools,
      this.handleToolSelect
    );

    this.mobileToolbar = new MobileToolbar(
      this.layout.getElement(),
      tools,
      this.handleToolSelect
    );

    // Set up file action callbacks
    const fileCallbacks: FileActionCallbacks = {
      onImport: () => this.handleImport(),
      onExportPNG: () => this.handleExportPNG(),
      onExportJPG: () => this.handleExportJPG(),
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
    this.mobileToolbar.setFileCallbacks(fileCallbacks);

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
      onClearAll: () => {
        const canvas = this.engine?.getCanvas();
        if (canvas) {
          canvas.clear();
          historyManager.clear();
          this.desktopSidebar?.updateUndoRedoButtons(false, false);
        }
      }
    };

    this.desktopSidebar.setEditCallbacks(editCallbacks);

    const propertyCallbacks = {
      onStrokeColorChange: (color: string) => {
        this.updateSelectedObjectProperty('stroke', color);
      },
      onStrokeWidthChange: (width: number) => {
        this.updateSelectedObjectProperty('strokeWidth', width);
      },
      onImageLockChange: (locked: boolean) => {
        this.updateSelectedObjectLock(locked);
      }
    };

    this.propertiesPanel = new PropertiesPanel(
      this.layout.getElement(),
      propertyCallbacks
    );

    this.bottomSheet = new BottomSheet(
      this.layout.getElement(),
      propertyCallbacks
    );

    if (isMobile) {
      this.reticle = new Reticle(this.layout.getElement());
      this.actionButton = new ActionButton(this.layout.getElement(), {
        onConfirm: () => this.toolManager?.handleActionConfirm(),
        onCancel: () => this.toolManager?.handleActionCancel()
      });
    }

    this.toolManager.on('tool:changed', (tool) => {
      this.desktopSidebar?.setActiveTool(tool.type);
      this.mobileToolbar?.setActiveTool(tool.type);
    });
  }

  private setupCanvasEvents(): void {
    const canvas = this.engine?.getCanvas();
    if (!canvas) return;

    this.engine?.on('selection:changed', (objects) => {
      const selectedObject = objects[0] ?? null;
      this.propertiesPanel?.updateContent(selectedObject);
      this.bottomSheet?.updateContent(selectedObject);

      if (selectedObject && isMobileDevice()) {
        this.bottomSheet?.showForSelection(selectedObject);
      }
    });
  }

  private handleToolSelect = (type: ToolType): void => {
    this.toolManager?.setActiveTool(type);
  };

  private handleImport = async (): Promise<void> => {
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.json';
    
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

    const options: ExportOptions = {
      format: ExportFormat.JPEG,
      quality: 0.95,
      scale: 4
    };

    await this.exportManager.export(canvas, options, 'elmap-export');
  };

  private handleCopyToClipboard = async (): Promise<void> => {
    try {
      const canvas = this.engine?.getCanvas();
      if (!canvas) return;

      const dataUrl = canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 4
      });

      const response = await fetch(dataUrl);
      const blob = await response.blob();

      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob
        })
      ]);

      console.log('Image copied to clipboard');
    } catch (error) {
      console.error('Clipboard copy error:', error);
    }
  };

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
      obj.set({
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

  destroy(): void {
    this.gestureManager?.dispose();
    this.engine?.dispose();
    this.layout?.destroy();
    this.desktopSidebar?.destroy();
    this.mobileToolbar?.destroy();
    this.propertiesPanel?.destroy();
    this.bottomSheet?.destroy();
    this.reticle?.destroy();
    this.actionButton?.destroy();
  }
}
