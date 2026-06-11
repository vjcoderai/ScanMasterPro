import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Document, ScannedPage } from '../types';
import { DOCUMENTS_STORAGE_KEY, SCANS_DIRECTORY, EXPORTS_DIRECTORY } from '../constants';

export const getDocumentsDir = (): string => {
  return `${FileSystem.documentDirectory}${SCANS_DIRECTORY}/`;
};

export const getExportsDir = (): string => {
  return `${FileSystem.documentDirectory}${EXPORTS_DIRECTORY}/`;
};

export const ensureDirectoriesExist = async (): Promise<void> => {
  const dirs = [getDocumentsDir(), getExportsDir()];
  for (const dir of dirs) {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  }
};

export const loadDocuments = async (): Promise<Document[]> => {
  try {
    const data = await AsyncStorage.getItem(DOCUMENTS_STORAGE_KEY);
    if (!data) return [];
    const docs: Document[] = JSON.parse(data);
    // Validate that page URIs still exist
    const validDocs = await Promise.all(
      docs.map(async (doc) => {
        const validPages = await Promise.all(
          doc.pages.map(async (page) => {
            const info = await FileSystem.getInfoAsync(page.uri);
            return info.exists ? page : null;
          })
        );
        return { ...doc, pages: validPages.filter(Boolean) as ScannedPage[] };
      })
    );
    return validDocs.filter((d) => d.pages.length > 0 || d.fileUri);
  } catch (e) {
    console.error('loadDocuments error:', e);
    return [];
  }
};

export const saveDocuments = async (documents: Document[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(documents));
  } catch (e) {
    console.error('saveDocuments error:', e);
    throw e;
  }
};

export const savePageImage = async (
  uri: string,
  docId: string,
  pageIndex: number
): Promise<string> => {
  await ensureDirectoriesExist();
  const ext = uri.includes('.png') ? 'png' : 'jpg';
  const destPath = `${getDocumentsDir()}${docId}_page${pageIndex}.${ext}`;
  await FileSystem.copyAsync({ from: uri, to: destPath });
  return destPath;
};

export const deleteDocumentFiles = async (doc: Document): Promise<void> => {
  for (const page of doc.pages) {
    try {
      const info = await FileSystem.getInfoAsync(page.uri);
      if (info.exists) await FileSystem.deleteAsync(page.uri);
    } catch (e) {
      // ignore individual delete errors
    }
  }
  if (doc.fileUri) {
    try {
      const info = await FileSystem.getInfoAsync(doc.fileUri);
      if (info.exists) await FileSystem.deleteAsync(doc.fileUri);
    } catch (e) {
      // ignore
    }
  }
};

export const getFileSize = async (uri: string): Promise<number> => {
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (info.exists && 'size' in info) return (info as any).size;
    return 0;
  } catch {
    return 0;
  }
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const generateId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const formatDateTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const generateTimestamp = (): string => {
  const now = new Date();
  return now.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};
