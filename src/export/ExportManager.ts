import type { Canvas } from 'fabric';
import { ExportFormat, type ExportOptions, type ExportResult } from '@/types';
import { ImageExporter } from './ImageExporter';
import { PDFExporter } from './PDFExporter';
import { JSONExporter } from './JSONExporter';
import { isIOSDevice } from '@/utils';

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
      if (isIOSDevice()) {
        this.showIOSSaveModal(result.data, result.filename);
      } else {
        this.downloadFile(result.data, result.filename);
      }
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

  private showIOSSaveModal(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-modal p-4';
    modal.innerHTML = `
      <div class="bg-surface rounded-lg p-6 max-w-sm w-full">
        <h3 class="text-lg font-semibold text-foreground mb-4">Save File</h3>
        <p class="text-textMuted mb-4">
          Long press the link below and select "Download Linked File" to save.
        </p>
        <a
          href="${url}"
          download="${filename}"
          class="block w-full bg-accent text-white text-center py-3 rounded-lg mb-4"
        >
          ${filename}
        </a>
        <button
          class="w-full bg-charcoal-light text-foreground py-2 rounded-lg"
          id="close-modal"
        >
          Close
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('#close-modal');
    closeBtn?.addEventListener('click', () => {
      URL.revokeObjectURL(url);
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        URL.revokeObjectURL(url);
        modal.remove();
      }
    });
  }
}
