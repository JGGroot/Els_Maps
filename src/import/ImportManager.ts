import type { Canvas } from 'fabric';
import type { ImportOptions, ProjectData } from '@/types';
import { ImageImporter } from './ImageImporter';
import { JSONImporter } from './JSONImporter';
import { PDFImporter, type PDFImportOptions } from './PDFImporter';

export class ImportManager {
  private imageImporter: ImageImporter;
  private jsonImporter: JSONImporter;
  private pdfImporter: PDFImporter;

  constructor() {
    this.imageImporter = new ImageImporter();
    this.jsonImporter = new JSONImporter();
    this.pdfImporter = new PDFImporter();
  }

  async import(
    canvas: Canvas,
    file: File,
    options?: ImportOptions
  ): Promise<{ success: boolean; projectData?: ProjectData }> {
    const fileType = this.getFileType(file);

    switch (fileType) {
      case 'image':
        const imageSuccess = await this.imageImporter.import(canvas, file, options);
        return { success: imageSuccess };

      case 'json':
        const projectData = await this.jsonImporter.import(canvas, file);
        return { success: projectData !== null, projectData: projectData ?? undefined };

      case 'pdf':
        const pdfSuccess = await this.importPDF(canvas, file);
        return { success: pdfSuccess };

      default:
        return { success: false };
    }
  }

  async importPDF(
    canvas: Canvas,
    file: File,
    options?: PDFImportOptions
  ): Promise<boolean> {
    try {
      const pdfInfo = await this.pdfImporter.loadPDF(file);

      if (pdfInfo.numPages === 1) {
        // Single page - import directly
        return await this.pdfImporter.importPage(canvas, 1, options);
      }

      // Multiple pages - show page selector
      return new Promise((resolve) => {
        this.showPDFPageSelector(canvas, pdfInfo, options, resolve);
      });
    } catch (error) {
      console.error('PDF import failed:', error);
      return false;
    }
  }

  private showPDFPageSelector(
    canvas: Canvas,
    pdfInfo: { numPages: number; pages: Array<{ pageNumber: number; width: number; height: number }> },
    options: PDFImportOptions | undefined,
    resolve: (success: boolean) => void
  ): void {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4';

    const dialog = document.createElement('div');
    dialog.className = 'bg-surface rounded-lg p-6 max-w-sm w-full';

    dialog.innerHTML = `
      <h3 class="text-lg font-semibold text-foreground mb-4">Select PDF Page</h3>
      <p class="text-textMuted text-sm mb-4">This PDF has ${pdfInfo.numPages} pages. Select which page to import:</p>
      <div class="mb-4">
        <label class="block text-sm text-textMuted mb-2">Page Number</label>
        <select id="pdf-page-select" class="w-full bg-charcoal border border-border rounded px-3 py-2 text-foreground">
          ${pdfInfo.pages.map(p => `<option value="${p.pageNumber}">Page ${p.pageNumber} (${Math.round(p.width)}x${Math.round(p.height)})</option>`).join('')}
        </select>
      </div>
      <div class="mb-4">
        <label class="block text-sm text-textMuted mb-2">Quality (DPI Scale)</label>
        <select id="pdf-scale-select" class="w-full bg-charcoal border border-border rounded px-3 py-2 text-foreground">
          <option value="1">72 DPI (Fast, Lower Quality)</option>
          <option value="2" selected>144 DPI (Recommended)</option>
          <option value="3">216 DPI (High Quality)</option>
          <option value="4">288 DPI (Very High Quality)</option>
        </select>
      </div>
      <div class="flex gap-2">
        <button id="pdf-cancel-btn" class="flex-1 bg-charcoal-light hover:bg-charcoal-lighter text-foreground py-2 rounded transition-colors">Cancel</button>
        <button id="pdf-import-btn" class="flex-1 bg-accent hover:bg-accent/80 text-white py-2 rounded transition-colors">Import</button>
      </div>
    `;

    modal.appendChild(dialog);
    document.body.appendChild(modal);

    const pageSelect = dialog.querySelector('#pdf-page-select') as HTMLSelectElement;
    const scaleSelect = dialog.querySelector('#pdf-scale-select') as HTMLSelectElement;
    const cancelBtn = dialog.querySelector('#pdf-cancel-btn') as HTMLButtonElement;
    const importBtn = dialog.querySelector('#pdf-import-btn') as HTMLButtonElement;

    const closeModal = () => {
      modal.remove();
    };

    cancelBtn.addEventListener('click', () => {
      closeModal();
      resolve(false);
    });

    importBtn.addEventListener('click', async () => {
      const pageNumber = parseInt(pageSelect.value, 10);
      const scale = parseInt(scaleSelect.value, 10);

      closeModal();

      const success = await this.pdfImporter.importPage(canvas, pageNumber, {
        ...options,
        scale
      });
      resolve(success);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
        resolve(false);
      }
    });
  }

  private getFileType(file: File): 'image' | 'json' | 'pdf' | 'unknown' {
    const mimeType = file.type.toLowerCase();
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension ?? '')) {
      return 'image';
    }

    if (mimeType === 'application/json' || extension === 'json') {
      return 'json';
    }

    if (mimeType === 'application/pdf' || extension === 'pdf') {
      return 'pdf';
    }

    return 'unknown';
  }

  createFileInput(
    canvas: Canvas,
    options?: ImportOptions
  ): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.json,.elmap.json,.pdf,application/pdf';

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (file) {
        await this.import(canvas, file, options);
      }
    });

    return input;
  }

  triggerFileSelect(canvas: Canvas, options?: ImportOptions): void {
    const input = this.createFileInput(canvas, options);
    input.click();
  }
}
