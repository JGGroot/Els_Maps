import { FabricImage, type Canvas } from 'fabric';
import * as pdfjsLib from 'pdfjs-dist';
import { canvasLockManager } from '@/canvas';
import { convertCanvasToGrayscale } from './grayscaleUtils';

// Set up the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export interface PDFImportOptions {
  pageNumber?: number;
  scale?: number; // DPI scale factor (1 = 72 DPI, 2 = 144 DPI, etc.)
  grayscale?: boolean;
}

export interface PDFPageInfo {
  pageNumber: number;
  width: number;
  height: number;
}

export class PDFImporter {
  private currentPdf: pdfjsLib.PDFDocumentProxy | null = null;

  async loadPDF(file: File): Promise<{ numPages: number; pages: PDFPageInfo[] }> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    this.currentPdf = pdf;

    const pages: PDFPageInfo[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      pages.push({
        pageNumber: i,
        width: viewport.width,
        height: viewport.height
      });
    }

    return {
      numPages: pdf.numPages,
      pages
    };
  }

  async importPage(
    canvas: Canvas,
    pageNumber: number = 1,
    options: PDFImportOptions = {}
  ): Promise<boolean> {
    if (!this.currentPdf) {
      console.error('No PDF loaded. Call loadPDF first.');
      return false;
    }

    try {
      const scale = options.scale ?? 2; // Default to 144 DPI (2x)
      const page = await this.currentPdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      // Create a canvas to render the PDF page
      const renderCanvas = document.createElement('canvas');
      const context = renderCanvas.getContext('2d');
      if (!context) {
        console.error('Failed to get canvas context');
        return false;
      }

      renderCanvas.width = viewport.width;
      renderCanvas.height = viewport.height;

      // Render the PDF page
      await page.render({
        canvasContext: context,
        viewport,
        canvas: renderCanvas
      } as any).promise;

      // Convert to grayscale if requested
      if (options.grayscale) {
        convertCanvasToGrayscale(context, renderCanvas.width, renderCanvas.height);
      }

      // Convert to data URL and create Fabric image
      const dataUrl = renderCanvas.toDataURL('image/png', 1.0);
      const img = await FabricImage.fromURL(dataUrl);
      canvasLockManager.ensureImageId(img);

      // Center on canvas
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

      return true;
    } catch (error) {
      console.error('PDF import failed:', error);
      return false;
    }
  }

  async importFromFile(
    canvas: Canvas,
    file: File,
    options: PDFImportOptions = {}
  ): Promise<boolean> {
    try {
      await this.loadPDF(file);
      return await this.importPage(canvas, options.pageNumber ?? 1, options);
    } catch (error) {
      console.error('PDF import failed:', error);
      return false;
    }
  }

  getNumPages(): number {
    return this.currentPdf?.numPages ?? 0;
  }

  dispose(): void {
    this.currentPdf?.destroy();
    this.currentPdf = null;
  }
}
