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
  TextInput,
  Switch,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, AspectRatios } from '../../src/constants';
import { formatFileSize, getExportsDir } from '../../src/utils/storage';

const PRESETS = [
  { label: 'Thumbnail', width: 150, height: 150 },
  { label: 'Social HD', width: 1080, height: 1080 },
  { label: 'Web Full', width: 1920, height: 1080 },
  { label: 'Portrait A4', width: 794, height: 1123 },
  { label: 'WhatsApp', width: 1600, height: 1600 },
  { label: 'ID Photo', width: 413, height: 531 },
];

export default function ResizeScreen() {
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
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
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
    if (!keepRatio) {
      setTargetHeight(String(h));
    } else if (origWidth && origHeight) {
      setTargetHeight(String(Math.round((w * origHeight) / origWidth)));
    } else {
      setTargetHeight(String(h));
    }
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
    if (!w || !h || w <= 0 || h <= 0) {
      Alert.alert('Invalid Dimensions', 'Please enter valid width and height values.');
      return;
    }
    setProcessing(true);
    try {
      const result = await ImageManipulator.manipulateAsync(
        sourceUri,
        [{ resize: { width: w, height: h } }],
        { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
      );
      const dir = getExportsDir();
      const dest = `${dir}resized_${w}x${h}_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: result.uri, to: dest });
      setResultUri(dest);
      setResultDims({ width: result.width, height: result.height });
      const info = await FileSystem.getInfoAsync(dest, { size: true });
      if (info.exists && 'size' in info) setResultSize((info as any).size);
    } catch (e: any) {
      Alert.alert('Resize Failed', e.message || 'Failed to resize image.');
    } finally {
      setProcessing(false);
    }
  };

  const handleShare = async () => {
    if (!resultUri) return;
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) await Sharing.shareAsync(resultUri);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Source Image */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Source Image</Text>
        <TouchableOpacity style={styles.pickBtn} onPress={pickImage}>
          <Ionicons name="image-outline" size={24} color={Colors.primary} />
          <Text style={styles.pickBtnText}>{sourceUri ? 'Change Image' : 'Pick from Gallery'}</Text>
        </TouchableOpacity>
        {sourceUri && (
          <View style={styles.previewRow}>
            <Image source={{ uri: sourceUri }} style={styles.preview} resizeMode="cover" />
            <View style={styles.previewInfo}>
              <Text style={styles.previewLabel}>Original</Text>
              <Text style={styles.previewDims}>{origWidth} × {origHeight}</Text>
              <Text style={styles.previewSize}>{formatFileSize(sourceSize)}</Text>
            </View>
          </View>
        )}
      </View>

      {sourceUri && (
        <>
          {/* Presets */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Presets</Text>
            <View style={styles.presetGrid}>
              {PRESETS.map((p) => (
                <TouchableOpacity
                  key={p.label}
                  style={styles.presetBtn}
                  onPress={() => applyPreset(p.width, p.height)}
                >
                  <Text style={styles.presetLabel}>{p.label}</Text>
                  <Text style={styles.presetDims}>{p.width}×{p.height}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Aspect Ratios */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Aspect Ratios</Text>
            <View style={styles.ratioGrid}>
              {AspectRatios.filter(r => r.value !== 'free').map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={styles.ratioBtn}
                  onPress={() => applyRatio(r.width, r.height)}
                >
                  <Text style={styles.ratioBtnText}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Custom Dimensions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Custom Dimensions</Text>
            <View style={styles.dimsRow}>
              <View style={styles.dimField}>
                <Text style={styles.dimLabel}>Width (px)</Text>
                <TextInput
                  style={styles.dimInput}
                  value={targetWidth}
                  onChangeText={onWidthChange}
                  keyboardType="numeric"
                  placeholder="Width"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
              <Ionicons name="close" size={20} color={Colors.textTertiary} style={{ marginTop: 20 }} />
              <View style={styles.dimField}>
                <Text style={styles.dimLabel}>Height (px)</Text>
                <TextInput
                  style={styles.dimInput}
                  value={targetHeight}
                  onChangeText={onHeightChange}
                  keyboardType="numeric"
                  placeholder="Height"
                  placeholderTextColor={Colors.textTertiary}
                />
              </View>
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Lock Aspect Ratio</Text>
              <Switch
                value={keepRatio}
                onValueChange={setKeepRatio}
                trackColor={{ true: Colors.primary, false: Colors.border }}
                thumbColor={Colors.white}
              />
            </View>
          </View>

          {/* Resize Button */}
          <TouchableOpacity
            style={[styles.resizeBtn, processing && styles.btnDisabled]}
            onPress={handleResize}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="resize-outline" size={20} color={Colors.white} />
                <Text style={styles.resizeBtnText}>
                  Resize to {targetWidth || '?'} × {targetHeight || '?'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Result */}
          {resultUri && (
            <View style={styles.resultCard}>
              <View style={styles.resultImages}>
                <View style={styles.resultImageBox}>
                  <Image source={{ uri: sourceUri }} style={styles.resultThumb} resizeMode="cover" />
                  <Text style={styles.resultThumbLabel}>{origWidth}×{origHeight}</Text>
                </View>
                <Ionicons name="arrow-forward" size={24} color={Colors.primary} />
                <View style={styles.resultImageBox}>
                  <Image source={{ uri: resultUri }} style={styles.resultThumb} resizeMode="cover" />
                  <Text style={[styles.resultThumbLabel, { color: Colors.success }]}>
                    {resultDims.width}×{resultDims.height}
                  </Text>
                </View>
              </View>
              <Text style={styles.resultSizeText}>
                {formatFileSize(sourceSize)} → {formatFileSize(resultSize)}
              </Text>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                <Ionicons name="share-outline" size={18} color={Colors.white} />
                <Text style={styles.shareBtnText}>Share Result</Text>
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
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md },
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
  preview: { width: 80, height: 80, borderRadius: BorderRadius.sm },
  previewInfo: { flex: 1 },
  previewLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },
  previewDims: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  previewSize: { fontSize: FontSize.sm, color: Colors.textSecondary },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  presetBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  presetLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  presetDims: { fontSize: FontSize.xs, color: Colors.textTertiary },
  ratioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  ratioBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary + '10',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  ratioBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
  dimsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  dimField: { flex: 1 },
  dimLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 4 },
  dimInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    fontSize: FontSize.md,
    color: Colors.text,
    textAlign: 'center',
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: FontSize.md, color: Colors.text, fontWeight: '500' },
  resizeBtn: {
    height: 52,
    backgroundColor: Colors.warning,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  resizeBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.success + '40',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  resultImages: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  resultImageBox: { alignItems: 'center', gap: 4 },
  resultThumb: { width: 80, height: 80, borderRadius: BorderRadius.sm, backgroundColor: Colors.border },
  resultThumbLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  resultSizeText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  shareBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '600' },
});
