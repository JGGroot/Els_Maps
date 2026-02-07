export enum ExportFormat {
  PNG = 'png',
  JPEG = 'jpeg',
  PDF = 'pdf',
  JSON = 'json'
}

export interface ExportOptions {
  format: ExportFormat;
  quality?: number;
  scale?: number;
  backgroundColor?: string;
}

export interface ExportResult {
  success: boolean;
  data?: Blob | string;
  filename: string;
  error?: string;
}

export interface ImportOptions {
  maxWidth?: number;
  maxHeight?: number;
  preserveAspectRatio?: boolean;
}

export interface ProjectData {
  version: string;
  canvas: object;
  metadata: {
    createdAt: string;
    modifiedAt: string;
    name: string;
  };
}
