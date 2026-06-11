import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize } from '../../src/constants';
import { compressImage } from '../../src/utils/imageUtils';
import { formatFileSize, getExportsDir } from '../../src/utils/storage';
import { ExportFormat } from '../../src/types';

export default function CompressScreen() {
  const [sourceUri, setSourceUri] = useState<string | null>(null);
  const [sourceSize, setSourceSize] = useState(0);
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);
  const [quality, setQuality] = useState(0.7);
  const [format, setFormat] = useState<'jpg' | 'png'>('jpg');
  const [processing, setProcessing] = useState(false);
  const [sourceIsImage, setSourceIsImage] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setSourceUri(uri);
      setSourceIsImage(true);
      setResultUri(null);
      const info = await FileSystem.getInfoAsync(uri, { size: true });
      if (info.exists && 'size' in info) setSourceSize((info as any).size);
    }
  };

  const handleCompress = async () => {
    if (!sourceUri) return;
    setProcessing(true);
    try {
      const compressed = await compressImage(sourceUri, { quality, format });
      const dir = getExportsDir();
      const dest = `${dir}compressed_${Date.now()}.${format}`;
      await FileSystem.copyAsync({ from: compressed, to: dest });
      setResultUri(dest);
      const info = await FileSystem.getInfoAsync(dest, { size: true });
      if (info.exists && 'size' in info) setResultSize((info as any).size);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Compression failed.');
    } finally {
      setProcessing(false);
    }
  };

  const handleShare = async () => {
    if (!resultUri) return;
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) await Sharing.shareAsync(resultUri);
  };

  const qualityLabel = quality >= 0.9 ? 'High' : quality >= 0.6 ? 'Medium' : 'Low';
  const savings = sourceSize > 0 && resultSize > 0
    ? Math.round(((sourceSize - resultSize) / sourceSize) * 100)
    : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* File Picker */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Image</Text>
        <TouchableOpacity style={styles.pickBtn} onPress={pickImage}>
          <Ionicons name="image-outline" size={24} color={Colors.primary} />
          <Text style={styles.pickBtnText}>
            {sourceUri ? 'Change Image' : 'Pick from Gallery'}
          </Text>
        </TouchableOpacity>

        {sourceUri && sourceIsImage && (
          <View style={styles.previewRow}>
            <Image source={{ uri: sourceUri }} style={styles.preview} resizeMode="cover" />
            <View style={styles.previewInfo}>
              <Text style={styles.previewLabel}>Original</Text>
              <Text style={styles.previewSize}>{formatFileSize(sourceSize)}</Text>
            </View>
          </View>
        )}
      </View>

      {sourceUri && (
        <>
          {/* Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Compression Settings</Text>

            <Text style={styles.label}>Output Format</Text>
            <View style={styles.row}>
              {(['jpg', 'png'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.fmtBtn, format === f && styles.fmtBtnActive]}
                  onPress={() => setFormat(f)}
                >
                  <Text style={[styles.fmtBtnText, format === f && styles.fmtBtnTextActive]}>
                    {f.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Quality: {qualityLabel} ({Math.round(quality * 100)}%)</Text>
            <View style={styles.qualityRow}>
              {[0.3, 0.5, 0.7, 0.85, 0.95].map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[styles.qualityBtn, quality === q && styles.qualityBtnActive]}
                  onPress={() => setQuality(q)}
                >
                  <Text style={[styles.qualityBtnText, quality === q && styles.qualityBtnTextActive]}>
                    {Math.round(q * 100)}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Compress Button */}
          <TouchableOpacity
            style={[styles.actionBtn, processing && styles.actionBtnDisabled]}
            onPress={handleCompress}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="resize-outline" size={20} color={Colors.white} />
                <Text style={styles.actionBtnText}>Compress</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Result */}
          {resultUri && (
            <View style={styles.resultCard}>
              <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
              <Text style={styles.resultTitle}>Compressed Successfully!</Text>
              <View style={styles.resultStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Original</Text>
                  <Text style={styles.statValue}>{formatFileSize(sourceSize)}</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color={Colors.textTertiary} />
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Compressed</Text>
                  <Text style={[styles.statValue, { color: Colors.success }]}>
                    {formatFileSize(resultSize)}
                  </Text>
                </View>
              </View>
              {savings > 0 && (
                <Text style={styles.savingsText}>Saved {savings}% ({formatFileSize(sourceSize - resultSize)})</Text>
              )}
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                <Ionicons name="share-outline" size={18} color={Colors.white} />
                <Text style={styles.shareBtnText}>Share Result</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 52,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '08',
  },
  pickBtnText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },
  previewRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, gap: Spacing.md },
  preview: { width: 70, height: 70, borderRadius: BorderRadius.sm },
  previewInfo: { flex: 1 },
  previewLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  previewSize: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  fmtBtn: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  fmtBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  fmtBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  fmtBtnTextActive: { color: Colors.white },
  qualityRow: { flexDirection: 'row', gap: Spacing.xs },
  qualityBtn: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qualityBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  qualityBtnText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  qualityBtnTextActive: { color: Colors.white },
  actionBtn: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.success + '40',
  },
  resultTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  resultStats: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },
  statValue: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  savingsText: { fontSize: FontSize.md, color: Colors.success, fontWeight: '600' },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  shareBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '600' },
});
