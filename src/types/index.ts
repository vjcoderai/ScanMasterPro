export type ScanMode = 'color' | 'grayscale' | 'blackwhite';
export type ExportFormat = 'pdf' | 'jpg' | 'png';
export type FolderType = 'scans' | 'merged' | 'compressed' | 'converted' | 'custom';

export interface ScannedPage {
  id: string;
  uri: string;
  width: number;
  height: number;
  rotation: number;
  cropData?: CropData;
  scanMode: ScanMode;
  createdAt: string;
  ocrText?: string;
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
  folder: FolderType;
  isPasswordProtected?: boolean;
  password?: string;
  ocrText?: string;
}

export interface Folder {
  id: FolderType;
  name: string;
  icon: string;
  color: string;
}

export interface AppSettings {
  defaultFormat: ExportFormat;
  defaultScanMode: ScanMode;
  addTimestampByDefault: boolean;
  highQualityCapture: boolean;
  theme: ThemeType;
  customStoragePath?: string;
}

export type ThemeType = 'light' | 'dark' | 'blue' | 'green' | 'purple' | 'red';
export type ThemeMode = 'system' | 'manual';

export interface AspectRatio {
  label: string;
  value: string;
  width: number;
  height: number;
}

export interface CompressionSettings {
  quality: number;
  format: ExportFormat;
}

export type DocumentSortOrder = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc';
