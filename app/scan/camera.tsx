import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, BorderRadius, FontSize } from '../../src/constants';
import { ScanMode } from '../../src/types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function CameraScreen() {
  const router = useRouter();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('auto');
  const [scanMode, setScanMode] = useState<ScanMode>('color');
  const [capturedPages, setCapturedPages] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);

  const toggleFlash = useCallback(() => {
    setFlash((prev) => (prev === 'off' ? 'auto' : prev === 'auto' ? 'on' : 'off'));
  }, []);

  const toggleFacing = useCallback(() => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  }, []);

  const cycleScanMode = useCallback(() => {
    setScanMode((prev) =>
      prev === 'color' ? 'grayscale' : prev === 'grayscale' ? 'blackwhite' : 'color'
    );
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.92,
        base64: false,
        exif: false,
      });
      if (photo?.uri) {
        setCapturedPages((prev) => [...prev, photo.uri]);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing]);

  const pickFromGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.92,
    });
    if (!result.canceled && result.assets) {
      const uris = result.assets.map((a) => a.uri);
      setCapturedPages((prev) => [...prev, ...uris]);
    }
  }, []);

  const proceedToReview = useCallback(() => {
    if (capturedPages.length === 0) {
      Alert.alert('No Pages', 'Please capture at least one page.');
      return;
    }
    router.push({
      pathname: '/scan/review',
      params: {
        pages: JSON.stringify(capturedPages),
        scanMode,
      },
    });
  }, [capturedPages, scanMode, router]);

  const removeLast = useCallback(() => {
    setCapturedPages((prev) => prev.slice(0, -1));
  }, []);

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={80} color={Colors.primaryLight} />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          ScanMaster Pro needs camera access to scan documents.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const scanModeLabel = scanMode === 'color' ? 'Color' : scanMode === 'grayscale' ? 'Gray' : 'B&W';
  const flashIcon = flash === 'off' ? 'flash-off' : flash === 'auto' ? 'flash-outline' : 'flash';

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        flash={flash}
      />

      {/* Document Edge Detection Overlay */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.scanFrame}>
            {/* Corner markers */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom} />
      </View>

      {/* Top Controls */}
      <SafeAreaView style={styles.topControls}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={26} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.pageCounter}>
          {capturedPages.length > 0 ? `${capturedPages.length} page${capturedPages.length !== 1 ? 's' : ''}` : 'Position document in frame'}
        </Text>
        <TouchableOpacity style={styles.iconBtn} onPress={toggleFlash}>
          <Ionicons name={flashIcon as any} size={24} color={Colors.white} />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        {/* Mode Row */}
        <View style={styles.modeRow}>
          <TouchableOpacity style={styles.modeBtn} onPress={cycleScanMode}>
            <Ionicons
              name={scanMode === 'color' ? 'color-palette-outline' : 'contrast-outline'}
              size={18}
              color={Colors.white}
            />
            <Text style={styles.modeBtnText}>{scanModeLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modeBtn} onPress={toggleFacing}>
            <Ionicons name="camera-reverse-outline" size={18} color={Colors.white} />
            <Text style={styles.modeBtnText}>Flip</Text>
          </TouchableOpacity>
        </View>

        {/* Capture Row */}
        <View style={styles.captureRow}>
          {/* Gallery */}
          <TouchableOpacity style={styles.sideBtn} onPress={pickFromGallery}>
            <Ionicons name="images-outline" size={28} color={Colors.white} />
            <Text style={styles.sideBtnText}>Import</Text>
          </TouchableOpacity>

          {/* Shutter */}
          <TouchableOpacity
            style={[styles.shutterBtn, isCapturing && styles.shutterActive]}
            onPress={capturePhoto}
            activeOpacity={0.8}
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          {/* Next / Remove Last */}
          {capturedPages.length > 0 ? (
            <TouchableOpacity style={styles.sideBtn} onPress={proceedToReview}>
              <View style={styles.nextBadge}>
                <Text style={styles.nextBadgeText}>{capturedPages.length}</Text>
              </View>
              <Text style={styles.sideBtnText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.sideBtn} />
          )}
        </View>

        {capturedPages.length > 0 && (
          <TouchableOpacity style={styles.removeLastBtn} onPress={removeLast}>
            <Ionicons name="backspace-outline" size={16} color={Colors.white} />
            <Text style={styles.removeLastText}>Remove last</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const FRAME_W = SCREEN_W * 0.85;
const FRAME_H = FRAME_W * 1.35;
const SIDE_W = (SCREEN_W - FRAME_W) / 2;
const TOP_H = (SCREEN_H - FRAME_H) / 2 - 60;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject },
  overlayTop: {
    height: TOP_H,
    backgroundColor: Colors.scanOverlay,
  },
  overlayMiddle: { flexDirection: 'row', height: FRAME_H },
  overlaySide: { width: SIDE_W, backgroundColor: Colors.scanOverlay },
  scanFrame: {
    flex: 1,
    borderWidth: 0,
  },
  overlayBottom: { flex: 1, backgroundColor: Colors.scanOverlay },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: Colors.cornerColor,
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderRadius: 2 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderRadius: 2 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderRadius: 2 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderRadius: 2 },
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 0 : Spacing.md,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 22,
  },
  pageCounter: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingHorizontal: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xl,
    marginBottom: Spacing.md,
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  modeBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '600' },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterActive: { opacity: 0.6 },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.white,
  },
  sideBtn: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  sideBtnText: { color: Colors.white, fontSize: 11, fontWeight: '500' },
  nextBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  nextBadgeText: { color: Colors.white, fontSize: FontSize.lg, fontWeight: '700' },
  removeLastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  removeLastText: { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.sm },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  permissionTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.lg,
  },
  permissionText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 22,
  },
  permissionBtn: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  permissionBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
