import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDocuments } from '../../src/hooks/useDocuments';
import { Colors, Spacing, BorderRadius, FontSize, AspectRatios } from '../../src/constants';
import { resizeToAspectRatio, applyScanMode, compressImage, applyRotation } from '../../src/utils/imageUtils';
import { ScanMode } from '../../src/types';

const { width: SCREEN_W } = Dimensions.get('window');

export default function EditPageScreen() {
  const { docId, pageIndex } = useLocalSearchParams<{ docId: string; pageIndex: string }>();
  const router = useRouter();
  const { getDocument, updateDocument } = useDocuments();

  const doc = getDocument(docId);
  const idx = parseInt(pageIndex || '0', 10);
  const page = doc?.pages[idx];

  const [currentUri, setCurrentUri] = useState(page?.uri || '');
  const [working, setWorking] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>(page?.scanMode || 'color');
  const [rotation, setRotation] = useState(page?.rotation || 0);

  const withLoading = useCallback(async (fn: () => Promise<void>) => {
    setWorking(true);
    try {
      await fn();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Operation failed.');
    } finally {
      setWorking(false);
    }
  }, []);

  const handleRotate = useCallback(
    (degrees: number) => {
      withLoading(async () => {
        const newUri = await applyRotation(currentUri, degrees);
        setCurrentUri(newUri);
        setRotation((r) => (r + degrees) % 360);
      });
    },
    [currentUri, withLoading]
  );

  const handleScanMode = useCallback(
    (mode: ScanMode) => {
      withLoading(async () => {
        const newUri = await applyScanMode(currentUri, mode);
        setCurrentUri(newUri);
        setScanMode(mode);
      });
    },
    [currentUri, withLoading]
  );

  const handleAspectRatio = useCallback(
    (ratioW: number, ratioH: number) => {
      if (ratioW === 0) return; // free
      withLoading(async () => {
        const newUri = await resizeToAspectRatio(
          currentUri,
          ratioW,
          ratioH,
          SCREEN_W,
          SCREEN_W * 1.4
        );
        setCurrentUri(newUri);
      });
    },
    [currentUri, withLoading]
  );

  const handleSave = useCallback(async () => {
    if (!doc) return;
    const updatedPages = doc.pages.map((p, i) =>
      i === idx ? { ...p, uri: currentUri, scanMode, rotation } : p
    );
    await updateDocument(doc.id, { pages: updatedPages, thumbnail: updatedPages[0]?.uri });
    router.back();
  }, [doc, idx, currentUri, scanMode, rotation, updateDocument, router]);

  if (!page) {
    return (
      <View style={styles.centered}>
        <Text>Page not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `Edit Page ${idx + 1}` }} />
      <View style={styles.container}>
        {/* Image Preview */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: currentUri }} style={styles.image} resizeMode="contain" />
          {working && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Processing...</Text>
            </View>
          )}
        </View>

        {/* Edit Controls */}
        <ScrollView style={styles.controls} showsVerticalScrollIndicator={false}>
          {/* Rotation */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rotation</Text>
            <View style={styles.row}>
              <TouchableOpacity style={styles.controlBtn} onPress={() => handleRotate(-90)} disabled={working}>
                <Ionicons name="refresh-outline" size={22} color={Colors.primary} style={{ transform: [{ scaleX: -1 }] }} />
                <Text style={styles.controlBtnText}>↺ 90°</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlBtn} onPress={() => handleRotate(90)} disabled={working}>
                <Ionicons name="refresh-outline" size={22} color={Colors.primary} />
                <Text style={styles.controlBtnText}>↻ 90°</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlBtn} onPress={() => handleRotate(180)} disabled={working}>
                <Ionicons name="repeat-outline" size={22} color={Colors.primary} />
                <Text style={styles.controlBtnText}>180°</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Scan Mode */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Color Mode</Text>
            <View style={styles.row}>
              {(['color', 'grayscale', 'blackwhite'] as ScanMode[]).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.modeBtn, scanMode === mode && styles.modeBtnActive]}
                  onPress={() => handleScanMode(mode)}
                  disabled={working}
                >
                  <Ionicons
                    name={mode === 'color' ? 'color-palette-outline' : 'contrast-outline'}
                    size={20}
                    color={scanMode === mode ? Colors.white : Colors.primary}
                  />
                  <Text style={[styles.modeBtnText, scanMode === mode && styles.modeBtnTextActive]}>
                    {mode === 'color' ? 'Color' : mode === 'grayscale' ? 'Grayscale' : 'B&W'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Aspect Ratio */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Aspect Ratio</Text>
            <View style={styles.ratioGrid}>
              {AspectRatios.map((ratio) => (
                <TouchableOpacity
                  key={ratio.value}
                  style={styles.ratioBtn}
                  onPress={() => handleAspectRatio(ratio.width, ratio.height)}
                  disabled={working}
                >
                  <Text style={styles.ratioBtnText}>{ratio.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* Save */}
        <View style={styles.saveBar}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={working}>
            <Ionicons name="checkmark-outline" size={20} color={Colors.white} />
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageContainer: {
    height: SCREEN_W * 0.7,
    backgroundColor: Colors.black,
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { color: Colors.white, marginTop: Spacing.sm, fontSize: FontSize.sm },
  controls: { flex: 1 },
  section: {
    backgroundColor: Colors.surface,
    margin: Spacing.md,
    marginBottom: 0,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm },
  controlBtn: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.md,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  controlBtnText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.primary },
  modeBtn: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.md,
    gap: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  modeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modeBtnText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.primary },
  modeBtnTextActive: { color: Colors.white },
  ratioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  ratioBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ratioBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
  saveBar: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: {
    flex: 2,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  saveBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
});
