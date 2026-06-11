import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, SETTINGS_STORAGE_KEY } from '../../src/constants';
import { useDocuments } from '../../src/hooks/useDocuments';
import { formatFileSize, getDocumentsDir, getExportsDir } from '../../src/utils/storage';
import { ExportFormat, ScanMode } from '../../src/types';

interface Settings {
  defaultFormat: ExportFormat;
  defaultScanMode: ScanMode;
  addTimestampByDefault: boolean;
  highQualityCapture: boolean;
  darkMode: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  defaultFormat: 'pdf',
  defaultScanMode: 'color',
  addTimestampByDefault: false,
  highQualityCapture: true,
  darkMode: false,
};

export default function SettingsScreen() {
  const { documents } = useDocuments();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [storageUsed, setStorageUsed] = useState(0);

  useEffect(() => {
    loadSettings();
    calculateStorage();
  }, []);

  const loadSettings = async () => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {}
  };

  const saveSettings = async (newSettings: Settings) => {
    setSettings(newSettings);
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
  };

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const updated = { ...settings, [key]: value };
    saveSettings(updated);
  };

  const calculateStorage = async () => {
    try {
      let total = 0;
      const dirs = [getDocumentsDir(), getExportsDir()];
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
    Alert.alert(
      'Clear Exports',
      'This will delete all exported files but keep your scanned documents.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const dir = getExportsDir();
              const info = await FileSystem.getInfoAsync(dir);
              if (info.exists) {
                await FileSystem.deleteAsync(dir, { idempotent: true });
                await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
              }
              calculateStorage();
              Alert.alert('Done', 'Exported files have been cleared.');
            } catch {
              Alert.alert('Error', 'Failed to clear exports.');
            }
          },
        },
      ]
    );
  };

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete ALL documents and exports. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              const dirs = [getDocumentsDir(), getExportsDir()];
              for (const dir of dirs) {
                const info = await FileSystem.getInfoAsync(dir);
                if (info.exists) {
                  await FileSystem.deleteAsync(dir, { idempotent: true });
                  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
                }
              }
              await AsyncStorage.clear();
              calculateStorage();
              Alert.alert('Done', 'All data has been cleared. Restart the app.');
            } catch {
              Alert.alert('Error', 'Failed to clear all data.');
            }
          },
        },
      ]
    );
  };

  const SettingRow = ({
    icon,
    label,
    subtitle,
    iconColor = Colors.primary,
    right,
  }: {
    icon: string;
    label: string;
    subtitle?: string;
    iconColor?: string;
    right: React.ReactNode;
  }) => (
    <View style={styles.settingRow}>
      <View style={[styles.settingIconBox, { backgroundColor: iconColor + '15' }]}>
        <Ionicons name={icon as any} size={20} color={iconColor} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );

  const FormatSelector = ({
    value,
    onChange,
  }: {
    value: ExportFormat;
    onChange: (v: ExportFormat) => void;
  }) => (
    <View style={styles.miniSelector}>
      {(['pdf', 'jpg', 'png'] as ExportFormat[]).map((f) => (
        <TouchableOpacity
          key={f}
          style={[styles.miniSelectorBtn, value === f && styles.miniSelectorBtnActive]}
          onPress={() => onChange(f)}
        >
          <Text style={[styles.miniSelectorText, value === f && styles.miniSelectorTextActive]}>
            {f.toUpperCase()}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Scan Defaults */}
      <Text style={styles.groupHeader}>Scan Defaults</Text>
      <View style={styles.card}>
        <SettingRow
          icon="document-outline"
          label="Default Format"
          subtitle="File format when saving scans"
          right={
            <FormatSelector
              value={settings.defaultFormat}
              onChange={(v) => updateSetting('defaultFormat', v)}
            />
          }
        />
        <View style={styles.divider} />
        <SettingRow
          icon="color-palette-outline"
          label="Default Color Mode"
          subtitle="Color setting for new scans"
          right={
            <View style={styles.miniSelector}>
              {(['color', 'grayscale', 'blackwhite'] as ScanMode[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.miniSelectorBtn, settings.defaultScanMode === m && styles.miniSelectorBtnActive]}
                  onPress={() => updateSetting('defaultScanMode', m)}
                >
                  <Text style={[styles.miniSelectorText, settings.defaultScanMode === m && styles.miniSelectorTextActive]}>
                    {m === 'color' ? 'C' : m === 'grayscale' ? 'G' : 'BW'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          }
        />
        <View style={styles.divider} />
        <SettingRow
          icon="time-outline"
          label="Add Timestamp by Default"
          subtitle="Automatically stamp exports"
          right={
            <Switch
              value={settings.addTimestampByDefault}
              onValueChange={(v) => updateSetting('addTimestampByDefault', v)}
              trackColor={{ true: Colors.primary, false: Colors.border }}
              thumbColor={Colors.white}
            />
          }
        />
        <View style={styles.divider} />
        <SettingRow
          icon="camera-outline"
          label="High Quality Capture"
          subtitle="Uses more storage per scan"
          right={
            <Switch
              value={settings.highQualityCapture}
              onValueChange={(v) => updateSetting('highQualityCapture', v)}
              trackColor={{ true: Colors.primary, false: Colors.border }}
              thumbColor={Colors.white}
            />
          }
        />
      </View>

      {/* Storage */}
      <Text style={styles.groupHeader}>Storage</Text>
      <View style={styles.card}>
        <View style={styles.storageInfo}>
          <View style={styles.storageRow}>
            <Ionicons name="folder-outline" size={20} color={Colors.primary} />
            <Text style={styles.storageLabel}>Storage Used</Text>
            <Text style={styles.storageValue}>{formatFileSize(storageUsed)}</Text>
          </View>
          <View style={styles.storageRow}>
            <Ionicons name="document-text-outline" size={20} color={Colors.secondary} />
            <Text style={styles.storageLabel}>Documents</Text>
            <Text style={styles.storageValue}>{documents.length}</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.actionRow} onPress={clearExports}>
          <Ionicons name="trash-bin-outline" size={20} color={Colors.warning} />
          <Text style={[styles.actionRowText, { color: Colors.warning }]}>Clear Exported Files</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.actionRow} onPress={clearAllData}>
          <Ionicons name="warning-outline" size={20} color={Colors.error} />
          <Text style={[styles.actionRowText, { color: Colors.error }]}>Clear All App Data</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* About */}
      <Text style={styles.groupHeader}>About</Text>
      <View style={styles.card}>
        <View style={styles.aboutRow}>
          <View style={styles.appIcon}>
            <Ionicons name="scan-outline" size={32} color={Colors.white} />
          </View>
          <View style={styles.aboutInfo}>
            <Text style={styles.appName}>ScanMaster Pro</Text>
            <Text style={styles.appVersion}>Version 1.0.0</Text>
            <Text style={styles.appTagline}>Professional document scanning</Text>
          </View>
        </View>
        <View style={styles.divider} />
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => Linking.openURL('https://expo.dev')}
        >
          <Ionicons name="logo-github" size={20} color={Colors.text} />
          <Text style={styles.actionRowText}>Built with Expo</Text>
          <Ionicons name="open-outline" size={16} color={Colors.textTertiary} />
        </TouchableOpacity>
        <View style={styles.divider} />
        <View style={styles.featureList}>
          {[
            '📷 Camera scanning with edge detection',
            '📄 Export as PDF, JPG, or PNG',
            '🗜️ File compression',
            '🔄 Image rotation & cropping',
            '📐 Aspect ratio control',
            '📎 Merge & convert PDFs',
            '🕐 Date/time stamping',
            '📱 Share with any app',
          ].map((f, i) => (
            <Text key={i} style={styles.featureItem}>{f}</Text>
          ))}
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md },
  groupHeader: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  settingIconBox: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  settingSubtitle: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 1 },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: Spacing.md + 36 + Spacing.md },
  miniSelector: { flexDirection: 'row', gap: 2 },
  miniSelectorBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  miniSelectorBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  miniSelectorText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },
  miniSelectorTextActive: { color: Colors.white },
  storageInfo: { padding: Spacing.md, gap: Spacing.sm },
  storageRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  storageLabel: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  storageValue: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  actionRowText: { flex: 1, fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  appIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutInfo: { flex: 1 },
  appName: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  appVersion: { fontSize: FontSize.sm, color: Colors.textSecondary },
  appTagline: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  featureList: { padding: Spacing.md, gap: 6 },
  featureItem: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
});
