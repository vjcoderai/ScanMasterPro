import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, Linking, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/hooks/useTheme';
import { useDocuments } from '../../src/hooks/useDocuments';
import { Spacing, BorderRadius, FontSize, SETTINGS_STORAGE_KEY, Themes } from '../../src/constants';
import { formatFileSize, getDocumentsDir, getExportsDir, getMergedDir, getCompressedDir } from '../../src/utils/storage';
import { ExportFormat, ScanMode, ThemeType } from '../../src/types';

interface Settings {
  defaultFormat: ExportFormat;
  defaultScanMode: ScanMode;
  addTimestampByDefault: boolean;
  highQualityCapture: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  defaultFormat: 'pdf', defaultScanMode: 'color',
  addTimestampByDefault: false, highQualityCapture: true,
};

const THEME_OPTIONS: { id: ThemeType; name: string; icon: string }[] = [
  { id: 'light', name: 'Light', icon: 'sunny-outline' },
  { id: 'dark', name: 'Dark', icon: 'moon-outline' },
  { id: 'blue', name: 'Ocean Blue', icon: 'water-outline' },
  { id: 'green', name: 'Forest Green', icon: 'leaf-outline' },
  { id: 'purple', name: 'Royal Purple', icon: 'color-palette-outline' },
  { id: 'orange', name: 'Sunset Orange', icon: 'flame-outline' },
];

