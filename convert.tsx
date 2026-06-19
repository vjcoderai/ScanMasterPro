import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  Alert, ActivityIndicator, FlatList, Modal, TextInput, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useDocuments } from '../../src/hooks/useDocuments';
import { useTheme } from '../../src/hooks/useTheme';
import { Spacing, BorderRadius, FontSize, FOLDERS } from '../../src/constants';
import { formatDateTime, formatFileSize, getExportsDir } from '../../src/utils/storage';
import { createPDFFromImages } from '../../src/utils/pdfUtils';
import { compressImage } from '../../src/utils/imageUtils';
import { ExportFormat } from '../../src/types';

const { width: SCREEN_W } = Dimensions.get('window');

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getDocument, updateDocument, deleteDocument } = useDocuments();
  const { colors } = useTheme();
  const doc = getDocument(id);

  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(doc?.format || 'pdf');
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(doc?.name || '');
  const [showPathInfo, setShowPathInfo] = useState(false);

  const handleExport = useCallback(async () => {
    if (!doc) return;
    setExporting(true);
    try {
      const timestamp = doc.dateTimeStamp ? `_${Date.now()}` : '';
      let exportedUri = '';

      if (exportFormat === 'pdf') {
        const uris = doc.pages.map(p => p.uri);
        exportedUri = await createPDFFromImages(uris, `${doc.name}${timestamp}`, doc.dateTimeStamp, doc.password);
      } else {
        const page = doc.pages[0];
        if (!page) throw new Error('No pages');
        exportedUri = await compressImage(page.uri, { quality: 0.9, format: exportFormat });
        const dir = getExportsDir();
        const dirInfo = await FileSystem.getInfoAsync(dir);
        if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        const destPath = `${dir}${doc.name}${timestamp}.${exportFormat}`;
        await FileSystem.copyAsync({ from: exportedUri, to: destPath });
        exportedUri = destPath;
      }

      const info = await FileSystem.getInfoAsync(exportedUri, { size: true });
      const size = info.exists && 'size' in info ? (info as any).size : 0;
      await updateDocument(doc.id, { fileUri: exportedUri, fileSize: size, format: exportFormat });

      Alert.alert('Exported!', `Document saved as ${exportFormat.toUpperCase()}.\n\nLocation: App Documents/${exportFormat === 'pdf' ? 'exports' : 'exports'}/`, [
        { text: 'Share', onPress: async () => { const ok = await Sharing.isAvailableAsync(); if (ok) await Sharing.shareAsync(exportedUri); } },
        { text: 'OK' },
      ]);
    } catch (e: any) {
      Alert.alert('Export Failed', e.message || 'Failed to export document.');
    } finally {
      setExporting(false);
    }
  }, [doc, exportFormat, updateDocument]);

  const handleShare = useCallback(async () => {
    if (!doc?.fileUri) { Alert.alert('Export First', 'Please export the document before sharing.'); return; }
    const fileInfo = await FileSystem.getInfoAsync(doc.fileUri);
    if (!fileInfo.exists) {
      Alert.alert('File Not Found', 'The exported file no longer exists. Please export again.');
      return;
    }
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) await Sharing.shareAsync(doc.fileUri);
  }, [doc]);

  const handleSaveToGallery = useCallback(async () => {
    if (!doc) return;
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Required', 'Photo library access is needed.'); return; }
    try {
      for (const page of doc.pages) {
        await MediaLibrary.createAssetAsync(page.uri);
      }
      Alert.alert('Saved!', `${doc.pages.length} page(s) saved to your Photos app.`);
    } catch {
      Alert.alert('Error', 'Failed to save to gallery.');
    }
  }, [doc]);

  const handleRename = useCallback(async () => {
    if (!newName.trim() || !doc) return;
    await updateDocument(doc.id, { name: newName.trim() });
    setRenaming(false);
  }, [newName, doc, updateDocument]);

  const handleDelete = useCallback(() => {
    if (!doc) return;
    Alert.alert('Delete Document', `Delete "${doc.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteDocument(doc.id); router.back(); } },
    ]);
  }, [doc, deleteDocument, router]);

  const getFileLocationText = () => {
    if (!doc?.fileUri) return 'Not yet exported';
    const path = doc.fileUri.replace(FileSystem.documentDirectory || '', '');
    const folderName = FOLDERS.find(f => f.id === doc.folder)?.name || doc.folder;
    return `App Storage / ${folderName}\n${path}`;
  };

  if (!doc) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="document-outline" size={60} color={colors.textTertiary} />
        <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>Document not found</Text>
      </View>
    );
  }

  const folderInfo = FOLDERS.find(f => f.id === doc.folder);

  return (
    <>
      <Stack.Screen options={{
        title: doc.name,
        headerStyle: { backgroundColor: colors.header },
        headerTintColor: colors.headerText,
        headerRight: () => (
          <TouchableOpacity onPress={() => setRenaming(true)} style={{ marginRight: 8 }}>
            <Ionicons name="pencil-outline" size={20} color={colors.headerText} />
          </TouchableOpacity>
        ),
      }} />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.metaCard, { backgroundColor: colors.surface }]}>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>Created: {formatDateTime(doc.createdAt)}</Text>
          </View>
          {doc.pages.length > 0 && (
            <View style={styles.metaRow}>
              <Ionicons name="layers-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{doc.pages.length} page{doc.pages.length !== 1 ? 's' : ''}</Text>
            </View>
          )}
          {doc.fileSize ? (
            <View style={styles.metaRow}>
              <Ionicons name="archive-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formatFileSize(doc.fileSize)}</Text>
            </View>
          ) : null}
          {folderInfo && (
            <View style={styles.metaRow}>
              <Ionicons name={folderInfo.icon as any} size={16} color={folderInfo.color} />
              <Text style={[styles.metaText, { color: folderInfo.color, fontWeight: '600' }]}>{folderInfo.name} folder</Text>
            </View>
          )}
          {doc.isPasswordProtected && (
            <View style={styles.metaRow}>
              <Ionicons name="lock-closed" size={16} color={colors.warning} />
              <Text style={[styles.metaText, { color: colors.warning, fontWeight: '600' }]}>Password Protected</Text>
            </View>
          )}
          <TouchableOpacity style={styles.metaRow} onPress={() => setShowPathInfo(true)}>
            <Ionicons name="folder-open-outline" size={16} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.primary, fontWeight: '600' }]}>View file location</Text>
          </TouchableOpacity>
        </View>

        {doc.pages.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Pages</Text>
            <FlatList
              data={doc.pages}
              horizontal
              keyExtractor={item => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pagesRow}
              renderItem={({ item, index }) => (
                <TouchableOpacity style={styles.pageThumb} onPress={() => router.push({ pathname: '/document/edit', params: { docId: doc.id, pageIndex: index } })}>
                  <Image source={{ uri: item.uri }} style={styles.pageThumbImg} resizeMode="cover" />
                  <View style={[styles.pageIndexBadge, { backgroundColor: colors.primary }]}><Text style={styles.pageIndexText}>{index + 1}</Text></View>
                  <View style={styles.editOverlay}><Ionicons name="create-outline" size={20} color="#fff" /></View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {doc.pages.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Export</Text>
            <View style={styles.formatRow}>
              {(['pdf', 'jpg', 'png'] as ExportFormat[]).map(fmt => (
                <TouchableOpacity key={fmt} style={[styles.formatBtn, { borderColor: colors.border }, exportFormat === fmt && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setExportFormat(fmt)}>
                  <Text style={[styles.formatBtnText, { color: exportFormat === fmt ? colors.white : colors.textSecondary }]}>{fmt.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }, exporting && styles.btnDisabled]} onPress={handleExport} disabled={exporting}>
              {exporting ? <ActivityIndicator color={colors.white} /> : <><Ionicons name="download-outline" size={20} color={colors.white} /><Text style={[styles.primaryBtnText, { color: colors.white }]}>Export as {exportFormat.toUpperCase()}</Text></>}
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={28} color={colors.primary} />
              <Text style={[styles.actionCardText, { color: colors.text }]}>Share</Text>
            </TouchableOpacity>
            {doc.pages.length > 0 && (
              <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={handleSaveToGallery}>
                <Ionicons name="images-outline" size={28} color={colors.success} />
                <Text style={[styles.actionCardText, { color: colors.text }]}>Save to Gallery</Text>
              </TouchableOpacity>
            )}
            {doc.pages.length > 0 && (
              <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => router.push({ pathname: '/scan/camera' })}>
                <Ionicons name="add-circle-outline" size={28} color={colors.secondary || colors.primary} />
                <Text style={[styles.actionCardText, { color: colors.text }]}>Add Pages</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#FFF5F5', borderColor: '#FEE2E2' }]} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={28} color={colors.error} />
              <Text style={[styles.actionCardText, { color: colors.error }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Rename Modal */}
      <Modal visible={renaming} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Rename Document</Text>
            <TextInput style={[styles.modalInput, { borderColor: colors.primary, color: colors.text }]} value={newName} onChangeText={setNewName} placeholder="Document name" autoFocus selectTextOnFocus />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtnCancel, { backgroundColor: colors.surfaceSecondary }]} onPress={() => { setRenaming(false); setNewName(doc.name); }}>
                <Text style={[styles.modalBtnCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtnSave, { backgroundColor: colors.primary }]} onPress={handleRename}>
                <Text style={[styles.modalBtnSaveText, { color: colors.white }]}>Rename</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* File Location Modal */}
      <Modal visible={showPathInfo} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>File Location</Text>
            <View style={[styles.pathBox, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.pathText, { color: colors.text }]}>{getFileLocationText()}</Text>
            </View>
            <Text style={[styles.pathNote, { color: colors.textTertiary }]}>
              Files are stored in the app's private storage. Use the Share button to send files to other apps, or "Save to Gallery" for photos to appear in your phone's Photos app.
            </Text>
            <TouchableOpacity style={[styles.modalBtnSave, { backgroundColor: colors.primary, marginTop: Spacing.md }]} onPress={() => setShowPathInfo(false)}>
              <Text style={[styles.modalBtnSaveText, { color: colors.white }]}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: FontSize.lg, marginTop: Spacing.md },
  metaCard: { margin: Spacing.md, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.xs, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  metaText: { fontSize: FontSize.sm },
  section: { marginHorizontal: Spacing.md, marginBottom: Spacing.md, borderRadius: BorderRadius.lg, padding: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', marginBottom: Spacing.md },
  pagesRow: { gap: Spacing.sm, paddingRight: Spacing.sm },
  pageThumb: { width: 100, height: 130, borderRadius: BorderRadius.sm, overflow: 'hidden', position: 'relative' },
  pageThumbImg: { width: '100%', height: '100%' },
  pageIndexBadge: { position: 'absolute', top: 4, left: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  pageIndexText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  editOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 28, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  formatRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  formatBtn: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, borderWidth: 1.5 },
  formatBtnText: { fontSize: FontSize.sm, fontWeight: '700' },
  primaryBtn: { height: 48, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: FontSize.md, fontWeight: '700' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionCard: { flex: 1, minWidth: '45%', borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', gap: Spacing.xs, borderWidth: 1 },
  actionCardText: { fontSize: FontSize.sm, fontWeight: '600', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalBox: { width: SCREEN_W - 80, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md },
  modalInput: { borderWidth: 1.5, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 48, fontSize: FontSize.md },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.md },
  modalBtnCancel: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  modalBtnCancelText: { fontSize: FontSize.md, fontWeight: '600' },
  modalBtnSave: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  modalBtnSaveText: { fontSize: FontSize.md, fontWeight: '700', textAlign: 'center' },
  pathBox: { padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  pathText: { fontSize: FontSize.xs, fontFamily: 'monospace', lineHeight: 18 },
  pathNote: { fontSize: FontSize.xs, lineHeight: 18 },
});
