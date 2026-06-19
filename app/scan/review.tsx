import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  Alert, TextInput, ActivityIndicator, ScrollView, Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDocuments } from '../../src/hooks/useDocuments';
import { useTheme } from '../../src/hooks/useTheme';
import { ScannedPage, ScanMode, ExportFormat, FolderType } from '../../src/types';
import { Spacing, BorderRadius, FontSize, FOLDERS } from '../../src/constants';
import { generateId } from '../../src/utils/storage';
import { applyRotation, applyScanMode } from '../../src/utils/imageUtils';

export default function ReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ pages: string; scanMode: string }>();
  const { createNewDocument } = useDocuments();
  const { colors } = useTheme();

  const initialUris: string[] = JSON.parse(params.pages || '[]');
  const initMode = (params.scanMode as ScanMode) || 'color';

  const [pages, setPages] = useState<ScannedPage[]>(
    initialUris.map(uri => ({
      id: generateId(), uri, width: 1080, height: 1440, rotation: 0,
      scanMode: initMode, createdAt: new Date().toISOString(),
    }))
  );

  const [docName, setDocName] = useState(`Scan_${new Date().toLocaleDateString('en-US').replace(/\//g, '-')}`);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const [addTimestamp, setAddTimestamp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [folder, setFolder] = useState<FolderType>('scans');
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');

  const rotatePage = useCallback(async (index: number) => {
    const page = pages[index];
    try {
      const newUri = await applyRotation(page.uri, 90);
      setPages(prev => prev.map((p, i) => i === index ? { ...p, uri: newUri, rotation: (p.rotation + 90) % 360 } : p));
    } catch { Alert.alert('Error', 'Failed to rotate page.'); }
  }, [pages]);

  const removePage = useCallback((index: number) => {
    if (pages.length === 1) { Alert.alert('Cannot Remove', 'Keep at least one page.'); return; }
    Alert.alert('Remove Page', 'Remove this page?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setPages(prev => prev.filter((_, i) => i !== index)) },
    ]);
  }, [pages.length]);

  const changeScanMode = useCallback(async (index: number, mode: ScanMode) => {
    const page = pages[index];
    try {
      const newUri = await applyScanMode(page.uri, mode);
      setPages(prev => prev.map((p, i) => i === index ? { ...p, uri: newUri, scanMode: mode } : p));
    } catch { Alert.alert('Error', 'Failed to apply scan mode.'); }
  }, [pages]);

  const handleSave = useCallback(async () => {
    if (!docName.trim()) { Alert.alert('Name Required', 'Enter a document name.'); return; }
    if (usePassword && password.length < 4) { Alert.alert('Weak Password', 'Password must be at least 4 characters.'); return; }
    setSaving(true);
    try {
      const doc = await createNewDocument(pages, docName.trim(), exportFormat, addTimestamp, folder, usePassword ? password : undefined);
      router.replace(`/document/${doc.id}`);
    } catch {
      Alert.alert('Save Error', 'Failed to save document. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [pages, docName, exportFormat, addTimestamp, folder, usePassword, password, createNewDocument, router]);

  const movePageUp = (index: number) => {
    if (index === 0) return;
    setPages(prev => { const c = [...prev]; [c[index - 1], c[index]] = [c[index], c[index - 1]]; return c; });
  };
  const movePageDown = (index: number) => {
    if (index === pages.length - 1) return;
    setPages(prev => { const c = [...prev]; [c[index], c[index + 1]] = [c[index + 1], c[index]]; return c; });
  };

  const renderPage = ({ item, index }: { item: ScannedPage; index: number }) => (
    <View style={[styles.pageCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
      <View style={[styles.pageNumber, { backgroundColor: colors.primary }]}><Text style={styles.pageNumberText}>{index + 1}</Text></View>
      <Image source={{ uri: item.uri }} style={[styles.pageImage, { backgroundColor: colors.border }]} resizeMode="contain" />
      <View style={[styles.pageActions, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity style={styles.pageActionBtn} onPress={() => rotatePage(index)}>
          <Ionicons name="refresh-outline" size={18} color={colors.primary} />
          <Text style={[styles.pageActionText, { color: colors.primary }]}>Rotate</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pageActionBtn} onPress={() => movePageUp(index)}>
          <Ionicons name="chevron-up" size={18} color={index === 0 ? colors.border : colors.primary} />
          <Text style={[styles.pageActionText, { color: index === 0 ? colors.border : colors.primary }]}>Up</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pageActionBtn} onPress={() => movePageDown(index)}>
          <Ionicons name="chevron-down" size={18} color={index === pages.length - 1 ? colors.border : colors.primary} />
          <Text style={[styles.pageActionText, { color: index === pages.length - 1 ? colors.border : colors.primary }]}>Down</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pageActionBtn} onPress={() => removePage(index)}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text style={[styles.pageActionText, { color: colors.error }]}>Remove</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.scanModeRow, { backgroundColor: colors.surfaceSecondary }]}>
        {(['color', 'grayscale', 'blackwhite'] as ScanMode[]).map(mode => (
          <TouchableOpacity key={mode} style={[styles.scanModeBtn, { backgroundColor: colors.border }, item.scanMode === mode && { backgroundColor: colors.primary }]} onPress={() => changeScanMode(index, mode)}>
            <Text style={[styles.scanModeBtnText, { color: item.scanMode === mode ? colors.white : colors.textSecondary }]}>
              {mode === 'color' ? 'Color' : mode === 'grayscale' ? 'Gray' : 'B&W'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.settingsPanel} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Document Settings</Text>
          <View style={[styles.inputRow, { borderColor: colors.border }]}>
            <Ionicons name="document-outline" size={20} color={colors.textSecondary} />
            <TextInput style={[styles.input, { color: colors.text }]} value={docName} onChangeText={setDocName} placeholder="Document name" placeholderTextColor={colors.textTertiary} />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Save to Folder</Text>
          <View style={styles.folderGrid}>
            {FOLDERS.filter(f => f.id !== 'merged' && f.id !== 'compressed' && f.id !== 'converted').map(f => (
              <TouchableOpacity key={f.id} style={[styles.folderBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, folder === f.id && { backgroundColor: f.color, borderColor: f.color }]} onPress={() => setFolder(f.id as FolderType)}>
                <Ionicons name={f.icon as any} size={18} color={folder === f.id ? colors.white : f.color} />
                <Text style={[styles.folderBtnText, { color: folder === f.id ? colors.white : colors.text }]}>{f.name}</Text>
              </TouchableOpacity>
            ))}
            {FOLDERS.filter(f => f.id === 'custom').map(f => (
              <TouchableOpacity key={f.id} style={[styles.folderBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, folder === f.id && { backgroundColor: f.color, borderColor: f.color }]} onPress={() => setFolder(f.id as FolderType)}>
                <Ionicons name={f.icon as any} size={18} color={folder === f.id ? colors.white : f.color} />
                <Text style={[styles.folderBtnText, { color: folder === f.id ? colors.white : colors.text }]}>{f.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Export Format</Text>
          <View style={styles.formatRow}>
            {(['pdf', 'jpg', 'png'] as ExportFormat[]).map(fmt => (
              <TouchableOpacity key={fmt} style={[styles.formatBtn, { borderColor: colors.border }, exportFormat === fmt && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setExportFormat(fmt)}>
                <Text style={[styles.formatBtnText, { color: exportFormat === fmt ? colors.white : colors.textSecondary }]}>{fmt.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
              <View style={{ marginLeft: Spacing.sm }}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>Add Date/Time Stamp</Text>
                <Text style={[styles.switchSubLabel, { color: colors.textTertiary }]}>Adds timestamp to exported file</Text>
              </View>
            </View>
            <Switch value={addTimestamp} onValueChange={setAddTimestamp} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.white} />
          </View>
        </View>

        {exportFormat === 'pdf' && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
                <View style={{ marginLeft: Spacing.sm }}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>Password Protect PDF</Text>
                  <Text style={[styles.switchSubLabel, { color: colors.textTertiary }]}>Require password to open</Text>
                </View>
              </View>
              <Switch value={usePassword} onValueChange={setUsePassword} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.white} />
            </View>
            {usePassword && (
              <View style={[styles.inputRow, { borderColor: colors.border, marginTop: Spacing.sm }]}>
                <Ionicons name="key-outline" size={20} color={colors.textSecondary} />
                <TextInput style={[styles.input, { color: colors.text }]} value={password} onChangeText={setPassword} placeholder="Enter password (min 4 chars)" placeholderTextColor={colors.textTertiary} secureTextEntry />
              </View>
            )}
          </View>
        )}

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{pages.length} Page{pages.length !== 1 ? 's' : ''}</Text>
          <FlatList data={pages} renderItem={renderPage} keyExtractor={item => item.id} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pagesContainer} scrollEnabled={pages.length > 1} />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.saveContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={colors.white} /> : <><Ionicons name="checkmark-circle-outline" size={22} color={colors.white} /><Text style={[styles.saveBtnText, { color: colors.white }]}>Save Document</Text></>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  settingsPanel: { flex: 1 },
  section: { marginHorizontal: Spacing.md, marginTop: Spacing.md, borderRadius: BorderRadius.lg, padding: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', marginBottom: Spacing.md },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 48, gap: Spacing.sm },
  input: { flex: 1, fontSize: FontSize.md },
  folderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  folderBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1.5 },
  folderBtnText: { fontSize: FontSize.sm, fontWeight: '600' },
  formatRow: { flexDirection: 'row', gap: Spacing.sm },
  formatBtn: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, borderWidth: 1.5 },
  formatBtnText: { fontSize: FontSize.sm, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  switchLabel: { fontSize: FontSize.md, fontWeight: '600' },
  switchSubLabel: { fontSize: FontSize.xs, marginTop: 2 },
  pagesContainer: { gap: Spacing.sm, paddingRight: Spacing.md },
  pageCard: { width: 160, borderRadius: BorderRadius.md, overflow: 'hidden', borderWidth: 1 },
  pageNumber: { position: 'absolute', top: 6, left: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  pageNumberText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  pageImage: { width: 160, height: 210 },
  pageActions: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: Spacing.xs, borderTopWidth: 1 },
  pageActionBtn: { alignItems: 'center', padding: 4 },
  pageActionText: { fontSize: 9, marginTop: 1 },
  scanModeRow: { flexDirection: 'row', padding: 4, gap: 4 },
  scanModeBtn: { flex: 1, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  scanModeBtnText: { fontSize: 9, fontWeight: '600' },
  saveContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.md, borderTopWidth: 1 },
  saveBtn: { height: 52, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontSize: FontSize.md, fontWeight: '700' },
});
