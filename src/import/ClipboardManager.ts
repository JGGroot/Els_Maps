import { FabricImage, type Canvas } from 'fabric';
import { canvasLockManager } from '@/canvas';
import { convertToGrayscale } from './grayscaleUtils';

export interface ClipboardImportOptions {
  grayscale?: boolean;
}

export type ImportOptionsCallback = () => Promise<ClipboardImportOptions | null>;

export class ClipboardManager {
  private canvas: Canvas | null = null;
  private getImportOptions: ImportOptionsCallback | null = null;

  setCanvas(canvas: Canvas): void {
    this.canvas = canvas;
    canvasLockManager.setCanvas(canvas);
  }

  setImportOptionsCallback(callback: ImportOptionsCallback): void {
    this.getImportOptions = callback;
  }

  async pasteFromClipboard(): Promise<boolean> {
    if (!this.canvas) return false;

    try {
      const clipboardItems = await navigator.clipboard.read();

      for (const item of clipboardItems) {
        // Check for image types
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);

          // Get import options from callback (shows modal)
          let options: ClipboardImportOptions = {};
          if (this.getImportOptions) {
            const result = await this.getImportOptions();
            if (result === null) {
              // User cancelled
              return false;
            }
            options = result;
          }

          return await this.addImageToCanvas(blob, options);
        }
      }

      return false;
    } catch (error) {
      // Fallback for browsers that don't support clipboard.read()
      console.warn('Clipboard API not available, trying fallback');
      return false;
    }
  }

  async copyToClipboard(): Promise<boolean> {
    if (!this.canvas) return false;

    try {
      const dataUrl = this.canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 1
      });

      const response = await fetch(dataUrl);
      const blob = await response.blob();

      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob
        })
      ]);

      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }

  private async addImageToCanvas(blob: Blob, options: ClipboardImportOptions = {}): Promise<boolean> {
    if (!this.canvas) return false;

    try {
      let dataUrl = await this.blobToDataUrl(blob);

      // Convert to grayscale if requested
      if (options.grayscale) {
        dataUrl = await convertToGrayscale(dataUrl);
      }

      const img = await FabricImage.fromURL(dataUrl);
      canvasLockManager.ensureImageId(img);

      // No scaling - preserve full original quality for lossless workflow

      // Center on canvas
      const canvasCenter = this.canvas.getCenterPoint();
      img.set({
        left: canvasCenter.x,
        top: canvasCenter.y,
        originX: 'center',
        originY: 'center'
      });

      this.canvas.add(img);
      this.canvas.setActiveObject(img);
      this.canvas.requestRenderAll();

      // Lock canvas to this image if auto-lock is enabled
      if (canvasLockManager.isAutoLockEnabled()) {
        canvasLockManager.lockToImage(img);
      }

      return true;
    } catch (error) {
      console.error('Failed to paste image:', error);
      return false;
    }
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    });
  }

  setupPasteListener(element: HTMLElement): () => void {
    const handler = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            // Get import options from callback (shows modal)
            let options: ClipboardImportOptions = {};
            if (this.getImportOptions) {
              const result = await this.getImportOptions();
              if (result === null) {
                // User cancelled
                return;
              }
              options = result;
            }
            await this.addImageToCanvas(blob, options);
          }
          return;
        }
      }
    };

    element.addEventListener('paste', handler);
    return () => element.removeEventListener('paste', handler);
  }
}
