import { FabricImage, type Canvas } from 'fabric';
import type { ImportOptions } from '@/types';
import { canvasLockManager } from '@/canvas';
import { convertToGrayscale } from './grayscaleUtils';

export class ImageImporter {
  async import(
    canvas: Canvas,
    file: File,
    options?: ImportOptions
  ): Promise<boolean> {
    try {
      let dataUrl = await this.fileToDataUrl(file);

      // Convert to grayscale if requested
      if (options?.grayscale) {
        dataUrl = await convertToGrayscale(dataUrl);
      }

      const img = await FabricImage.fromURL(dataUrl);
      canvasLockManager.ensureImageId(img);

      if (options?.maxWidth || options?.maxHeight) {
        this.scaleImage(img, options);
      }

      const canvasCenter = canvas.getCenterPoint();
      img.set({
        left: canvasCenter.x,
        top: canvasCenter.y,
        originX: 'center',
        originY: 'center'
      });

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();

      // Lock canvas to this image if auto-lock is enabled
      if (canvasLockManager.isAutoLockEnabled()) {
        canvasLockManager.lockToImage(img);
      }

      return true;
    } catch (error) {
      console.error('Image import failed:', error);
      return false;
    }
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  private scaleImage(img: FabricImage, options: ImportOptions): void {
    const maxWidth = options.maxWidth ?? Infinity;
    const maxHeight = options.maxHeight ?? Infinity;

    const imgWidth = img.width ?? 1;
    const imgHeight = img.height ?? 1;

    let scale = 1;

    if (imgWidth > maxWidth) {
      scale = Math.min(scale, maxWidth / imgWidth);
    }

    if (imgHeight > maxHeight) {
      scale = Math.min(scale, maxHeight / imgHeight);
    }

    if (scale < 1) {
      img.scale(scale);
    }
  }
}
