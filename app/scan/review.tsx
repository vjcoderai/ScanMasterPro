import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDocuments } from '../../src/hooks/useDocuments';
import { ScannedPage, ScanMode, ExportFormat } from '../../src/types';
import { Colors, Spacing, BorderRadius, FontSize } from '../../src/constants';
import { generateId } from '../../src/utils/storage';
import { applyRotation, applyScanMode } from '../../src/utils/imageUtils';

export default function ReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ pages: string; scanMode: string }>();
  const { createNewDocument } = useDocuments();

  const initialUris: string[] = JSON.parse(params.pages || '[]');
  const initMode = (params.scanMode as ScanMode) || 'color';

  const [pages, setPages] = useState<ScannedPage[]>(
    initialUris.map((uri) => ({
      id: generateId(),
      uri,
      width: 1080,
      height: 1440,
      rotation: 0,
      scanMode: initMode,
      createdAt: new Date().toISOString(),
    }))
  );

  const [docName, setDocName] = useState(
    `Scan_${new Date().toLocaleDateString('en-US').replace(/\//g, '-')}`
  );
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const [addTimestamp, setAddTimestamp] = useState(false);
  const [saving, setSaving] = useState(false);

  const rotatePage = useCallback(async (index: number) => {
    const page = pages[index];
    try {
      const newUri = await applyRotation(page.uri, 90);
      setPages((prev) =>
        prev.map((p, i) =>
          i === index ? { ...p, uri: newUri, rotation: (p.rotation + 90) % 360 } : p
        )
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to rotate page.');
    }
  }, [pages]);

  const removePage = useCallback((index: number) => {
    if (pages.length === 1) {
      Alert.alert('Cannot Remove', 'You must keep at least one page.');
      return;
    }
    Alert.alert('Remove Page', 'Remove this page from the document?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () =>
        setPages((prev) => prev.filter((_, i) => i !== index))
      },
    ]);
  }, [pages.length]);

  const changeScanMode = useCallback(async (index: number, mode: ScanMode) => {
    const page = pages[index];
    try {
      const newUri = await applyScanMode(page.uri, mode);
      setPages((prev) =>
        prev.map((p, i) => (i === index ? { ...p, uri: newUri, scanMode: mode } : p))
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to apply scan mode.');
    }
  }, [pages]);

  const handleSave = useCallback(async () => {
    if (!docName.trim()) {
      Alert.alert('Name Required', 'Please enter a document name.');
      return;
    }
    setSaving(true);
    try {
      const doc = await createNewDocument(pages, docName.trim(), exportFormat, addTimestamp);
      router.replace(`/document/${doc.id}`);
    } catch (e) {
      Alert.alert('Save Error', 'Failed to save document. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [pages, docName, exportFormat, addTimestamp, createNewDocument, router]);

  const movePageUp = (index: number) => {
    if (index === 0) return;
    setPages((prev) => {
      const copy = [...prev];
      [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
      return copy;
    });
  };

  const movePageDown = (index: number) => {
    if (index === pages.length - 1) return;
    setPages((prev) => {
      const copy = [...prev];
      [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
      return copy;
    });
  };

  const renderPage = ({ item, index }: { item: ScannedPage; index: number }) => (
    <View style={styles.pageCard}>
      <View style={styles.pageNumber}>
        <Text style={styles.pageNumberText}>{index + 1}</Text>
      </View>
      <Image source={{ uri: item.uri }} style={styles.pageImage} resizeMode="contain" />
      <View style={styles.pageActions}>
        <TouchableOpacity style={styles.pageActionBtn} onPress={() => rotatePage(index)}>
          <Ionicons name="refresh-outline" size={18} color={Colors.primary} />
          <Text style={styles.pageActionText}>Rotate</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pageActionBtn} onPress={() => movePageUp(index)}>
          <Ionicons name="chevron-up" size={18} color={index === 0 ? Colors.border : Colors.primary} />
          <Text style={[styles.pageActionText, index === 0 && { color: Colors.border }]}>Up</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pageActionBtn} onPress={() => movePageDown(index)}>
          <Ionicons name="chevron-down" size={18} color={index === pages.length - 1 ? Colors.border : Colors.primary} />
          <Text style={[styles.pageActionText, index === pages.length - 1 && { color: Colors.border }]}>Down</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pageActionBtn} onPress={() => removePage(index)}>
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
          <Text style={[styles.pageActionText, { color: Colors.error }]}>Remove</Text>
        </TouchableOpacity>
      </View>
      {/* Scan Mode Selector */}
      <View style={styles.scanModeRow}>
        {(['color', 'grayscale', 'blackwhite'] as ScanMode[]).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.scanModeBtn, item.scanMode === mode && styles.scanModeBtnActive]}
            onPress={() => changeScanMode(index, mode)}
          >
            <Text style={[styles.scanModeBtnText, item.scanMode === mode && styles.scanModeBtnTextActive]}>
              {mode === 'color' ? 'Color' : mode === 'grayscale' ? 'Gray' : 'B&W'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.settingsPanel} showsVerticalScrollIndicator={false}>
        {/* Document Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Document Settings</Text>
          <View style={styles.inputRow}>
            <Ionicons name="document-outline" size={20} color={Colors.textSecondary} />
            <TextInput
              style={styles.input}
              value={docName}
              onChangeText={setDocName}
              placeholder="Document name"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
        </View>

        {/* Export Format */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export Format</Text>
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
        </View>

        {/* Timestamp Option */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
              <View style={{ marginLeft: Spacing.sm }}>
                <Text style={styles.switchLabel}>Add Date/Time Stamp</Text>
                <Text style={styles.switchSubLabel}>Adds timestamp to exported file</Text>
              </View>
            </View>
            <Switch
              value={addTimestamp}
              onValueChange={setAddTimestamp}
              trackColor={{ true: Colors.primary, false: Colors.border }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        {/* Pages */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{pages.length} Page{pages.length !== 1 ? 's' : ''}</Text>
          <FlatList
            data={pages}
            renderItem={renderPage}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pagesContainer}
            scrollEnabled={pages.length > 1}
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save Button */}
      <View style={styles.saveContainer}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={22} color={Colors.white} />
              <Text style={styles.saveBtnText}>Save Document</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  settingsPanel: { flex: 1 },
  section: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    gap: Spacing.sm,
  },
  input: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  formatRow: { flexDirection: 'row', gap: Spacing.sm },
  formatBtn: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  formatBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  formatBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  formatBtnTextActive: { color: Colors.white },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  switchLabel: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  switchSubLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  pagesContainer: { gap: Spacing.sm, paddingRight: Spacing.md },
  pageCard: {
    width: 160,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pageNumber: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  pageNumberText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  pageImage: { width: 160, height: 210, backgroundColor: Colors.border },
  pageActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  pageActionBtn: { alignItems: 'center', padding: 4 },
  pageActionText: { fontSize: 9, color: Colors.primary, marginTop: 1 },
  scanModeRow: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    backgroundColor: Colors.surfaceSecondary,
  },
  scanModeBtn: {
    flex: 1,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  scanModeBtnActive: { backgroundColor: Colors.primary },
  scanModeBtnText: { fontSize: 9, fontWeight: '600', color: Colors.textSecondary },
  scanModeBtnTextActive: { color: Colors.white },
  saveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  saveBtn: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
});
