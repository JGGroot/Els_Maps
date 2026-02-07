import type { Canvas } from 'fabric';
import { ExportFormat, type ExportOptions, type ExportResult } from '@/types';

export class ImageExporter {
  async export(canvas: Canvas, options: ExportOptions): Promise<ExportResult> {
    try {
      const format = options.format === ExportFormat.JPEG ? 'jpeg' : 'png';
      const quality = options.quality ?? 1;
      const multiplier = options.scale ?? 1;

      const dataUrl = canvas.toDataURL({
        format,
        quality,
        multiplier
      });

      const blob = await this.dataUrlToBlob(dataUrl);

      return {
        success: true,
        data: blob,
        filename: `els-maps-export.${format}`
      };
    } catch (error) {
      return {
        success: false,
        filename: '',
        error: error instanceof Error ? error.message : 'Export failed'
      };
    }
  }

  private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const response = await fetch(dataUrl);
    return response.blob();
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
