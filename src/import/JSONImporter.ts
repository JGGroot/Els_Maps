import type { Canvas } from 'fabric';
import type { ProjectData } from '@/types';

export class JSONImporter {
  async import(canvas: Canvas, file: File): Promise<ProjectData | null> {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as ProjectData;

      if (!this.validateProjectData(data)) {
        throw new Error('Invalid project file format');
      }

      await canvas.loadFromJSON(data.canvas);
      canvas.requestRenderAll();

      return data;
    } catch (error) {
      console.error('JSON import failed:', error);
      return null;
    }
  }

  private validateProjectData(data: unknown): data is ProjectData {
    if (typeof data !== 'object' || data === null) return false;

    const obj = data as Record<string, unknown>;

    if (typeof obj.version !== 'string') return false;
    if (typeof obj.canvas !== 'object') return false;
    if (typeof obj.metadata !== 'object') return false;

    return true;
  }
}
