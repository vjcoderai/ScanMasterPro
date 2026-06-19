import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, ActivityIndicator, TextInput, Modal,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/hooks/useTheme';
import { useDocuments } from '../../src/hooks/useDocuments';
import { Spacing, BorderRadius, FontSize } from '../../src/constants';
import { formatFileSize, generateId } from '../../src/utils/storage';
import { loadPdfPages, buildPdfFromPages, PdfPageRef } from '../../src/utils/pdfUtils';

interface PickedFile {
  id: string;
  name: string;
  uri: string;
  size: number;
}

type Step = 'select' | 'editPages' | 'done';

export default function MergeScreen() {
  const { colors } = useTheme();
  const { documents, addDocument } = useDocuments();

  const [step, setStep] = useState<Step>('select');

  // Step 1: file selection
  const [files, setFiles] = useState<PickedFile[]>([]);

  // Step 2: page-level editor
  const [pages, setPages] = useState<PdfPageRef[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);

  // Output
  const [outputName, setOutputName] = useState(`merged_${Date.now()}`);
  const [processing, setProcessing] = useState(false);
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);

  // ---------------- STEP 1: FILE SELECTION ----------------

  const pickPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', multiple: true, copyToCacheDirectory: true });
      if (!result.canceled && result.assets) {
        const newFiles: PickedFile[] = result.assets.map(a => ({
          id: `${Date.now()}_${Math.random()}`,
          name: a.name,
          uri: a.uri,
          size: a.size || 0,
        }));
        setFiles(prev => [...prev, ...newFiles]);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick PDF file.');
    }
  };

  const pickFromDocuments = () => {
    const pdfDocs = documents.filter(d => d.fileUri && d.format === 'pdf');
    if (pdfDocs.length === 0) {
      Alert.alert('No PDFs', 'No exported PDF documents found. Export a document as PDF first.');
      return;
    }
    Alert.alert('Select Document', 'Choose which document to add:', [
      ...pdfDocs.slice(0, 6).map(d => ({
        text: d.name,
        onPress: () => {
          if (d.fileUri) {
            setFiles(prev => [...prev, { id: d.id, name: d.name + '.pdf', uri: d.fileUri!, size: d.fileSize || 0 }]);
          }
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const moveUp = (index: number) => {
    if (index === 0) return;
    setFiles(prev => { const c = [...prev]; [c[index - 1], c[index]] = [c[index], c[index - 1]]; return c; });
  };

  const moveDown = (index: number) => {
    if (index === files.length - 1) return;
    setFiles(prev => { const c = [...prev]; [c[index], c[index + 1]] = [c[index + 1], c[index]]; return c; });
  };

  // ---------------- STEP 1 -> 2: LOAD PAGES FOR EDITOR ----------------

  const proceedToEditor = async () => {
    if (files.length === 0) { Alert.alert('No Files', 'Add at least one PDF.'); return; }
    setLoadingPages(true);
    try {
      const uris = files.map(f => f.uri);
      const labels = files.map(f => f.name.replace(/\.pdf$/i, ''));
      const loaded = await loadPdfPages(uris, labels);
      if (loaded.length === 0) {
        Alert.alert('No Pages Found', 'Could not read any pages from the selected PDF(s).');
        setLoadingPages(false);
        return;
      }
      setPages(loaded);
      setStep('editPages');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load PDF pages.');
    } finally {
      setLoadingPages(false);
    }
  };

  // ---------------- STEP 2: PAGE EDITOR ----------------

  const movePageUp = (index: number) => {
    if (index === 0) return;
    setPages(prev => { const c = [...prev]; [c[index - 1], c[index]] = [c[index], c[index - 1]]; return c; });
  };

  const movePageDown = (index: number) => {
    if (index === pages.length - 1) return;
    setPages(prev => { const c = [...prev]; [c[index], c[index + 1]] = [c[index + 1], c[index]]; return c; });
  };

  const removePage = (index: number) => {
    if (pages.length === 1) { Alert.alert('Cannot Remove', 'At least one page is required.'); return; }
    setPages(prev => prev.filter((_, i) => i !== index));
  };

  const rotatePage = (index: number) => {
    setPages(prev => prev.map((p, i) => i === index ? { ...p, rotationOverride: (p.rotationOverride + 90) % 360 } : p));
  };

  const backToSelection = () => {
    Alert.alert('Go Back?', 'Your page order, rotations, and removals will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Go Back', style: 'destructive', onPress: () => { setStep('select'); setPages([]); } },
    ]);
  };

  // ---------------- STEP 2 -> 3: MERGE ----------------

  const handleMerge = async () => {
    if (pages.length === 0) { Alert.alert('No Pages', 'Add at least one page.'); return; }
    if (!outputName.trim()) { Alert.alert('Name Required', 'Enter an output file name.'); return; }

    setProcessing(true);
    try {
      const uris = files.map(f => f.uri);
      const outputPath = await buildPdfFromPages(uris, pages, outputName.trim());

      setResultUri(outputPath);
      const info = await FileSystem.getInfoAsync(outputPath, { size: true });
      const size = info.exists && 'size' in info ? (info as any).size : 0;
      setResultSize(size);

      const now = new Date().toISOString();
      await addDocument({
        id: generateId(),
        name: outputName.trim(),
        pages: [],
        createdAt: now,
        updatedAt: now,
        format: 'pdf',
        fileUri: outputPath,
        fileSize: size,
        folder: 'merged',
      });

      setStep('done');
    } catch (e: any) {
      Alert.alert('Merge Failed', e.message || 'Failed to build the merged PDF.');
    } finally {
      setProcessing(false);
    }
  };

  const handleShare = async () => {
    if (!resultUri) return;
    const ok = await Sharing.isAvailableAsync();
    if (ok) await Sharing.shareAsync(resultUri);
  };

  const startOver = () => {
    setStep('select');
    setFiles([]);
    setPages([]);
    setResultUri(null);
    setResultSize(0);
    setOutputName(`merged_${Date.now()}`);
  };

  // ================= RENDER: STEP 1 - FILE SELECTION =================
  if (step === 'select') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{files.length} PDF{files.length !== 1 ? 's' : ''} selected</Text>
            <View style={styles.addBtns}>
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={pickPDF}>
                <Ionicons name="folder-open-outline" size={16} color={colors.white} />
                <Text style={[styles.addBtnText, { color: colors.white }]}>Files</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.secondary }]} onPress={pickFromDocuments}>
                <Ionicons name="document-outline" size={16} color={colors.white} />
                <Text style={[styles.addBtnText, { color: colors.white }]}>My Docs</Text>
              </TouchableOpacity>
            </View>
          </View>

          {files.length === 0 ? (
            <TouchableOpacity style={[styles.emptyPicker, { borderColor: colors.primaryLight, backgroundColor: colors.primary + '05' }]} onPress={pickPDF}>
              <Ionicons name="document-attach-outline" size={40} color={colors.primaryLight} />
              <Text style={[styles.emptyPickerText, { color: colors.textSecondary }]}>Tap to add PDF files</Text>
              <Text style={[styles.emptyPickerSub, { color: colors.textTertiary }]}>Add 1 or more PDFs to merge or edit</Text>
            </TouchableOpacity>
          ) : (
            <FlatList
              data={files}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
              renderItem={({ item, index }) => (
                <View style={[styles.fileCard, { borderBottomColor: colors.border }]}>
                  <View style={styles.fileIcon}>
                    <Ionicons name="document-text" size={28} color={colors.error} />
                    <Text style={[styles.fileIconLabel, { color: colors.error }]}>PDF</Text>
                  </View>
                  <View style={styles.fileInfo}>
                    <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>
                    <Text style={[styles.fileSize, { color: colors.textTertiary }]}>{formatFileSize(item.size)}</Text>
                  </View>
                  <View style={styles.fileControls}>
                    <TouchableOpacity onPress={() => moveUp(index)} style={[styles.ctrlBtn, { backgroundColor: colors.surfaceSecondary }]} disabled={index === 0}>
                      <Ionicons name="chevron-up" size={16} color={index === 0 ? colors.border : colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveDown(index)} style={[styles.ctrlBtn, { backgroundColor: colors.surfaceSecondary }]} disabled={index === files.length - 1}>
                      <Ionicons name="chevron-down" size={16} color={index === files.length - 1 ? colors.border : colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeFile(item.id)} style={[styles.ctrlBtn, { backgroundColor: colors.surfaceSecondary }]}>
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </View>

        {files.length > 0 && (
          <View style={[styles.infoBox, { backgroundColor: colors.primary + '10' }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.primary }]}>
              Next, you'll see every page from these files and can reorder, rotate, or remove individual pages before merging.
            </Text>
          </View>
        )}

        {files.length > 0 && (
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }, loadingPages && styles.btnDisabled]} onPress={proceedToEditor} disabled={loadingPages}>
            {loadingPages
              ? <ActivityIndicator color={colors.white} />
              : <><Ionicons name="albums-outline" size={20} color={colors.white} /><Text style={[styles.primaryBtnText, { color: colors.white }]}>Review & Edit Pages</Text></>
            }
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ================= RENDER: STEP 2 - PAGE EDITOR =================
  if (step === 'editPages') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.editorHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={backToSelection} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.primary} />
            <Text style={[styles.backBtnText, { color: colors.primary }]}>Files</Text>
          </TouchableOpacity>
          <Text style={[styles.editorTitle, { color: colors.text }]}>{pages.length} page{pages.length !== 1 ? 's' : ''}</Text>
        </View>

        <FlatList
          data={pages}
          keyExtractor={item => item.key}
          contentContainerStyle={styles.pageList}
          renderItem={({ item, index }) => (
            <View style={[styles.pageRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.pagePreview, { backgroundColor: colors.surfaceSecondary, transform: [{ rotate: `${item.rotationOverride}deg` }] }]}>
                <Ionicons name="document-text-outline" size={28} color={colors.primary} />
                <Text style={[styles.pagePreviewLabel, { color: colors.textSecondary }]}>P{item.pageIndexInSource + 1}</Text>
              </View>
              <View style={styles.pageInfo}>
                <Text style={[styles.pageLabel, { color: colors.text }]} numberOfLines={1}>{item.label}</Text>
                {item.rotationOverride !== 0 && (
                  <Text style={[styles.pageRotation, { color: colors.warning }]}>Rotated {item.rotationOverride}°</Text>
                )}
              </View>
              <View style={styles.pageControls}>
                <TouchableOpacity onPress={() => rotatePage(index)} style={[styles.pageCtrlBtn, { backgroundColor: colors.surfaceSecondary }]}>
                  <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => movePageUp(index)} style={[styles.pageCtrlBtn, { backgroundColor: colors.surfaceSecondary }]} disabled={index === 0}>
                  <Ionicons name="chevron-up" size={16} color={index === 0 ? colors.border : colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => movePageDown(index)} style={[styles.pageCtrlBtn, { backgroundColor: colors.surfaceSecondary }]} disabled={index === pages.length - 1}>
                  <Ionicons name="chevron-down" size={16} color={index === pages.length - 1 ? colors.border : colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removePage(index)} style={[styles.pageCtrlBtn, { backgroundColor: colors.surfaceSecondary }]}>
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListFooterComponent={<View style={{ height: 180 }} />}
        />

        <View style={[styles.mergeFooter, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={[styles.inputRow, { borderColor: colors.border }]}>
            <Ionicons name="document-outline" size={20} color={colors.textSecondary} />
            <TextInput style={[styles.input, { color: colors.text }]} value={outputName} onChangeText={setOutputName} placeholder="Output file name" placeholderTextColor={colors.textTertiary} />
            <Text style={[styles.inputSuffix, { color: colors.textTertiary }]}>.pdf</Text>
          </View>
          <TouchableOpacity style={[styles.mergeBtn, { backgroundColor: colors.success }, processing && styles.btnDisabled]} onPress={handleMerge} disabled={processing}>
            {processing
              ? <ActivityIndicator color={colors.white} />
              : <><Ionicons name="git-merge-outline" size={20} color={colors.white} /><Text style={[styles.mergeBtnText, { color: colors.white }]}>Create Merged PDF</Text></>
            }
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ================= RENDER: STEP 3 - DONE =================
  return (
    <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
      <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.success + '40' }]}>
        <Ionicons name="checkmark-circle" size={56} color={colors.success} />
        <Text style={[styles.resultTitle, { color: colors.text }]}>Merged PDF Created!</Text>
        <Text style={[styles.resultSubtitle, { color: colors.textSecondary }]}>{outputName}.pdf</Text>
        <Text style={[styles.resultSize, { color: colors.textSecondary }]}>{formatFileSize(resultSize)} · {pages.length} page{pages.length !== 1 ? 's' : ''}</Text>
        <Text style={[styles.resultSaved, { color: colors.success }]}>✓ Saved to Merged folder on your dashboard</Text>

        <View style={styles.resultActions}>
          <TouchableOpacity style={[styles.resultBtn, { backgroundColor: colors.primary }]} onPress={handleShare}>
            <Ionicons name="share-outline" size={18} color={colors.white} />
            <Text style={[styles.resultBtnText, { color: colors.white }]}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.resultBtn, { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }]} onPress={startOver}>
            <Ionicons name="add-outline" size={18} color={colors.text} />
            <Text style={[styles.resultBtnText, { color: colors.text }]}>Merge Another</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.md },
  section: { borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700' },
  addBtns: { flexDirection: 'row', gap: Spacing.sm },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.sm },
  addBtnText: { fontSize: FontSize.sm, fontWeight: '600' },
  emptyPicker: { height: 130, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderRadius: BorderRadius.md, gap: 4 },
  emptyPickerText: { fontSize: FontSize.md, fontWeight: '500' },
  emptyPickerSub: { fontSize: FontSize.sm },
  separator: { height: 1 },
  fileCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm, borderBottomWidth: 1 },
  fileIcon: { alignItems: 'center', width: 44 },
  fileIconLabel: { fontSize: 9, fontWeight: '700', marginTop: 1 },
  fileInfo: { flex: 1 },
  fileName: { fontSize: FontSize.sm, fontWeight: '600' },
  fileSize: { fontSize: FontSize.xs, marginTop: 2 },
  fileControls: { flexDirection: 'row', gap: 4 },
  ctrlBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  infoBox: { flexDirection: 'row', padding: Spacing.sm, borderRadius: BorderRadius.sm, gap: Spacing.sm, alignItems: 'flex-start', marginBottom: Spacing.md },
  infoText: { flex: 1, fontSize: FontSize.xs, lineHeight: 18 },
  primaryBtn: { height: 52, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  primaryBtnText: { fontSize: FontSize.md, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },

  // Editor (step 2)
  editorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: Spacing.sm, marginBottom: Spacing.sm, borderBottomWidth: 1, marginHorizontal: -Spacing.md, paddingHorizontal: Spacing.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backBtnText: { fontSize: FontSize.sm, fontWeight: '600' },
  editorTitle: { fontSize: FontSize.md, fontWeight: '700' },
  pageList: { gap: Spacing.sm },
  pageRow: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.sm, gap: Spacing.sm },
  pagePreview: { width: 50, height: 64, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pagePreviewLabel: { fontSize: 10, fontWeight: '700' },
  pageInfo: { flex: 1 },
  pageLabel: { fontSize: FontSize.sm, fontWeight: '600' },
  pageRotation: { fontSize: FontSize.xs, marginTop: 2, fontWeight: '600' },
  pageControls: { flexDirection: 'row', gap: 4 },
  pageCtrlBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },

  mergeFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.md, borderTopWidth: 1, gap: Spacing.sm },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 48, gap: Spacing.sm },
  input: { flex: 1, fontSize: FontSize.md },
  inputSuffix: { fontSize: FontSize.md },
  mergeBtn: { height: 52, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  mergeBtnText: { fontSize: FontSize.md, fontWeight: '700' },

  // Result (step 3)
  resultCard: { borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm, borderWidth: 1.5 },
  resultTitle: { fontSize: FontSize.xl, fontWeight: '800', marginTop: Spacing.sm },
  resultSubtitle: { fontSize: FontSize.md, fontWeight: '600' },
  resultSize: { fontSize: FontSize.sm },
  resultSaved: { fontSize: FontSize.sm, fontWeight: '600', marginTop: Spacing.xs },
  resultActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  resultBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  resultBtnText: { fontSize: FontSize.md, fontWeight: '700' },
});
