import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Alert,
  ActivityIndicator, Dimensions, ScrollView, TextInput, Modal,
} from 'react-native';
import Slider from '@react-native-community/slider';
import * as Clipboard from 'expo-clipboard';
import ViewShot from 'react-native-view-shot';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDocuments } from '../../src/hooks/useDocuments';
import { useTheme } from '../../src/hooks/useTheme';
import { Spacing, BorderRadius, FontSize, AspectRatios } from '../../src/constants';
import {
  applyRotation, applyScanMode, resizeToAspectRatio, applyBrightnessContrast,
  applyCleanUp, resizeImageInPlace, performOCR,
} from '../../src/utils/imageUtils';
import { applyAutoCrop } from '../../src/utils/edgeDetection';
import { ScanMode } from '../../src/types';
import { MarkupCanvas, MarkupTool, MarkupStroke } from '../../src/components/MarkupCanvas';

const { width: SCREEN_W } = Dimensions.get('window');
const PREVIEW_H = SCREEN_W * 1.2;

type EditTab = 'adjust' | 'filter' | 'crop' | 'cleanup' | 'markup' | 'resize' | 'ocr';

const RESIZE_PRESETS = [
  { label: 'A4', w: 794, h: 1123 },
  { label: 'Letter', w: 850, h: 1100 },
  { label: '1080p', w: 1080, h: 1920 },
  { label: 'HD', w: 1280, h: 720 },
  { label: 'Small', w: 600, h: 800 },
];

