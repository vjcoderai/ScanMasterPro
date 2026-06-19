import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Document, ScannedPage, FolderType } from '../types';
import { DOCUMENTS_STORAGE_KEY, SCANS_DIRECTORY, EXPORTS_DIRECTORY, MERGED_DIRECTORY, COMPRESSED_DIRECTORY } from '../constants';

export const getDocumentsDir = (): string => `${FileSystem.documentDirectory}${SCANS_DIRECTORY}/`;
export const getExportsDir = (): string => `${FileSystem.documentDirectory}${EXPORTS_DIRECTORY}/`;
export const getMergedDir = (): string => `${FileSystem.documentDirectory}${MERGED_DIRECTORY}/`;
export const getCompressedDir = (): string => `${FileSystem.documentDirectory}${COMPRESSED_DIRECTORY}/`;

export const getDirForFolder = (folder: FolderType): string => {
  switch (folder) {
    case 'merged': return getMergedDir();
    case 'compressed': return getCompressedDir();
    case 'converted': return getExportsDir();
    default: return getDocumentsDir();
  }
};

export const ensureDirectoriesExist = async (): Promise<void> => {
  const dirs = [getDocumentsDir(), getExportsDir(), getMergedDir(), getCompressedDir()];
  for (const dir of dirs) {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
};

export const loadDocuments = async (): Promise<Document[]> => {
  try {
    const data = await AsyncStorage.getItem(DOCUMENTS_STORAGE_KEY);
    if (!data) return [];
    const docs: Document[] = JSON.parse(data);
    return docs;
  } catch (e) {
    return [];
  }
};

export const saveDocuments = async (documents: Document[]): Promise<void> => {
  await AsyncStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(documents));
};

export const savePageImage = async (uri: string, docId: string, pageIndex: number): Promise<string> => {
  await ensureDirectoriesExist();
  const ext = uri.includes('.png') ? 'png' : 'jpg';
  const destPath = `${getDocumentsDir()}${docId}_page${pageIndex}.${ext}`;
  try {
    await FileSystem.copyAsync({ from: uri, to: destPath });
    return destPath;
  } catch {
    return uri;
  }
};

export const deleteDocumentFiles = async (doc: Document): Promise<void> => {
  for (const page of doc.pages) {
    try {
      const info = await FileSystem.getInfoAsync(page.uri);
      if (info.exists) await FileSystem.deleteAsync(page.uri);
    } catch {}
  }
  if (doc.fileUri) {
    try {
      const info = await FileSystem.getInfoAsync(doc.fileUri);
      if (info.exists) await FileSystem.deleteAsync(doc.fileUri);
    } catch {}
  }
};

export const getFileSize = async (uri: string): Promise<number> => {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (info.exists && 'size' in info) return (info as any).size;
    return 0;
  } catch { return 0; }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const generateId = (): string => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const formatDateTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export const generateTimestamp = (): string => new Date().toLocaleString('en-US');

export const applyRotation = async (uri: string, degrees: number): Promise<string> => {
  const ImageManipulator = require('expo-image-manipulator');
  const result = await ImageManipulator.manipulateAsync(
    uri, [{ rotate: degrees }],
    { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
};
