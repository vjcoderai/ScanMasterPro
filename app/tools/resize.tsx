import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Image, TextInput, Switch,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/hooks/useTheme';
import { useDocuments } from '../../src/hooks/useDocuments';
import { Spacing, BorderRadius, FontSize, AspectRatios } from '../../src/constants';
import { formatFileSize, getExportsDir, generateId } from '../../src/utils/storage';

const PRESETS = [
  { label: 'Thumbnail', width: 150, height: 150 },
  { label: 'Social HD', width: 1080, height: 1080 },
  { label: 'Web Full', width: 1920, height: 1080 },
  { label: 'Portrait A4', width: 794, height: 1123 },
  { label: 'WhatsApp', width: 1600, height: 1600 },
  { label: 'ID Photo', width: 413, height: 531 },
];

export default function ResizeScreen() {
  const { colors } = useTheme();
  const { addDocument } = useDocuments();
  const [sourceUri, setSourceUri] = useState<string | null>(null);
  const [sourceSize, setSourceSize] = useState(0);
  const [origWidth, setOrigWidth] = useState(0);
  const [origHeight, setOrigHeight] = useState(0);
  const [targetWidth, setTargetWidth] = useState('');
  const [targetHeight, setTargetHeight] = useState('');
  const [keepRatio, setKeepRatio] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);
  const [resultDims, setResultDims] = useState({ width: 0, height: 0 });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setSourceUri(asset.uri);
      setOrigWidth(asset.width || 0);
      setOrigHeight(asset.height || 0);
      setTargetWidth(String(asset.width || ''));
      setTargetHeight(String(asset.height || ''));
      setResultUri(null);
      const info = await FileSystem.getInfoAsync(asset.uri, { size: true });
      if (info.exists && 'size' in info) setSourceSize((info as any).size);
    }
  };

  const onWidthChange = (val: string) => {
    setTargetWidth(val);
    if (keepRatio && origWidth && origHeight) {
      const w = parseInt(val, 10);
      if (!isNaN(w)) setTargetHeight(String(Math.round((w * origHeight) / origWidth)));
    }
  };

  const onHeightChange = (val: string) => {
    setTargetHeight(val);
    if (keepRatio && origWidth && origHeight) {
      const h = parseInt(val, 10);
      if (!isNaN(h)) setTargetWidth(String(Math.round((h * origWidth) / origHeight)));
    }
  };

  const applyPreset = (w: number, h: number) => {
    setTargetWidth(String(w));
    if (!keepRatio) setTargetHeight(String(h));
    else if (origWidth && origHeight) setTargetHeight(String(Math.round((w * origHeight) / origWidth)));
    else setTargetHeight(String(h));
  };

  const applyRatio = (rw: number, rh: number) => {
    if (rw === 0) return;
    const w = parseInt(targetWidth, 10) || origWidth;
    setTargetWidth(String(w));
    setTargetHeight(String(Math.round((w * rh) / rw)));
  };

  const handleResize = async () => {
    if (!sourceUri) return;
    const w = parseInt(targetWidth, 10);
    const h = parseInt(targetHeight, 10);
    if (!w || !h || w <= 0 || h <= 0) { Alert.alert('Invalid Dimensions', 'Enter valid width and height.'); return; }
    setProcessing(true);
    try {
      const result = await ImageManipulator.manipulateAsync(sourceUri, [{ resize: { width: w, height: h } }], { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG });
      const dir = getExportsDir();
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const dest = `${dir}resized_${w}x${h}_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: result.uri, to: dest });
      setResultUri(dest);
      setResultDims({ width: result.width, height: result.height });
      const info = await FileSystem.getInfoAsync(dest, { size: true });
      const size = info.exists && 'size' in info ? (info as any).size : 0;
      setResultSize(size);

      // Add to dashboard
      const now = new Date().toISOString();
      await addDocument({
        id: generateId(),
        name: `resized_${w}x${h}`,
        pages: [{ id: '1', uri: dest, width: w, height: h, rotation: 0, scanMode: 'color', createdAt: now }],
        createdAt: now,
        updatedAt: now,
        format: 'jpg',
        fileUri: dest,
        fileSize: size,
        thumbnail: dest,
        folder: 'converted',
      });
    } catch (e: any) {
      Alert.alert('Resize Failed', e.message || 'Failed to resize image.');
    } finally {
      setProcessing(false);
    }
  };

  const handleShare = async () => {
    if (!resultUri) return;
    const ok = await Sharing.isAvailableAsync();
    if (ok) await Sharing.shareAsync(resultUri);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Source Image</Text>
        <TouchableOpacity style={[styles.pickBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '08' }]} onPress={pickImage}>
          <Ionicons name="image-outline" size={24} color={colors.primary} />
          <Text style={[styles.pickBtnText, { color: colors.primary }]}>{sourceUri ? 'Change Image' : 'Pick from Gallery'}</Text>
        </TouchableOpacity>
        {sourceUri && (
          <View style={styles.previewRow}>
            <Image source={{ uri: sourceUri }} style={styles.preview} resizeMode="cover" />
            <View style={styles.previewInfo}>
              <Text style={[styles.previewLabel, { color: colors.textTertiary }]}>Original</Text>
              <Text style={[styles.previewDims, { color: colors.text }]}>{origWidth} × {origHeight}</Text>
              <Text style={[styles.previewSize, { color: colors.textSecondary }]}>{formatFileSize(sourceSize)}</Text>
            </View>
          </View>
        )}
      </View>

      {sourceUri && (
        <>
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Presets</Text>
            <View style={styles.presetGrid}>
              {PRESETS.map(p => (
                <TouchableOpacity key={p.label} style={[styles.presetBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => applyPreset(p.width, p.height)}>
                  <Text style={[styles.presetLabel, { color: colors.text }]}>{p.label}</Text>
                  <Text style={[styles.presetDims, { color: colors.textTertiary }]}>{p.width}×{p.height}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Aspect Ratios</Text>
            <View style={styles.ratioGrid}>
              {AspectRatios.filter(r => r.value !== 'free').map(r => (
                <TouchableOpacity key={r.value} style={[styles.ratioBtn, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]} onPress={() => applyRatio(r.width, r.height)}>
                  <Text style={[styles.ratioBtnText, { color: colors.primary }]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Custom Dimensions</Text>
            <View style={styles.dimsRow}>
              <View style={styles.dimField}>
                <Text style={[styles.dimLabel, { color: colors.textSecondary }]}>Width (px)</Text>
                <TextInput style={[styles.dimInput, { borderColor: colors.border, color: colors.text }]} value={targetWidth} onChangeText={onWidthChange} keyboardType="numeric" placeholder="Width" placeholderTextColor={colors.textTertiary} />
              </View>
              <Ionicons name="close" size={20} color={colors.textTertiary} style={{ marginTop: 20 }} />
              <View style={styles.dimField}>
                <Text style={[styles.dimLabel, { color: colors.textSecondary }]}>Height (px)</Text>
                <TextInput style={[styles.dimInput, { borderColor: colors.border, color: colors.text }]} value={targetHeight} onChangeText={onHeightChange} keyboardType="numeric" placeholder="Height" placeholderTextColor={colors.textTertiary} />
              </View>
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>Lock Aspect Ratio</Text>
              <Switch value={keepRatio} onValueChange={setKeepRatio} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.white} />
            </View>
          </View>

          <TouchableOpacity style={[styles.resizeBtn, { backgroundColor: colors.warning }, processing && styles.btnDisabled]} onPress={handleResize} disabled={processing}>
            {processing ? <ActivityIndicator color={colors.white} /> : <><Ionicons name="resize-outline" size={20} color={colors.white} /><Text style={[styles.resizeBtnText, { color: colors.white }]}>Resize to {targetWidth || '?'} × {targetHeight || '?'}</Text></>}
          </TouchableOpacity>

          {resultUri && (
            <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.success + '40' }]}>
              <View style={styles.resultImages}>
                <View style={styles.resultImageBox}>
                  <Image source={{ uri: sourceUri }} style={[styles.resultThumb, { backgroundColor: colors.border }]} resizeMode="cover" />
                  <Text style={[styles.resultThumbLabel, { color: colors.textSecondary }]}>{origWidth}×{origHeight}</Text>
                </View>
                <Ionicons name="arrow-forward" size={24} color={colors.primary} />
                <View style={styles.resultImageBox}>
                  <Image source={{ uri: resultUri }} style={[styles.resultThumb, { backgroundColor: colors.border }]} resizeMode="cover" />
                  <Text style={[styles.resultThumbLabel, { color: colors.success }]}>{resultDims.width}×{resultDims.height}</Text>
                </View>
              </View>
              <Text style={[styles.resultSizeText, { color: colors.textSecondary }]}>{formatFileSize(sourceSize)} → {formatFileSize(resultSize)}</Text>
              <Text style={[styles.savedText, { color: colors.success }]}>✓ Saved to dashboard</Text>
              <TouchableOpacity style={[styles.shareBtn, { backgroundColor: colors.primary }]} onPress={handleShare}>
                <Ionicons name="share-outline" size={18} color={colors.white} />
                <Text style={[styles.shareBtnText, { color: colors.white }]}>Share Result</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md, gap: Spacing.md },
  section: { borderRadius: BorderRadius.lg, padding: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', marginBottom: Spacing.md },
  pickBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, height: 52, borderRadius: BorderRadius.md, borderWidth: 1.5, borderStyle: 'dashed' },
  pickBtnText: { fontSize: FontSize.md, fontWeight: '600' },
  previewRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, gap: Spacing.md },
  preview: { width: 80, height: 80, borderRadius: BorderRadius.sm },
  previewInfo: { flex: 1 },
  previewLabel: { fontSize: FontSize.xs },
  previewDims: { fontSize: FontSize.lg, fontWeight: '700' },
  previewSize: { fontSize: FontSize.sm },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  presetBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, alignItems: 'center' },
  presetLabel: { fontSize: FontSize.sm, fontWeight: '600' },
  presetDims: { fontSize: FontSize.xs },
  ratioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  ratioBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1 },
  ratioBtnText: { fontSize: FontSize.sm, fontWeight: '600' },
  dimsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  dimField: { flex: 1 },
  dimLabel: { fontSize: FontSize.xs, marginBottom: 4 },
  dimInput: { borderWidth: 1.5, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 48, fontSize: FontSize.md, textAlign: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: FontSize.md, fontWeight: '500' },
  resizeBtn: { height: 52, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  btnDisabled: { opacity: 0.6 },
  resizeBtnText: { fontSize: FontSize.md, fontWeight: '700' },
  resultCard: { borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', gap: Spacing.md, borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  resultImages: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  resultImageBox: { alignItems: 'center', gap: 4 },
  resultThumb: { width: 80, height: 80, borderRadius: BorderRadius.sm },
  resultThumbLabel: { fontSize: FontSize.xs, fontWeight: '600' },
  resultSizeText: { fontSize: FontSize.sm },
  savedText: { fontSize: FontSize.sm, fontWeight: '600' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  shareBtnText: { fontSize: FontSize.md, fontWeight: '600' },
});
