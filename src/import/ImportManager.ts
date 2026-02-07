import type { Canvas } from 'fabric';
import type { ImportOptions, ProjectData } from '@/types';
import { ImageImporter } from './ImageImporter';
import { JSONImporter } from './JSONImporter';

export class ImportManager {
  private imageImporter: ImageImporter;
  private jsonImporter: JSONImporter;

  constructor() {
    this.imageImporter = new ImageImporter();
    this.jsonImporter = new JSONImporter();
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

      default:
        return { success: false };
    }
  }

  private getFileType(file: File): 'image' | 'json' | 'unknown' {
    const mimeType = file.type.toLowerCase();
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension ?? '')) {
      return 'image';
    }

    if (mimeType === 'application/json' || extension === 'json') {
      return 'json';
    }

    return 'unknown';
  }

  createFileInput(
    canvas: Canvas,
    options?: ImportOptions
  ): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.json,.elmap.json';

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