export default function SettingsScreen() {
  const { documents } = useDocuments();
  const { theme, colors, setTheme } = useTheme();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [storageUsed, setStorageUsed] = useState(0);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showStorageInfo, setShowStorageInfo] = useState(false);

  useEffect(() => { loadSettings(); calculateStorage(); }, []);

  const loadSettings = async () => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {}
  };

  const saveSettings = async (newSettings: Settings) => {
    setSettings(newSettings);
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    const existing = raw ? JSON.parse(raw) : {};
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...existing, ...newSettings }));
  };

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    saveSettings({ ...settings, [key]: value });
  };

  const calculateStorage = async () => {
    try {
      let total = 0;
      const dirs = [getDocumentsDir(), getExportsDir(), getMergedDir(), getCompressedDir()];
      for (const dir of dirs) {
        const info = await FileSystem.getInfoAsync(dir);
        if (info.exists) {
          const files = await FileSystem.readDirectoryAsync(dir);
          for (const file of files) {
            const fi = await FileSystem.getInfoAsync(dir + file, { size: true });
            if (fi.exists && 'size' in fi) total += (fi as any).size;
          }
        }
      }
      setStorageUsed(total);
    } catch {}
  };

  const clearExports = async () => {
    Alert.alert('Clear Exports', 'Delete all exported files but keep scanned documents?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        try {
          const dirs = [getExportsDir(), getMergedDir(), getCompressedDir()];
          for (const dir of dirs) {
            const info = await FileSystem.getInfoAsync(dir);
            if (info.exists) {
              await FileSystem.deleteAsync(dir, { idempotent: true });
              await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
            }
          }
          calculateStorage();
          Alert.alert('Done', 'Exported files cleared.');
        } catch { Alert.alert('Error', 'Failed to clear exports.'); }
      }},
    ]);
  };

  const clearAllData = () => {
    Alert.alert('Clear All Data', 'This will permanently delete ALL documents. Cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Everything', style: 'destructive', onPress: async () => {
        try {
          const dirs = [getDocumentsDir(), getExportsDir(), getMergedDir(), getCompressedDir()];
          for (const dir of dirs) {
            const info = await FileSystem.getInfoAsync(dir);
            if (info.exists) {
              await FileSystem.deleteAsync(dir, { idempotent: true });
              await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
            }
          }
          await AsyncStorage.clear();
          calculateStorage();
          Alert.alert('Done', 'All data cleared. Restart the app.');
        } catch { Alert.alert('Error', 'Failed to clear all data.'); }
      }},
    ]);
  };

  const SettingRow = ({ icon, label, subtitle, iconColor = colors.primary, right }: { icon: string; label: string; subtitle?: string; iconColor?: string; right: React.ReactNode }) => (
    <View style={styles.settingRow}>
      <View style={[styles.settingIconBox, { backgroundColor: iconColor + '15' }]}>
        <Ionicons name={icon as any} size={20} color={iconColor} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
        {subtitle && <Text style={[styles.settingSubtitle, { color: colors.textTertiary }]}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Appearance */}
      <Text style={[styles.groupHeader, { color: colors.textSecondary }]}>Appearance</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => setShowThemeModal(true)}>
          <SettingRow
            icon="color-palette-outline" iconColor={colors.primary}
            label="Theme" subtitle={THEME_OPTIONS.find(t => t.id === theme)?.name}
            right={<Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />}
          />
        </TouchableOpacity>
      </View>

      {/* Scan Defaults */}
      <Text style={[styles.groupHeader, { color: colors.textSecondary }]}>Scan Defaults</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <SettingRow icon="document-outline" label="Default Format" subtitle="Format when saving scans" right={
          <View style={styles.miniSelector}>
            {(['pdf', 'jpg', 'png'] as ExportFormat[]).map(f => (
              <TouchableOpacity key={f} style={[styles.miniSelectorBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, settings.defaultFormat === f && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => updateSetting('defaultFormat', f)}>
                <Text style={[styles.miniSelectorText, { color: settings.defaultFormat === f ? colors.white : colors.textSecondary }]}>{f.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        } />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SettingRow icon="color-palette-outline" label="Default Color Mode" subtitle="Color setting for new scans" right={
          <View style={styles.miniSelector}>
            {(['color', 'grayscale', 'blackwhite'] as ScanMode[]).map(m => (
              <TouchableOpacity key={m} style={[styles.miniSelectorBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, settings.defaultScanMode === m && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => updateSetting('defaultScanMode', m)}>
                <Text style={[styles.miniSelectorText, { color: settings.defaultScanMode === m ? colors.white : colors.textSecondary }]}>{m === 'color' ? 'C' : m === 'grayscale' ? 'G' : 'BW'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        } />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SettingRow icon="time-outline" label="Add Timestamp by Default" subtitle="Automatically stamp exports" right={
          <Switch value={settings.addTimestampByDefault} onValueChange={v => updateSetting('addTimestampByDefault', v)} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.white} />
        } />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SettingRow icon="camera-outline" label="High Quality Capture" subtitle="Uses more storage per scan" right={
          <Switch value={settings.highQualityCapture} onValueChange={v => updateSetting('highQualityCapture', v)} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.white} />
        } />
      </View>

      {/* Storage */}
      <Text style={[styles.groupHeader, { color: colors.textSecondary }]}>Storage</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.storageInfo}>
          <View style={styles.storageRow}>
            <Ionicons name="folder-outline" size={20} color={colors.primary} />
            <Text style={[styles.storageLabel, { color: colors.text }]}>Storage Used</Text>
            <Text style={[styles.storageValue, { color: colors.primary }]}>{formatFileSize(storageUsed)}</Text>
          </View>
          <View style={styles.storageRow}>
            <Ionicons name="document-text-outline" size={20} color={colors.secondary || colors.primary} />
            <Text style={[styles.storageLabel, { color: colors.text }]}>Documents</Text>
            <Text style={[styles.storageValue, { color: colors.primary }]}>{documents.length}</Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <TouchableOpacity style={styles.actionRow} onPress={() => setShowStorageInfo(true)}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={[styles.actionRowText, { color: colors.text }]}>Where are my files stored?</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <TouchableOpacity style={styles.actionRow} onPress={clearExports}>
          <Ionicons name="trash-bin-outline" size={20} color={colors.warning} />
          <Text style={[styles.actionRowText, { color: colors.warning }]}>Clear Exported Files</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <TouchableOpacity style={styles.actionRow} onPress={clearAllData}>
          <Ionicons name="warning-outline" size={20} color={colors.error} />
          <Text style={[styles.actionRowText, { color: colors.error }]}>Clear All App Data</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* About */}
      <Text style={[styles.groupHeader, { color: colors.textSecondary }]}>About</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.aboutRow}>
          <View style={[styles.appIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="scan-outline" size={32} color={colors.white} />
          </View>
          <View style={styles.aboutInfo}>
            <Text style={[styles.appName, { color: colors.text }]}>ScanMaster Pro</Text>
            <Text style={[styles.appVersion, { color: colors.textSecondary }]}>Version 2.0.0</Text>
            <Text style={[styles.appTagline, { color: colors.textTertiary }]}>Professional document scanning</Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.featureList}>
          {[
            '📷 Auto edge detection',
            '✂️ Crop, rotate, brightness/contrast',
            '🎨 Color filters & grayscale',
            '🖍️ Markup & annotations',
            '🔍 OCR text extraction',
            '📄 Export as PDF/JPG/PNG',
            '🔒 Password-protected PDFs',
            '📎 Real PDF merging',
            '📁 Organized folders',
            '🌓 6 theme options',
          ].map((f, i) => <Text key={i} style={[styles.featureItem, { color: colors.textSecondary }]}>{f}</Text>)}
        </View>
      </View>

      <View style={{ height: 40 }} />

      {/* Theme Modal */}
      <Modal visible={showThemeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.themeModal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Choose Theme</Text>
            {THEME_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.themeOption, { borderColor: colors.border }, theme === opt.id && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
                onPress={() => { setTheme(opt.id); setShowThemeModal(false); }}
              >
                <View style={[styles.themeSwatch, { backgroundColor: Themes[opt.id].primary }]} />
                <Ionicons name={opt.icon as any} size={20} color={colors.text} />
                <Text style={[styles.themeOptionText, { color: colors.text }]}>{opt.name}</Text>
                {theme === opt.id && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.surfaceSecondary }]} onPress={() => setShowThemeModal(false)}>
              <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Storage Location Info */}
      <Modal visible={showStorageInfo} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.storageModal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>File Storage</Text>
            <Text style={[styles.storageDesc, { color: colors.textSecondary }]}>
              All documents and exports are saved in this app's private storage, organized into folders:
            </Text>
            {[
              { name: 'scans/', desc: 'Original scanned pages' },
              { name: 'exports/', desc: 'Exported PDF/JPG/PNG and converted images' },
              { name: 'merged/', desc: 'Merged PDF files' },
              { name: 'compressed/', desc: 'Compressed images' },
            ].map(item => (
              <View key={item.name} style={[styles.pathRow, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.pathName, { color: colors.primary }]}>{item.name}</Text>
                <Text style={[styles.pathDesc, { color: colors.textSecondary }]}>{item.desc}</Text>
              </View>
            ))}
            <Text style={[styles.storageDesc, { color: colors.textSecondary, marginTop: Spacing.sm }]}>
              To move files to your phone's main storage or another app, use the <Text style={{ fontWeight: '700' }}>Share</Text> button on any document and choose "Save to Files" / "Save to Drive" / a file manager app.
            </Text>
            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.primary, marginTop: Spacing.md }]} onPress={() => setShowStorageInfo(false)}>
              <Text style={[styles.closeBtnText, { color: colors.white }]}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md },
  groupHeader: { fontSize: FontSize.sm, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: Spacing.lg, marginBottom: Spacing.sm, marginLeft: Spacing.xs },
  card: { borderRadius: BorderRadius.lg, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  settingIconBox: { width: 36, height: 36, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: FontSize.md, fontWeight: '600' },
  settingSubtitle: { fontSize: FontSize.xs, marginTop: 1 },
  divider: { height: 1, marginLeft: Spacing.md + 36 + Spacing.md },
  miniSelector: { flexDirection: 'row', gap: 2 },
  miniSelectorBtn: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 5, borderWidth: 1 },
  miniSelectorText: { fontSize: 10, fontWeight: '700' },
  storageInfo: { padding: Spacing.md, gap: Spacing.sm },
  storageRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  storageLabel: { flex: 1, fontSize: FontSize.md },
  storageValue: { fontSize: FontSize.md, fontWeight: '700' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  actionRowText: { flex: 1, fontSize: FontSize.md, fontWeight: '600' },
  aboutRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  appIcon: { width: 64, height: 64, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  aboutInfo: { flex: 1 },
  appName: { fontSize: FontSize.lg, fontWeight: '800' },
  appVersion: { fontSize: FontSize.sm },
  appTagline: { fontSize: FontSize.xs, marginTop: 2 },
  featureList: { padding: Spacing.md, gap: 6 },
  featureItem: { fontSize: FontSize.sm, lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  themeModal: { width: '85%', borderRadius: BorderRadius.lg, padding: Spacing.lg, maxHeight: '80%' },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md },
  themeOption: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1.5, marginBottom: Spacing.sm },
  themeSwatch: { width: 24, height: 24, borderRadius: 12 },
  themeOptionText: { flex: 1, fontSize: FontSize.md, fontWeight: '600' },
  closeBtn: { height: 44, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  closeBtnText: { fontSize: FontSize.md, fontWeight: '700' },
  storageModal: { width: '88%', borderRadius: BorderRadius.lg, padding: Spacing.lg },
  storageDesc: { fontSize: FontSize.sm, lineHeight: 20, marginBottom: Spacing.sm },
  pathRow: { borderRadius: BorderRadius.sm, padding: Spacing.sm, marginBottom: Spacing.xs },
  pathName: { fontSize: FontSize.sm, fontWeight: '700', fontFamily: 'monospace' },
  pathDesc: { fontSize: FontSize.xs, marginTop: 2 },
});
