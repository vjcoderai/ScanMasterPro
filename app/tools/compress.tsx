import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/hooks/useTheme';
import { useDocuments } from '../../src/hooks/useDocuments';
import { Spacing, BorderRadius, FontSize } from '../../src/constants';
import { compressImage } from '../../src/utils/imageUtils';
import { compressPDF } from '../../src/utils/pdfUtils';
import { formatFileSize, generateId } from '../../src/utils/storage';
import { ExportFormat } from '../../src/types';

type CompressType = 'image' | 'pdf';

export default function CompressScreen() {
  const { colors } = useTheme();
  const { addDocument } = useDocuments();

  const [compressType, setCompressType] = useState<CompressType>('image');

  // Shared state
  const [sourceUri, setSourceUri] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string>('');
  const [sourceSize, setSourceSize] = useState(0);
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);
  const [quality, setQuality] = useState(0.7);
  const [format, setFormat] = useState<'jpg' | 'png'>('jpg');
  const [processing, setProcessing] = useState(false);

  const resetResult = () => { setResultUri(null); setResultSize(0); };

  // ---------------- IMAGE PICKING ----------------
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setSourceUri(uri);
      setSourceName(uri.split('/').pop() || 'image');
      resetResult();
      const info = await FileSystem.getInfoAsync(uri, { size: true });
      if (info.exists && 'size' in info) setSourceSize((info as any).size);
    }
  };

  // ---------------- PDF PICKING ----------------
  const pickPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setSourceUri(asset.uri);
        setSourceName(asset.name);
        resetResult();
        const info = await FileSystem.getInfoAsync(asset.uri, { size: true });
        const size = info.exists && 'size' in info ? (info as any).size : (asset.size || 0);
        setSourceSize(size);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick PDF file.');
    }
  };

  const handlePick = () => {
    if (compressType === 'image') pickImage();
    else pickPDF();
  };

  // ---------------- COMPRESS IMAGE ----------------
  const handleCompressImage = async () => {
    if (!sourceUri) return;
    setProcessing(true);
    try {
      const compressed = await compressImage(sourceUri, { quality, format });
      setResultUri(compressed);
      const info = await FileSystem.getInfoAsync(compressed, { size: true });
      const size = info.exists && 'size' in info ? (info as any).size : 0;
      setResultSize(size);

      const now = new Date().toISOString();
      await addDocument({
        id: generateId(),
        name: `compressed_${Date.now()}`,
        pages: [{ id: '1', uri: compressed, width: 0, height: 0, rotation: 0, scanMode: 'color', createdAt: now }],
        createdAt: now,
        updatedAt: now,
        format: format as ExportFormat,
        fileUri: compressed,
        fileSize: size,
        thumbnail: compressed,
        folder: 'compressed',
      });

      const savings = sourceSize > 0 ? Math.round(((sourceSize - size) / sourceSize) * 100) : 0;
      Alert.alert('✅ Compressed!', `Saved to Compressed folder.\n\nOriginal: ${formatFileSize(sourceSize)}\nCompressed: ${formatFileSize(size)}\nReduction: ${savings}%`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Compression failed.');
    } finally {
      setProcessing(false);
    }
  };

  // ---------------- COMPRESS PDF ----------------
  const handleCompressPDF = async () => {
    if (!sourceUri) return;
    setProcessing(true);
    try {
      const baseName = sourceName.replace(/\.pdf$/i, '');
      const outputName = `${baseName}_compressed_${Date.now()}`;
      const { outputUri, originalSize, compressedSize } = await compressPDF(sourceUri, quality, outputName);

      setResultUri(outputUri);
      setResultSize(compressedSize);
      setSourceSize(originalSize);

      const now = new Date().toISOString();
      await addDocument({
        id: generateId(),
        name: outputName,
        pages: [],
        createdAt: now,
        updatedAt: now,
        format: 'pdf',
        fileUri: outputUri,
        fileSize: compressedSize,
        folder: 'compressed',
      });

      const savings = originalSize > 0 ? Math.round(((originalSize - compressedSize) / originalSize) * 100) : 0;
      if (savings <= 0) {
        Alert.alert(
          'PDF Saved',
          `This PDF could not be reduced further (it may already be optimized or contain mostly text). A copy was saved to your Compressed folder.\n\nSize: ${formatFileSize(compressedSize)}`
        );
      } else {
        Alert.alert('✅ PDF Compressed!', `Saved to Compressed folder.\n\nOriginal: ${formatFileSize(originalSize)}\nCompressed: ${formatFileSize(compressedSize)}\nReduction: ${savings}%`);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'PDF compression failed.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCompress = () => {
    if (compressType === 'image') handleCompressImage();
    else handleCompressPDF();
  };

  const handleShare = async () => {
    if (!resultUri) return;
    const ok = await Sharing.isAvailableAsync();
    if (ok) await Sharing.shareAsync(resultUri);
  };

  const savings = sourceSize > 0 && resultSize > 0 ? Math.round(((sourceSize - resultSize) / sourceSize) * 100) : 0;
  const qualityLabel = quality >= 0.9 ? 'High' : quality >= 0.6 ? 'Medium' : 'Low';

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Type Switcher */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>What do you want to compress?</Text>
        <View style={styles.row}>
          {([
            { id: 'image' as CompressType, label: 'Image (JPG/PNG)', icon: 'image-outline' },
            { id: 'pdf' as CompressType, label: 'PDF Document', icon: 'document-text-outline' },
          ]).map(opt => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.typeBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, compressType === opt.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => { setCompressType(opt.id); setSourceUri(null); resetResult(); }}
            >
              <Ionicons name={opt.icon as any} size={22} color={compressType === opt.id ? colors.white : colors.primary} />
              <Text style={[styles.typeBtnText, { color: compressType === opt.id ? colors.white : colors.text }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Source Picker */}
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{compressType === 'image' ? 'Select Image' : 'Select PDF'}</Text>
        <TouchableOpacity style={[styles.pickBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '08' }]} onPress={handlePick}>
          <Ionicons name={compressType === 'image' ? 'image-outline' : 'document-outline'} size={24} color={colors.primary} />
          <Text style={[styles.pickBtnText, { color: colors.primary }]}>
            {sourceUri ? 'Change File' : compressType === 'image' ? 'Pick from Gallery' : 'Pick PDF File'}
          </Text>
        </TouchableOpacity>
        {sourceUri && (
          <View style={styles.previewRow}>
            {compressType === 'image' ? (
              <Image source={{ uri: sourceUri }} style={styles.preview} resizeMode="cover" />
            ) : (
              <View style={[styles.pdfIconBox, { backgroundColor: colors.error + '15' }]}>
                <Ionicons name="document-text" size={32} color={colors.error} />
              </View>
            )}
            <View style={styles.previewInfo}>
              <Text style={[styles.previewLabel, { color: colors.textTertiary }]} numberOfLines={1}>{sourceName}</Text>
              <Text style={[styles.previewSize, { color: colors.text }]}>{formatFileSize(sourceSize)}</Text>
            </View>
          </View>
        )}
      </View>

      {sourceUri && (
        <>
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Settings</Text>

            {compressType === 'image' && (
              <>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Output Format</Text>
                <View style={styles.row}>
                  {(['jpg', 'png'] as const).map(f => (
                    <TouchableOpacity key={f} style={[styles.fmtBtn, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }, format === f && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setFormat(f)}>
                      <Text style={[styles.fmtBtnText, { color: format === f ? colors.white : colors.textSecondary }]}>{f.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={[styles.label, { color: colors.textSecondary }]}>Quality: {qualityLabel} ({Math.round(quality * 100)}%)</Text>
            <View style={styles.qualityRow}>
              {[0.3, 0.5, 0.7, 0.85, 0.95].map(q => (
                <TouchableOpacity key={q} style={[styles.qualityBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, quality === q && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setQuality(q)}>
                  <Text style={[styles.qualityBtnText, { color: quality === q ? colors.white : colors.textSecondary }]}>{Math.round(q * 100)}%</Text>
                </TouchableOpacity>
              ))}
            </View>

            {compressType === 'pdf' && (
              <View style={[styles.infoBox, { backgroundColor: colors.warning + '15' }]}>
                <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
                <Text style={[styles.infoText, { color: colors.warning }]}>
                  PDF compression reduces embedded image quality. Text-only PDFs may not shrink further.
                </Text>
              </View>
            )}
            <View style={[styles.infoBox, { backgroundColor: colors.primary + '10' }]}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.primary }]}>Result will be saved to your Compressed folder on the dashboard.</Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }, processing && styles.actionBtnDisabled]} onPress={handleCompress} disabled={processing}>
            {processing ? <ActivityIndicator color={colors.white} /> : <><Ionicons name="resize-outline" size={20} color={colors.white} /><Text style={[styles.actionBtnText, { color: colors.white }]}>Compress {compressType === 'pdf' ? 'PDF' : 'Image'}</Text></>}
          </TouchableOpacity>

          {resultUri && (
            <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.success + '40' }]}>
              <Ionicons name="checkmark-circle" size={32} color={colors.success} />
              <Text style={[styles.resultTitle, { color: colors.text }]}>Compressed & Saved!</Text>
              <View style={styles.resultStats}>
                <View style={styles.statItem}><Text style={[styles.statLabel, { color: colors.textTertiary }]}>Before</Text><Text style={[styles.statValue, { color: colors.text }]}>{formatFileSize(sourceSize)}</Text></View>
                <Ionicons name="arrow-forward" size={20} color={colors.textTertiary} />
                <View style={styles.statItem}><Text style={[styles.statLabel, { color: colors.textTertiary }]}>After</Text><Text style={[styles.statValue, { color: colors.success }]}>{formatFileSize(resultSize)}</Text></View>
              </View>
              {savings > 0 && <Text style={[styles.savingsText, { color: colors.success }]}>Reduced by {savings}%</Text>}
              <TouchableOpacity style={[styles.shareBtn, { backgroundColor: colors.primary }]} onPress={handleShare}>
                <Ionicons name="share-outline" size={18} color={colors.white} />
                <Text style={[styles.shareBtnText, { color: colors.white }]}>Share</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 40 },
  section: { borderRadius: BorderRadius.lg, padding: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', marginBottom: Spacing.md },
  typeBtn: { flex: 1, alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1.5, gap: 6 },
  typeBtnText: { fontSize: FontSize.xs, fontWeight: '600', textAlign: 'center' },
  pickBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, height: 52, borderRadius: BorderRadius.md, borderWidth: 1.5, borderStyle: 'dashed' },
  pickBtnText: { fontSize: FontSize.md, fontWeight: '600' },
  previewRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, gap: Spacing.md },
  preview: { width: 70, height: 70, borderRadius: BorderRadius.sm },
  pdfIconBox: { width: 70, height: 70, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  previewInfo: { flex: 1 },
  previewLabel: { fontSize: FontSize.xs },
  previewSize: { fontSize: FontSize.lg, fontWeight: '700' },
  label: { fontSize: FontSize.sm, fontWeight: '600', marginBottom: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  fmtBtn: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, borderWidth: 1.5 },
  fmtBtnText: { fontSize: FontSize.sm, fontWeight: '700' },
  qualityRow: { flexDirection: 'row', gap: Spacing.xs },
  qualityBtn: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.sm, borderWidth: 1 },
  qualityBtnText: { fontSize: 11, fontWeight: '600' },
  infoBox: { flexDirection: 'row', padding: Spacing.sm, borderRadius: BorderRadius.sm, gap: Spacing.sm, alignItems: 'flex-start', marginTop: Spacing.sm },
  infoText: { flex: 1, fontSize: FontSize.xs, lineHeight: 18 },
  actionBtn: { height: 52, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  actionBtnDisabled: { opacity: 0.6 },
  actionBtnText: { fontSize: FontSize.md, fontWeight: '700' },
  resultCard: { borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm, borderWidth: 1.5 },
  resultTitle: { fontSize: FontSize.lg, fontWeight: '700' },
  resultStats: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: FontSize.xs },
  statValue: { fontSize: FontSize.lg, fontWeight: '700' },
  savingsText: { fontSize: FontSize.md, fontWeight: '600' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, marginTop: Spacing.sm },
  shareBtnText: { fontSize: FontSize.md, fontWeight: '600' },
});
