import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Document, ScannedPage, ExportFormat, FolderType } from '../types';
import {
  loadDocuments, saveDocuments, savePageImage,
  deleteDocumentFiles, generateId, ensureDirectoriesExist,
} from '../utils/storage';

interface DocumentContextType {
  documents: Document[];
  loading: boolean;
  addDocument: (doc: Document) => Promise<void>;
  updateDocument: (id: string, updates: Partial<Document>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  getDocument: (id: string) => Document | undefined;
  refreshDocuments: () => Promise<void>;
  createNewDocument: (
    pages: ScannedPage[],
    name: string,
    format: ExportFormat,
    addTimestamp: boolean,
    folder?: FolderType,
    password?: string
  ) => Promise<Document>;
  getDocumentsByFolder: (folder: FolderType) => Document[];
}

const DocumentContext = createContext<DocumentContextType | null>(null);

export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { init(); }, []);

  const init = async () => {
    await ensureDirectoriesExist();
    const docs = await loadDocuments();
    setDocuments(docs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    setLoading(false);
  };

  const refreshDocuments = useCallback(async () => {
    const docs = await loadDocuments();
    setDocuments(docs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
  }, []);

  const addDocument = useCallback(async (doc: Document) => {
    setDocuments(prev => {
      const updated = [doc, ...prev];
      saveDocuments(updated);
      return updated;
    });
  }, []);

  const updateDocument = useCallback(async (id: string, updates: Partial<Document>) => {
    setDocuments(prev => {
      const updated = prev.map(d =>
        d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
      );
      saveDocuments(updated);
      return updated;
    });
  }, []);

  const deleteDocument = useCallback(async (id: string) => {
    setDocuments(prev => {
      const doc = prev.find(d => d.id === id);
      if (doc) deleteDocumentFiles(doc);
      const updated = prev.filter(d => d.id !== id);
      saveDocuments(updated);
      return updated;
    });
  }, []);

  const getDocument = useCallback((id: string) => documents.find(d => d.id === id), [documents]);

  const getDocumentsByFolder = useCallback(
    (folder: FolderType) => documents.filter(d => d.folder === folder),
    [documents]
  );

  const createNewDocument = useCallback(async (
    pages: ScannedPage[],
    name: string,
    format: ExportFormat,
    addTimestamp: boolean,
    folder: FolderType = 'scans',
    password?: string
  ): Promise<Document> => {
    const id = generateId();
    const now = new Date().toISOString();
    const savedPages = await Promise.all(
      pages.map(async (page, index) => {
        const savedUri = await savePageImage(page.uri, id, index);
        return { ...page, uri: savedUri };
      })
    );
    const doc: Document = {
      id, name, pages: savedPages,
      createdAt: now, updatedAt: now,
      format, dateTimeStamp: addTimestamp,
      thumbnail: savedPages[0]?.uri,
      folder,
      isPasswordProtected: !!password,
      password,
    };
    await addDocument(doc);
    return doc;
  }, [addDocument]);

  return (
    <DocumentContext.Provider value={{
      documents, loading, addDocument, updateDocument,
      deleteDocument, getDocument, refreshDocuments,
      createNewDocument, getDocumentsByFolder,
    }}>
      {children}
    </DocumentContext.Provider>
  );
};

export const useDocuments = () => {
  const ctx = useContext(DocumentContext);
  if (!ctx) throw new Error('useDocuments must be used within DocumentProvider');
  return ctx;
};
