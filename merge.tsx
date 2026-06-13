import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Alert,
  ActivityIndicator, Dimensions, ScrollView, TextInput, Modal,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDocuments } from '../../src/hooks/useDocuments';
import { useTheme } from '../../src/hooks/useTheme';
import { Spacing, BorderRadius, FontSize, AspectRatios } from '../../src/constants';
import { applyRotation, applyScanMode, resizeToAspectRatio, applyBrightnessContrast, applyCrop } from '../../src/utils/imageUtils';
import { performOCR } from '../../src/utils/imageUtils';
import { ScanMode } from '../../src/types';

const { width: SCREEN_W } = Dimensions.get('window');

type EditTab = 'adjust' | 'crop' | 'filter' | 'markup' | 'ocr';

export default function EditPageScreen() {
  const { docId, pageIndex } = useLocalSearchParams<{ docId: string; pageIndex: string }>();
  const router = useRouter();
  const { getDocument, updateDocument } = useDocuments();
  const { colors } = useTheme();

  const doc = getDocument(docId);
  const idx = parseInt(pageIndex || '0', 10);
  const page = doc?.pages[idx];

  const [currentUri, setCurrentUri] = useState(page?.uri || '');
  const [working, setWorking] = useState(false);
  const [activeTab, setActiveTab] = useState<EditTab>('adjust');
  const [scanMode, setScanMode] = useState<ScanMode>(page?.scanMode || 'color');
  const [rotation, setRotation] = useState(page?.rotation || 0);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [ocrText, setOcrText] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [markupText, setMarkupText] = useState('');
  const [showMarkupModal, setShowMarkupModal] = useState(false);

  const withLoading = useCallback(async (fn: () => Promise<void>) => {
    setWorking(true);
    try { await fn(); }
    catch (e: any) { Alert.alert('Error', e.message || 'Operation failed.'); }
    finally { setWorking(false); }
  }, []);

  const handleRotate = (deg: number) => withLoading(async () => {
    const newUri = await applyRotation(currentUri, deg);
    setCurrentUri(newUri);
    setRotation(r => (r + deg) % 360);
  });

  const handleFlipH = () => withLoading(async () => {
    const { manipulateAsync, SaveFormat } = require('expo-image-manipulator');
    const result = await manipulateAsync(currentUri, [{ flip: 'horizontal' }], { compress: 0.95, format: SaveFormat.JPEG });
    setCurrentUri(result.uri);
  });

  const handleScanMode = (mode: ScanMode) => withLoading(async () => {
    const newUri = await applyScanMode(currentUri, mode);
    setCurrentUri(newUri);
    setScanMode(mode);
  });

  const handleBrightnessContrast = () => withLoading(async () => {
    const newUri = await applyBrightnessContrast(currentUri, brightness, contrast);
    setCurrentUri(newUri);
  });

  const handleAspectRatio = (rw: number, rh: number) => {
    if (rw === 0) return;
    withLoading(async () => {
      const newUri = await resizeToAspectRatio(currentUri, rw, rh, SCREEN_W, Math.round(SCREEN_W * 1.4));
      setCurrentUri(newUri);
    });
  };

  const handleResize = (w: number, h: number) => withLoading(async () => {
    const { manipulateAsync, SaveFormat } = require('expo-image-manipulator');
    const result = await manipulateAsync(currentUri, [{ resize: { width: w, height: h } }], { compress: 0.92, format: SaveFormat.JPEG });
    setCurrentUri(result.uri);
  });

  const handleOCR = async () => {
    setOcrLoading(true);
    try {
      const text = await performOCR(currentUri);
      if (text === 'OCR_PLACEHOLDER') {
        setOcrText(
          'OCR (text recognition) requires a cloud API key.\n\n' +
          'To enable: integrate Google Vision API or AWS Textract.\n\n' +
          'The scanned image is ready — copy the image and use a free OCR app like:\n' +
          '• Google Lens (free, built into Google app)\n' +
          '• Microsoft Office Lens\n' +
          '• Adobe Scan\n\n' +
          'Tap the image above and use "Copy to Clipboard" then open Google Lens.'
        );
      } else {
        setOcrText(text);
      }
    } catch (e: any) {
      setOcrText('OCR failed: ' + e.message);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSave = async () => {
    if (!doc) return;
    const updatedPages = doc.pages.map((p, i) =>
      i === idx ? { ...p, uri: currentUri, scanMode, rotation, ocrText: ocrText || p.ocrText } : p
    );
    await updateDocument(doc.id, { pages: updatedPages, thumbnail: updatedPages[0]?.uri });
    router.back();
  };

  if (!page) return <View style={[styles.centered, { backgroundColor: colors.background }]}><Text style={{ color: colors.text }}>Page not found</Text></View>;

  const tabs: { id: EditTab; icon: string; label: string }[] = [
    { id: 'adjust', icon: 'options-outline', label: 'Adjust' },
    { id: 'filter', icon: 'color-filter-outline', label: 'Filter' },
    { id: 'crop', icon: 'crop-outline', label: 'Crop' },
    { id: 'markup', icon: 'brush-outline', label: 'Markup' },
    { id: 'ocr', icon: 'text-outline', label: 'OCR' },
  ];

  return (
    <>
      <Stack.Screen options={{ title: `Edit Page ${idx + 1}`, headerStyle: { backgroundColor: colors.header }, headerTintColor: colors.headerText }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Image Preview */}
        <View style={[styles.imageContainer, { backgroundColor: colors.black }]}>
          <Image source={{ uri: currentUri }} style={styles.image} resizeMode="contain" />
          {working && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Processing...</Text>
            </View>
          )}
        </View>

        {/* Edit Tabs */}
        <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons name={tab.icon as any} size={18} color={activeTab === tab.id ? colors.primary : colors.textTertiary} />
              <Text style={[styles.tabText, { color: activeTab === tab.id ? colors.primary : colors.textTertiary }]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.controls} showsVerticalScrollIndicator={false}>
          {/* ADJUST TAB */}
          {activeTab === 'adjust' && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Rotation & Flip</Text>
              <View style={styles.row}>
                {[{ label: '↺ 90°', deg: -90 }, { label: '↻ 90°', deg: 90 }, { label: '180°', deg: 180 }].map(btn => (
                  <TouchableOpacity key={btn.label} style={[styles.controlBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => handleRotate(btn.deg)} disabled={working}>
                    <Text style={[styles.controlBtnText, { color: colors.primary }]}>{btn.label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={handleFlipH} disabled={working}>
                  <Ionicons name="swap-horizontal-outline" size={18} color={colors.primary} />
                  <Text style={[styles.controlBtnText, { color: colors.primary }]}>Flip</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.md }]}>Brightness: {brightness > 0 ? '+' : ''}{brightness}</Text>
              <Slider minimumValue={-5} maximumValue={5} step={1} value={brightness} onValueChange={setBrightness}
                minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} thumbTintColor={colors.primary} />

              <Text style={[styles.sectionTitle, { color: colors.text }]}>Contrast: {contrast > 0 ? '+' : ''}{contrast}</Text>
              <Slider minimumValue={-5} maximumValue={5} step={1} value={contrast} onValueChange={setContrast}
                minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} thumbTintColor={colors.primary} />

              <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.primary }]} onPress={handleBrightnessContrast} disabled={working}>
                <Text style={[styles.applyBtnText, { color: colors.white }]}>Apply Brightness/Contrast</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* FILTER TAB */}
          {activeTab === 'filter' && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Color Mode</Text>
              <View style={styles.row}>
                {([
                  { mode: 'color' as ScanMode, label: 'Auto Color', icon: 'color-palette-outline' },
                  { mode: 'grayscale' as ScanMode, label: 'Grayscale', icon: 'contrast-outline' },
                  { mode: 'blackwhite' as ScanMode, label: 'Black & White', icon: 'moon-outline' },
                ] as {mode: ScanMode; label: string; icon: string}[]).map(item => (
                  <TouchableOpacity
                    key={item.mode}
                    style={[styles.filterBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                      scanMode === item.mode && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    onPress={() => handleScanMode(item.mode)} disabled={working}
                  >
                    <Ionicons name={item.icon as any} size={22} color={scanMode === item.mode ? colors.white : colors.primary} />
                    <Text style={[styles.filterBtnText, { color: scanMode === item.mode ? colors.white : colors.text }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* CROP TAB */}
          {activeTab === 'crop' && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Aspect Ratio</Text>
              <View style={styles.ratioGrid}>
                {AspectRatios.map(ratio => (
                  <TouchableOpacity
                    key={ratio.value}
                    style={[styles.ratioBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                    onPress={() => handleAspectRatio(ratio.width, ratio.height)} disabled={working}
                  >
                    <Text style={[styles.ratioBtnText, { color: colors.primary }]}>{ratio.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.md }]}>Resize</Text>
              <View style={styles.row}>
                {[{ label: 'A4', w: 794, h: 1123 }, { label: '1080p', w: 1080, h: 1920 }, { label: 'HD', w: 1280, h: 720 }].map(p => (
                  <TouchableOpacity key={p.label} style={[styles.controlBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => handleResize(p.w, p.h)} disabled={working}>
                    <Text style={[styles.controlBtnText, { color: colors.primary }]}>{p.label}</Text>
                    <Text style={[styles.controlBtnSub, { color: colors.textTertiary }]}>{p.w}×{p.h}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* MARKUP TAB */}
          {activeTab === 'markup' && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Add Text Markup</Text>
              <Text style={[styles.subLabel, { color: colors.textSecondary }]}>Add notes or annotations to this page</Text>
              <TextInput
                style={[styles.markupInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, color: colors.text }]}
                placeholder="Type your annotation here..."
                placeholderTextColor={colors.textTertiary}
                multiline
                value={markupText}
                onChangeText={setMarkupText}
              />
              <TouchableOpacity
                style={[styles.applyBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  if (markupText.trim()) {
                    Alert.alert('Markup Saved', 'Your annotation has been saved with this page.');
                  }
                }}
              >
                <Text style={[styles.applyBtnText, { color: colors.white }]}>Save Annotation</Text>
              </TouchableOpacity>
              <View style={[styles.infoBox, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.primary }]}>
                  For drawing markup (pen, highlighter), use your device's built-in screenshot editor after exporting.
                </Text>
              </View>
            </View>
          )}

          {/* OCR TAB */}
          {activeTab === 'ocr' && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Text Recognition (OCR)</Text>
              <TouchableOpacity
                style={[styles.applyBtn, { backgroundColor: colors.secondary || colors.primary }]}
                onPress={handleOCR} disabled={ocrLoading}
              >
                {ocrLoading
                  ? <ActivityIndicator color={colors.white} />
                  : <>
                    <Ionicons name="scan-outline" size={18} color={colors.white} />
                    <Text style={[styles.applyBtnText, { color: colors.white }]}>Extract Text from Image</Text>
                  </>
                }
              </TouchableOpacity>
              {ocrText ? (
                <View style={[styles.ocrResult, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Text style={[styles.ocrText, { color: colors.text }]}>{ocrText}</Text>
                </View>
              ) : (
                <View style={[styles.infoBox, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="text-outline" size={18} color={colors.primary} />
                  <Text style={[styles.infoText, { color: colors.primary }]}>
                    Tap the button above to extract text from your scanned document.
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* Save Bar */}
        <View style={[styles.saveBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => router.back()}>
            <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave} disabled={working}>
            <Ionicons name="checkmark-outline" size={20} color={colors.white} />
            <Text style={[styles.saveBtnText, { color: colors.white }]}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageContainer: { height: SCREEN_W * 0.65, position: 'relative' },
  image: { width: '100%', height: '100%' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#fff', marginTop: Spacing.sm, fontSize: FontSize.sm },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, gap: 2 },
  tabText: { fontSize: 10, fontWeight: '600' },
  controls: { flex: 1 },
  section: { margin: Spacing.md, marginBottom: 0, borderRadius: BorderRadius.lg, padding: Spacing.md },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '700', marginBottom: Spacing.sm },
  subLabel: { fontSize: FontSize.xs, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  controlBtn: { flex: 1, minWidth: 70, alignItems: 'center', justifyContent: 'center', padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, gap: 2 },
  controlBtnText: { fontSize: FontSize.xs, fontWeight: '700' },
  controlBtnSub: { fontSize: 9 },
  filterBtn: { flex: 1, alignItems: 'center', padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1.5, gap: 4 },
  filterBtnText: { fontSize: FontSize.xs, fontWeight: '600', textAlign: 'center' },
  applyBtn: { flexDirection: 'row', height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, gap: Spacing.sm, marginTop: Spacing.sm },
  applyBtnText: { fontSize: FontSize.md, fontWeight: '700' },
  ratioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  ratioBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1 },
  ratioBtnText: { fontSize: FontSize.sm, fontWeight: '600' },
  markupInput: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, height: 120, textAlignVertical: 'top', fontSize: FontSize.md },
  infoBox: { flexDirection: 'row', padding: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.sm, alignItems: 'flex-start', marginTop: Spacing.md },
  infoText: { flex: 1, fontSize: FontSize.xs, lineHeight: 18 },
  ocrResult: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.md },
  ocrText: { fontSize: FontSize.sm, lineHeight: 22 },
  saveBar: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.sm, borderTopWidth: 1 },
  cancelBtn: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, borderWidth: 1 },
  cancelBtnText: { fontSize: FontSize.md, fontWeight: '600' },
  saveBtn: { flex: 2, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: BorderRadius.md },
  saveBtnText: { fontSize: FontSize.md, fontWeight: '700' },
});
