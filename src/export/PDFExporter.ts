import type { Canvas } from 'fabric';
import { jsPDF } from 'jspdf';
import type { ExportOptions, ExportResult } from '@/types';

export class PDFExporter {
  async export(canvas: Canvas, options: ExportOptions): Promise<ExportResult> {
    try {
      const multiplier = options.scale ?? 2;

      const dataUrl = canvas.toDataURL({
        format: 'png',
        multiplier
      });

      const width = canvas.getWidth();
      const height = canvas.getHeight();

      const orientation = width > height ? 'landscape' : 'portrait';

      const pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [width, height]
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);

      const blob = pdf.output('blob');

      return {
        success: true,
        data: blob,
        filename: 'els-maps-export.pdf'
      };
    } catch (error) {
      return {
        success: false,
        filename: '',
        error: error instanceof Error ? error.message : 'PDF export failed'
      };
    }
  }

  downloadBlob(blob: Blob, filename: string): void {
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