const MARKUP_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#000000'];

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
  const [freeRotateDeg, setFreeRotateDeg] = useState(0);

  // OCR state
  const [ocrText, setOcrText] = useState(page?.ocrText || '');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [copiedFeedback, setCopiedFeedback] = useState(false);

  // Resize state
  const [resizeWidth, setResizeWidth] = useState(String(page?.width || 1080));
  const [resizeHeight, setResizeHeight] = useState(String(page?.height || 1440));

  // Markup state
  const [markupStrokes, setMarkupStrokes] = useState<MarkupStroke[]>([]);
  const [markupTool, setMarkupTool] = useState<MarkupTool>('pen');
  const [markupColor, setMarkupColor] = useState(MARKUP_COLORS[0]);
  const [textPromptVisible, setTextPromptVisible] = useState(false);
  const [textPromptValue, setTextPromptValue] = useState('');
  const [pendingTextPosition, setPendingTextPosition] = useState<{ x: number; y: number } | null>(null);
  const viewShotRef = useRef<any>(null);

  const withLoading = useCallback(async (fn: () => Promise<void>) => {
    setWorking(true);
    try { await fn(); }
    catch (e: any) { Alert.alert('Error', e.message || 'Operation failed.'); }
    finally { setWorking(false); }
  }, []);

  // ---------------- ADJUST: ROTATE / FLIP / FREE ROTATE / BRIGHTNESS-CONTRAST ----------------
  const handleRotate = (deg: number) => withLoading(async () => {
    const newUri = await applyRotation(currentUri, deg);
    setCurrentUri(newUri);
    setRotation(r => ((r + deg) % 360 + 360) % 360);
  });

  const handleFlipH = () => withLoading(async () => {
    const { manipulateAsync, SaveFormat } = require('expo-image-manipulator');
    const result = await manipulateAsync(currentUri, [{ flip: 'horizontal' }], { compress: 0.95, format: SaveFormat.JPEG });
    setCurrentUri(result.uri);
  });

  const handleFreeRotateApply = () => withLoading(async () => {
    if (freeRotateDeg === 0) return;
    const newUri = await applyRotation(currentUri, freeRotateDeg);
    setCurrentUri(newUri);
    setRotation(r => ((r + freeRotateDeg) % 360 + 360) % 360);
    setFreeRotateDeg(0);
  });

  const handleBrightnessContrast = () => withLoading(async () => {
    const newUri = await applyBrightnessContrast(currentUri, brightness, contrast);
    setCurrentUri(newUri);
  });

  // ---------------- FILTER ----------------
  const handleScanMode = (mode: ScanMode) => withLoading(async () => {
    const newUri = await applyScanMode(currentUri, mode);
    setCurrentUri(newUri);
    setScanMode(mode);
  });

  // ---------------- CROP ----------------
  const handleAspectRatio = (rw: number, rh: number) => {
    if (rw === 0) return;
    withLoading(async () => {
      const newUri = await resizeToAspectRatio(currentUri, rw, rh, SCREEN_W, Math.round(SCREEN_W * 1.4));
      setCurrentUri(newUri);
    });
  };

  const handleAutoCrop = () => withLoading(async () => {
    const newUri = await applyAutoCrop(currentUri, 0); // confidence 0 = always apply margin trim
    setCurrentUri(newUri);
  });

  // ---------------- CLEAN UP ----------------
  const handleCleanUp = () => withLoading(async () => {
    const newUri = await applyCleanUp(currentUri);
    setCurrentUri(newUri);
  });

  // ---------------- RESIZE ----------------
  const handleResize = () => withLoading(async () => {
    const w = parseInt(resizeWidth, 10);
    const h = parseInt(resizeHeight, 10);
    if (!w || !h || w <= 0 || h <= 0) {
      Alert.alert('Invalid Size', 'Enter valid width and height values.');
      return;
    }
    const newUri = await resizeImageInPlace(currentUri, w, h);
    setCurrentUri(newUri);
  });

  const applyResizePreset = (w: number, h: number) => {
    setResizeWidth(String(w));
    setResizeHeight(String(h));
  };

  // ---------------- MARKUP ----------------
  const handleRequestText = (position: { x: number; y: number }) => {
    setPendingTextPosition(position);
    setTextPromptValue('');
    setTextPromptVisible(true);
  };

  const confirmTextMarkup = () => {
    if (textPromptValue.trim() && pendingTextPosition) {
      setMarkupStrokes(prev => [...prev, {
        type: 'text',
        position: pendingTextPosition,
        text: textPromptValue.trim(),
        color: markupColor,
      }]);
    }
    setTextPromptVisible(false);
    setPendingTextPosition(null);
  };

  const undoMarkup = () => setMarkupStrokes(prev => prev.slice(0, -1));
  const clearMarkup = () => {
    if (markupStrokes.length === 0) return;
    Alert.alert('Clear All Markup', 'Remove all annotations on this page?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setMarkupStrokes([]) },
    ]);
  };

  const applyMarkup = () => withLoading(async () => {
    if (markupStrokes.length === 0) {
      Alert.alert('No Markup', 'Add a drawing, highlight, arrow, or text first.');
      return;
    }
    if (!viewShotRef.current?.capture) {
      Alert.alert('Error', 'Could not capture markup.');
      return;
    }
    const capturedUri = await viewShotRef.current.capture();
    setCurrentUri(capturedUri);
    setMarkupStrokes([]);
  });

  // ---------------- OCR ----------------
  const handleOCR = async () => {
    setOcrLoading(true);
    setOcrError('');
    try {
      const result = await performOCR(currentUri);
      if (result.success) {
        setOcrText(result.text);
      } else {
        setOcrError(result.error || 'OCR failed.');
      }
    } catch (e: any) {
      setOcrError(e.message || 'OCR failed.');
    } finally {
      setOcrLoading(false);
    }
  };

  const copyOcrText = async () => {
    if (!ocrText) return;
    await Clipboard.setStringAsync(ocrText);
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 1800);
  };

  // ---------------- SAVE ----------------
  const handleSave = async () => {
    if (!doc) return;
    const dims = await getCurrentDims();
    const updatedPages = doc.pages.map((p, i) =>
      i === idx ? { ...p, uri: currentUri, scanMode, rotation, width: dims.width, height: dims.height, ocrText: ocrText || p.ocrText } : p
    );
    await updateDocument(doc.id, { pages: updatedPages, thumbnail: updatedPages[0]?.uri });
    router.back();
  };

  const getCurrentDims = async (): Promise<{ width: number; height: number }> => {
    try {
      const { manipulateAsync, SaveFormat } = require('expo-image-manipulator');
      const result = await manipulateAsync(currentUri, [], { format: SaveFormat.JPEG });
      return { width: result.width, height: result.height };
    } catch {
      return { width: page?.width || 0, height: page?.height || 0 };
    }
  };

  if (!page) return <View style={[styles.centered, { backgroundColor: colors.background }]}><Text style={{ color: colors.text }}>Page not found</Text></View>;

  const tabs: { id: EditTab; icon: string; label: string }[] = [
    { id: 'adjust', icon: 'options-outline', label: 'Adjust' },
    { id: 'filter', icon: 'color-filter-outline', label: 'Filter' },
    { id: 'crop', icon: 'crop-outline', label: 'Crop' },
    { id: 'cleanup', icon: 'sparkles-outline', label: 'Clean Up' },
    { id: 'markup', icon: 'brush-outline', label: 'Markup' },
    { id: 'resize', icon: 'resize-outline', label: 'Resize' },
    { id: 'ocr', icon: 'text-outline', label: 'OCR' },
  ];

  return (
    <>
      <Stack.Screen options={{ title: `Edit Page ${idx + 1}`, headerStyle: { backgroundColor: colors.header }, headerTintColor: colors.headerText }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Image Preview (or Markup Canvas when on the Markup tab) */}
        {activeTab === 'markup' ? (
          <View style={[styles.imageContainer, { backgroundColor: colors.black, height: PREVIEW_H }]}>
            <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.95 }} style={styles.viewShot}>
              <MarkupCanvas
                imageUri={currentUri}
                width={SCREEN_W}
                height={PREVIEW_H}
                tool={markupTool}
                color={markupColor}
                strokes={markupStrokes}
                onStrokesChange={setMarkupStrokes}
                onRequestText={handleRequestText}
              />
            </ViewShot>
            {working && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Applying markup...</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.imageContainer, { backgroundColor: colors.black, height: PREVIEW_H * 0.55 }]}>
            <Image source={{ uri: currentUri }} style={styles.image} resizeMode="contain" />
            {working && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Processing...</Text>
              </View>
            )}
          </View>
        )}

        {/* Edit Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]} contentContainerStyle={styles.tabBarContent}>
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
        </ScrollView>

        <ScrollView style={styles.controls} showsVerticalScrollIndicator={false}>
          {/* ===================== ADJUST TAB ===================== */}
          {activeTab === 'adjust' && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Rotate & Flip</Text>
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

              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.md }]}>Free Rotate: {freeRotateDeg}°</Text>
              <Slider minimumValue={-180} maximumValue={180} step={1} value={freeRotateDeg} onValueChange={setFreeRotateDeg}
                minimumTrackTintColor={colors.primary} maximumTrackTintColor={colors.border} thumbTintColor={colors.primary} />
              <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.primary }, freeRotateDeg === 0 && styles.applyBtnDisabled]} onPress={handleFreeRotateApply} disabled={working || freeRotateDeg === 0}>
                <Text style={[styles.applyBtnText, { color: colors.white }]}>Apply Free Rotation</Text>
              </TouchableOpacity>

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

          {/* ===================== FILTER TAB ===================== */}
          {activeTab === 'filter' && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Color Filter</Text>
              <Text style={[styles.subLabel, { color: colors.textSecondary }]}>
                Auto Color enhances the scan for readability. Original keeps the photo unchanged.
              </Text>
              <View style={styles.filterGrid}>
                {([
                  { mode: 'color' as ScanMode, label: 'Original', icon: 'image-outline' },
                  { mode: 'color' as ScanMode, label: 'Auto Color', icon: 'color-palette-outline' },
                  { mode: 'grayscale' as ScanMode, label: 'Grayscale', icon: 'contrast-outline' },
                  { mode: 'blackwhite' as ScanMode, label: 'Black & White', icon: 'moon-outline' },
                ] as { mode: ScanMode; label: string; icon: string }[]).map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.filterBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                      scanMode === item.mode && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
                    onPress={() => handleScanMode(item.mode)} disabled={working}
                  >
                    <Ionicons name={item.icon as any} size={24} color={scanMode === item.mode ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.filterBtnText, { color: scanMode === item.mode ? colors.primary : colors.text }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ===================== CROP TAB ===================== */}
          {activeTab === 'crop' && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Auto Crop</Text>
              <Text style={[styles.subLabel, { color: colors.textSecondary }]}>Automatically trim camera framing margins from this page.</Text>
              <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.edgeDetectColor }]} onPress={handleAutoCrop} disabled={working}>
                <Ionicons name="scan-outline" size={18} color="#0A2E32" />
                <Text style={[styles.applyBtnText, { color: '#0A2E32' }]}>Auto-Crop Document</Text>
              </TouchableOpacity>

              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.lg }]}>Crop to Aspect Ratio</Text>
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
            </View>
          )}

          {/* ===================== CLEAN UP TAB ===================== */}
          {activeTab === 'cleanup' && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Clean Up Scan</Text>
              <Text style={[styles.subLabel, { color: colors.textSecondary }]}>
                Reduces noise and compression artifacts from camera scans, producing a cleaner, sharper-looking page.
              </Text>
              <View style={[styles.cleanupIconBox, { backgroundColor: colors.primary + '10' }]}>
                <Ionicons name="sparkles" size={48} color={colors.primary} />
              </View>
              <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.primary }]} onPress={handleCleanUp} disabled={working}>
                <Ionicons name="sparkles-outline" size={18} color={colors.white} />
                <Text style={[styles.applyBtnText, { color: colors.white }]}>Clean Up This Page</Text>
              </TouchableOpacity>
              <View style={[styles.infoBox, { backgroundColor: colors.primary + '10' }]}>
                <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.primary }]}>Best for scans taken in low light or with visible grain/noise.</Text>
              </View>
            </View>
          )}

          {/* ===================== MARKUP TAB ===================== */}
          {activeTab === 'markup' && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Markup Tools</Text>
              <View style={styles.row}>
                {([
                  { id: 'pen' as MarkupTool, icon: 'pencil-outline', label: 'Draw' },
                  { id: 'highlighter' as MarkupTool, icon: 'color-fill-outline', label: 'Highlight' },
                  { id: 'arrow' as MarkupTool, icon: 'arrow-up-outline', label: 'Arrow' },
                  { id: 'text' as MarkupTool, icon: 'text-outline', label: 'Text' },
                ]).map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.controlBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, markupTool === t.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    onPress={() => setMarkupTool(t.id)}
                  >
                    <Ionicons name={t.icon as any} size={18} color={markupTool === t.id ? colors.white : colors.primary} />
                    <Text style={[styles.controlBtnText, { color: markupTool === t.id ? colors.white : colors.primary }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.md }]}>Color</Text>
              <View style={styles.colorRow}>
                {MARKUP_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorSwatch, { backgroundColor: c }, markupColor === c && { borderWidth: 3, borderColor: colors.primary }]}
                    onPress={() => setMarkupColor(c)}
                  />
                ))}
              </View>

              <View style={[styles.row, { marginTop: Spacing.md }]}>
                <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={undoMarkup} disabled={markupStrokes.length === 0}>
                  <Ionicons name="arrow-undo-outline" size={18} color={markupStrokes.length === 0 ? colors.textTertiary : colors.primary} />
                  <Text style={[styles.controlBtnText, { color: markupStrokes.length === 0 ? colors.textTertiary : colors.primary }]}>Undo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={clearMarkup} disabled={markupStrokes.length === 0}>
                  <Ionicons name="trash-outline" size={18} color={markupStrokes.length === 0 ? colors.textTertiary : colors.error} />
                  <Text style={[styles.controlBtnText, { color: markupStrokes.length === 0 ? colors.textTertiary : colors.error }]}>Clear All</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.primary }, markupStrokes.length === 0 && styles.applyBtnDisabled]} onPress={applyMarkup} disabled={working || markupStrokes.length === 0}>
                <Ionicons name="checkmark-outline" size={18} color={colors.white} />
                <Text style={[styles.applyBtnText, { color: colors.white }]}>Apply Markup to Image</Text>
              </TouchableOpacity>

              <View style={[styles.infoBox, { backgroundColor: colors.primary + '10' }]}>
                <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.primary }]}>
                  Draw, highlight, add arrows, or tap with the Text tool directly on the image above. Tap "Apply Markup" to permanently merge your annotations into the page.
                </Text>
              </View>
            </View>
          )}

          {/* ===================== RESIZE TAB ===================== */}
          {activeTab === 'resize' && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Presets</Text>
              <View style={styles.presetGrid}>
                {RESIZE_PRESETS.map(p => (
                  <TouchableOpacity key={p.label} style={[styles.presetBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => applyResizePreset(p.w, p.h)}>
                    <Text style={[styles.presetLabel, { color: colors.text }]}>{p.label}</Text>
                    <Text style={[styles.presetDims, { color: colors.textTertiary }]}>{p.w}×{p.h}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: Spacing.md }]}>Custom Dimensions</Text>
              <View style={styles.dimsRow}>
                <View style={styles.dimField}>
                  <Text style={[styles.dimLabel, { color: colors.textSecondary }]}>Width (px)</Text>
                  <TextInput style={[styles.dimInput, { borderColor: colors.border, color: colors.text }]} value={resizeWidth} onChangeText={setResizeWidth} keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
                </View>
                <Ionicons name="close" size={20} color={colors.textTertiary} style={{ marginTop: 20 }} />
                <View style={styles.dimField}>
                  <Text style={[styles.dimLabel, { color: colors.textSecondary }]}>Height (px)</Text>
                  <TextInput style={[styles.dimInput, { borderColor: colors.border, color: colors.text }]} value={resizeHeight} onChangeText={setResizeHeight} keyboardType="numeric" placeholderTextColor={colors.textTertiary} />
                </View>
              </View>

              <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.primary }]} onPress={handleResize} disabled={working}>
                <Ionicons name="resize-outline" size={18} color={colors.white} />
                <Text style={[styles.applyBtnText, { color: colors.white }]}>Resize Page</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ===================== OCR TAB ===================== */}
          {activeTab === 'ocr' && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Text Recognition (OCR)</Text>
              <Text style={[styles.subLabel, { color: colors.textSecondary }]}>Extract editable text from this scanned page. Requires internet connection.</Text>

              <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.secondary }]} onPress={handleOCR} disabled={ocrLoading}>
                {ocrLoading
                  ? <ActivityIndicator color={colors.white} />
                  : <><Ionicons name="scan-outline" size={18} color={colors.white} /><Text style={[styles.applyBtnText, { color: colors.white }]}>Extract Text from Image</Text></>
                }
              </TouchableOpacity>

              {ocrError ? (
                <View style={[styles.infoBox, { backgroundColor: colors.error + '15' }]}>
                  <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                  <Text style={[styles.infoText, { color: colors.error }]}>{ocrError}</Text>
                </View>
              ) : null}

              {ocrText ? (
                <>
                  <View style={[styles.ocrResult, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                    <Text selectable style={[styles.ocrText, { color: colors.text }]}>{ocrText}</Text>
                  </View>
                  <TouchableOpacity style={[styles.applyBtn, { backgroundColor: copiedFeedback ? colors.success : colors.primary }]} onPress={copyOcrText}>
                    <Ionicons name={copiedFeedback ? 'checkmark-outline' : 'copy-outline'} size={18} color={colors.white} />
                    <Text style={[styles.applyBtnText, { color: colors.white }]}>{copiedFeedback ? 'Copied to Clipboard!' : 'Copy All Text'}</Text>
                  </TouchableOpacity>
                  <Text style={[styles.subLabel, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
                    Tip: you can also select and copy specific words or lines directly from the text above.
                  </Text>
                </>
              ) : !ocrError ? (
                <View style={[styles.infoBox, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="text-outline" size={16} color={colors.primary} />
                  <Text style={[styles.infoText, { color: colors.primary }]}>Tap the button above to extract text from your scanned document.</Text>
                </View>
              ) : null}
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

        {/* Text Markup Prompt */}
        <Modal visible={textPromptVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Text</Text>
              <TextInput
                style={[styles.modalInput, { borderColor: colors.primary, color: colors.text }]}
                value={textPromptValue}
                onChangeText={setTextPromptValue}
                placeholder="Enter text..."
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
              <View style={styles.modalBtns}>
                <TouchableOpacity style={[styles.modalBtnCancel, { backgroundColor: colors.surfaceSecondary }]} onPress={() => setTextPromptVisible(false)}>
                  <Text style={[styles.modalBtnCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtnSave, { backgroundColor: colors.primary }]} onPress={confirmTextMarkup}>
                  <Text style={[styles.modalBtnSaveText, { color: colors.white }]}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageContainer: { position: 'relative' },
  viewShot: { width: SCREEN_W, height: PREVIEW_H },
  image: { width: '100%', height: '100%' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#fff', marginTop: Spacing.sm, fontSize: FontSize.sm },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, flexGrow: 0 },
  tabBarContent: { paddingHorizontal: Spacing.xs },
  tab: { alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, gap: 2, minWidth: 72 },
  tabText: { fontSize: 10, fontWeight: '600' },
  controls: { flex: 1 },
  section: { margin: Spacing.md, marginBottom: 0, borderRadius: BorderRadius.lg, padding: Spacing.md },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '700', marginBottom: Spacing.sm },
  subLabel: { fontSize: FontSize.xs, marginBottom: Spacing.sm, lineHeight: 16 },
  row: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  controlBtn: { flex: 1, minWidth: 70, alignItems: 'center', justifyContent: 'center', padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, gap: 2 },
  controlBtnText: { fontSize: FontSize.xs, fontWeight: '700' },
  filterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  filterBtn: { width: '47%', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1.5, gap: 6 },
  filterBtnSelected: {},
  filterBtnText: { fontSize: FontSize.xs, fontWeight: '600', textAlign: 'center' },
  applyBtn: { flexDirection: 'row', height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, gap: Spacing.sm, marginTop: Spacing.sm },
  applyBtnDisabled: { opacity: 0.5 },
  applyBtnText: { fontSize: FontSize.md, fontWeight: '700' },
  ratioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  ratioBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1 },
  ratioBtnText: { fontSize: FontSize.sm, fontWeight: '600' },
  cleanupIconBox: { alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.lg, paddingVertical: Spacing.xl, marginVertical: Spacing.sm },
  colorRow: { flexDirection: 'row', gap: Spacing.sm },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  presetBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, alignItems: 'center' },
  presetLabel: { fontSize: FontSize.sm, fontWeight: '600' },
  presetDims: { fontSize: FontSize.xs },
  dimsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  dimField: { flex: 1 },
  dimLabel: { fontSize: FontSize.xs, marginBottom: 4 },
  dimInput: { borderWidth: 1.5, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 44, fontSize: FontSize.md, textAlign: 'center' },
  infoBox: { flexDirection: 'row', padding: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.sm, alignItems: 'flex-start', marginTop: Spacing.md },
  infoText: { flex: 1, fontSize: FontSize.xs, lineHeight: 18 },
  ocrResult: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.md, maxHeight: 250 },
  ocrText: { fontSize: FontSize.sm, lineHeight: 22 },
  saveBar: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.sm, borderTopWidth: 1 },
  cancelBtn: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.md, borderWidth: 1 },
  cancelBtnText: { fontSize: FontSize.md, fontWeight: '600' },
  saveBtn: { flex: 2, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: BorderRadius.md },
  saveBtnText: { fontSize: FontSize.md, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalBox: { width: SCREEN_W - 80, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md },
  modalInput: { borderWidth: 1.5, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 48, fontSize: FontSize.md },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.md },
  modalBtnCancel: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  modalBtnCancelText: { fontSize: FontSize.md, fontWeight: '600' },
  modalBtnSave: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  modalBtnSaveText: { fontSize: FontSize.md, fontWeight: '700' },
});
