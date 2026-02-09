import type { Canvas } from 'fabric';
import type { ExportResult, ProjectData } from '@/types';
import { canvasLockManager } from '@/canvas';
import { CANVAS_OBJECT_PROPS } from '@/utils';

export class JSONExporter {
  export(canvas: Canvas, projectName: string = 'Untitled'): ExportResult {
    try {
      const canvasData = canvas.toObject([...CANVAS_OBJECT_PROPS]);

      const projectData: ProjectData = {
        version: '1.0.0',
        canvas: canvasData,
        lockState: canvasLockManager.getLockedState(),
        metadata: {
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          name: projectName
        }
      };

      const jsonString = JSON.stringify(projectData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });

      return {
        success: true,
        data: blob,
        filename: `${projectName.toLowerCase().replace(/\s+/g, '-')}.elmap.json`
      };
    } catch (error) {
      return {
        success: false,
        filename: '',
        error: error instanceof Error ? error.message : 'JSON export failed'
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
