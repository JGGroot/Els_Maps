import type { Canvas } from 'fabric';
import { ExportFormat, type ExportOptions, type ExportResult } from '@/types';
import { ImageExporter } from './ImageExporter';
import { PDFExporter } from './PDFExporter';
import { JSONExporter } from './JSONExporter';

export class ExportManager {
  private imageExporter: ImageExporter;
  private pdfExporter: PDFExporter;
  private jsonExporter: JSONExporter;

  constructor() {
    this.imageExporter = new ImageExporter();
    this.pdfExporter = new PDFExporter();
    this.jsonExporter = new JSONExporter();
  }

  async export(
    canvas: Canvas,
    options: ExportOptions,
    projectName?: string
  ): Promise<ExportResult> {
    let result: ExportResult;

    switch (options.format) {
      case ExportFormat.PNG:
      case ExportFormat.JPEG:
        result = await this.imageExporter.export(canvas, options);
        break;
      case ExportFormat.PDF:
        result = await this.pdfExporter.export(canvas, options);
        break;
      case ExportFormat.JSON:
        result = this.jsonExporter.export(canvas, projectName);
        break;
      default:
        return {
          success: false,
          filename: '',
          error: 'Unsupported export format'
        };
    }

    if (result.success && result.data instanceof Blob) {
      this.downloadFile(result.data, result.filename);
    }

    return result;
  }

  private downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

}
