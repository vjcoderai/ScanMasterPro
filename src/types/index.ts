export type ScanMode = 'color' | 'grayscale' | 'blackwhite';
export type ExportFormat = 'pdf' | 'jpg' | 'png';

export interface ScannedPage {
  id: string;
  uri: string;
  width: number;
  height: number;
  rotation: number;
  cropData?: CropData;
  scanMode: ScanMode;
  createdAt: string;
}

export interface CropData {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface Document {
  id: string;
  name: string;
  pages: ScannedPage[];
  createdAt: string;
  updatedAt: string;
  format: ExportFormat;
  fileUri?: string;
  fileSize?: number;
  thumbnail?: string;
  tags?: string[];
  dateTimeStamp?: boolean;
}

export interface AspectRatio {
  label: string;
  value: string;
  width: number;
  height: number;
}

export interface CompressionSettings {
  quality: number; // 0-1
  format: ExportFormat;
}

export type DocumentSortOrder = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc';
