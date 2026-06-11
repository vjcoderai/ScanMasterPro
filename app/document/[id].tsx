import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { useDocuments } from '../../src/hooks/useDocuments';
import { Colors, Spacing, BorderRadius, FontSize } from '../../src/constants';
import { formatDateTime, formatFileSize, getExportsDir } from '../../src/utils/storage';
import { createPdfFromImages, compressImage } from '../../src/utils/imageUtils';
import { ExportFormat } from '../../src/types';

const { width: SCREEN_W } = Dimensions.get('window');

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getDocument, updateDocument, deleteDocument } = useDocuments();
  const doc = getDocument(id);

  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(doc?.format || 'pdf');
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(doc?.name || '');

  const handleExport = useCallback(async () => {
    if (!doc) return;
    setExporting(true);
    try {
      const dir = getExportsDir();
      const timestamp = doc.dateTimeStamp ? `_${Date.now()}` : '';
      let exportedUri = '';

      if (exportFormat === 'pdf') {
        const uris = doc.pages.map((p) => p.uri);
        exportedUri = await createPdfFromImages(uris, `${doc.name}${timestamp}`, doc.dateTimeStamp);
      } else {
        const page = doc.pages[0];
        if (!page) throw new Error('No pages');
        exportedUri = await compressImage(page.uri, {
          quality: 0.9,
          format: exportFormat,
        });
        // Copy to exports dir
        const ext = exportFormat;
        const destPath = `${dir}${doc.name}${timestamp}.${ext}`;
        await FileSystem.copyAsync({ from: exportedUri, to: destPath });
        exportedUri = destPath;
      }

      const info = await FileSystem.getInfoAsync(exportedUri, { size: true });
      const size = info.exists && 'size' in info ? (info as any).size : 0;
      await updateDocument(doc.id, { fileUri: exportedUri, fileSize: size, format: exportFormat });

      Alert.alert('Exported!', `Document saved as ${exportFormat.toUpperCase()}.`, [
        {
          text: 'Share',
          onPress: async () => {
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) await Sharing.shareAsync(exportedUri);
          },
        },
        { text: 'OK' },
      ]);
    } catch (e: any) {
      Alert.alert('Export Failed', e.message || 'Failed to export document.');
    } finally {
      setExporting(false);
    }
  }, [doc, exportFormat, updateDocument]);

  const handleShare = useCallback(async () => {
    if (!doc?.fileUri) {
      Alert.alert('Export First', 'Please export the document before sharing.');
      return;
    }
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) await Sharing.shareAsync(doc.fileUri);
  }, [doc]);

  const handleSaveToGallery = useCallback(async () => {
    if (!doc) return;
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed to save images.');
      return;
    }
    try {
      for (const page of doc.pages) {
        await MediaLibrary.createAssetAsync(page.uri);
      }
      Alert.alert('Saved!', `${doc.pages.length} page(s) saved to your photo library.`);
    } catch (e) {
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
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDocument(doc.id);
          router.back();
        },
      },
    ]);
  }, [doc, deleteDocument, router]);

  if (!doc) {
    return (
      <View style={styles.centered}>
        <Ionicons name="document-outline" size={60} color={Colors.textTertiary} />
        <Text style={styles.notFoundText}>Document not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: doc.name,
          headerRight: () => (
            <TouchableOpacity onPress={() => setRenaming(true)} style={{ marginRight: 8 }}>
              <Ionicons name="pencil-outline" size={20} color={Colors.white} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Meta Info */}
        <View style={styles.metaCard}>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.metaText}>Created: {formatDateTime(doc.createdAt)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="layers-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{doc.pages.length} page{doc.pages.length !== 1 ? 's' : ''}</Text>
          </View>
          {doc.fileSize ? (
            <View style={styles.metaRow}>
              <Ionicons name="archive-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.metaText}>{formatFileSize(doc.fileSize)}</Text>
            </View>
          ) : null}
        </View>

        {/* Pages Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pages</Text>
          <FlatList
            data={doc.pages}
            horizontal
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pagesRow}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={styles.pageThumb}
                onPress={() =>
                  router.push({ pathname: '/document/edit', params: { docId: doc.id, pageIndex: index } })
                }
              >
                <Image source={{ uri: item.uri }} style={styles.pageThumbImg} resizeMode="cover" />
                <View style={styles.pageIndexBadge}>
                  <Text style={styles.pageIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.editOverlay}>
                  <Ionicons name="create-outline" size={20} color={Colors.white} />
                </View>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Export Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export</Text>
          <View style={styles.formatRow}>
            {(['pdf', 'jpg', 'png'] as ExportFormat[]).map((fmt) => (
              <TouchableOpacity
                key={fmt}
                style={[styles.formatBtn, exportFormat === fmt && styles.formatBtnActive]}
                onPress={() => setExportFormat(fmt)}
              >
                <Text style={[styles.formatBtnText, exportFormat === fmt && styles.formatBtnTextActive]}>
                  {fmt.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.primaryBtn, exporting && styles.btnDisabled]}
            onPress={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="download-outline" size={20} color={Colors.white} />
                <Text style={styles.primaryBtnText}>Export as {exportFormat.toUpperCase()}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={28} color={Colors.primary} />
              <Text style={styles.actionCardText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={handleSaveToGallery}>
              <Ionicons name="images-outline" size={28} color={Colors.success} />
              <Text style={styles.actionCardText}>Save to Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push({ pathname: '/scan/camera' })}
            >
              <Ionicons name="add-circle-outline" size={28} color={Colors.secondary} />
              <Text style={styles.actionCardText}>Add Pages</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionCard, styles.actionCardDanger]} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={28} color={Colors.error} />
              <Text style={[styles.actionCardText, { color: Colors.error }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Rename Modal */}
      <Modal visible={renaming} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Rename Document</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Document name"
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => {
                  setRenaming(false);
                  setNewName(doc.name);
                }}
              >
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={handleRename}>
                <Text style={styles.modalBtnSaveText}>Rename</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: FontSize.lg, color: Colors.textSecondary, marginTop: Spacing.md },
  metaCard: {
    backgroundColor: Colors.surface,
    margin: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  metaText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  section: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  pagesRow: { gap: Spacing.sm, paddingRight: Spacing.sm },
  pageThumb: { width: 100, height: 130, borderRadius: BorderRadius.sm, overflow: 'hidden', position: 'relative' },
  pageThumbImg: { width: '100%', height: '100%' },
  pageIndexBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageIndexText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  editOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 28,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  formatBtn: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  formatBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  formatBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  formatBtnTextActive: { color: Colors.white },
  primaryBtn: {
    height: 48,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionCardDanger: { borderColor: '#FEE2E2', backgroundColor: '#FFF5F5' },
  actionCardText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, alignItems: 'center', justifyContent: 'center' },
  modalBox: {
    width: SCREEN_W - 80,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  modalInput: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.md },
  modalBtnCancel: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceSecondary,
  },
  modalBtnCancelText: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: '600' },
  modalBtnSave: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  modalBtnSaveText: { fontSize: FontSize.md, color: Colors.white, fontWeight: '700' },
});
