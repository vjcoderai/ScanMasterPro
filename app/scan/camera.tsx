import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  Alert, Dimensions, Platform, ActivityIndicator,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat,
  withTiming, withSequence, Easing, cancelAnimation,
} from 'react-native-reanimated';
import { useTheme } from '../../src/hooks/useTheme';
import { Spacing, BorderRadius, FontSize } from '../../src/constants';
import { ScanMode } from '../../src/types';
import { applyAutoCrop } from '../../src/utils/edgeDetection';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function CameraScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('auto');
  const [scanMode, setScanMode] = useState<ScanMode>('color');
  const [capturedPages, setCapturedPages] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [autoDetect, setAutoDetect] = useState(true);
  const [processingCrop, setProcessingCrop] = useState(false);

  // ---- ANIMATED EDGE-DETECTION GUIDE ----
  // Corner pulse: corners gently scale/glow to draw attention to alignment
  const cornerPulse = useSharedValue(1);
  // Scan line: moves up and down inside the frame, simulating active scanning
  const scanLineY = useSharedValue(0);
  // Frame highlight opacity: simulates "edges detected" glow
  const edgeGlow = useSharedValue(0.3);

  useEffect(() => {
    // Corner pulse animation - continuous breathing effect
    cornerPulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Scan line moves top to bottom continuously
    scanLineY.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.linear }),
      -1,
      false
    );

    // Edge glow pulses to simulate live edge detection feedback
    edgeGlow.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1100, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    return () => {
      cancelAnimation(cornerPulse);
      cancelAnimation(scanLineY);
      cancelAnimation(edgeGlow);
    };
  }, []);

  const cornerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cornerPulse.value }],
  }));

  const scanLineAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value * (FRAME_H - 4) }],
    opacity: autoDetect ? 1 : 0,
  }));

  const edgeGlowAnimStyle = useAnimatedStyle(() => ({
    opacity: autoDetect ? edgeGlow.value : 0,
  }));

  const toggleFlash = useCallback(() => {
    setFlash(prev => (prev === 'off' ? 'auto' : prev === 'auto' ? 'on' : 'off'));
  }, []);

  const toggleFacing = useCallback(() => {
    setFacing(prev => (prev === 'back' ? 'front' : 'back'));
  }, []);

  const cycleScanMode = useCallback(() => {
    setScanMode(prev => (prev === 'color' ? 'grayscale' : prev === 'grayscale' ? 'blackwhite' : 'color'));
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.92, base64: false, exif: false });
      if (photo?.uri) {
        let finalUri = photo.uri;

        // AUTO-DETECT MODE: apply auto-crop to trim camera framing margins
        // and align to the detected document boundary.
        if (autoDetect) {
          setProcessingCrop(true);
          try {
            finalUri = await applyAutoCrop(photo.uri);
          } catch {
            finalUri = photo.uri; // fall back to uncropped on any error
          } finally {
            setProcessingCrop(false);
          }
        }

        setCapturedPages(prev => [...prev, finalUri]);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, autoDetect]);

  const pickFromGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.92,
    });
    if (!result.canceled && result.assets) {
      setCapturedPages(prev => [...prev, ...result.assets.map(a => a.uri)]);
    }
  }, []);

  const proceedToReview = useCallback(() => {
    if (capturedPages.length === 0) { Alert.alert('No Pages', 'Capture at least one page.'); return; }
    router.push({ pathname: '/scan/review', params: { pages: JSON.stringify(capturedPages), scanMode } });
  }, [capturedPages, scanMode, router]);

  const removeLast = useCallback(() => setCapturedPages(prev => prev.slice(0, -1)), []);

  if (!permission) return <View style={styles.centered}><Text>Loading camera...</Text></View>;

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.permissionContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="camera-outline" size={80} color={colors.primaryLight} />
        <Text style={[styles.permissionTitle, { color: colors.text }]}>Camera Access Required</Text>
        <Text style={[styles.permissionText, { color: colors.textSecondary }]}>Scan Master Pro needs camera access to scan documents.</Text>
        <TouchableOpacity style={[styles.permissionBtn, { backgroundColor: colors.primary }]} onPress={requestPermission}>
          <Text style={[styles.permissionBtnText, { color: colors.white }]}>Grant Camera Access</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const scanModeLabel = scanMode === 'color' ? 'Color' : scanMode === 'grayscale' ? 'Gray' : 'B&W';
  const flashIcon = flash === 'off' ? 'flash-off' : flash === 'auto' ? 'flash-outline' : 'flash';

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} flash={flash} />

      {/* Document Edge Detection Overlay */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.scanFrame}>
            {/* Edge glow border - pulses to simulate live edge detection */}
            <Animated.View
              style={[
                styles.edgeGlowBorder,
                edgeGlowAnimStyle,
                { borderColor: colors.edgeDetectColor },
              ]}
            />

            {/* Animated corner markers */}
            <Animated.View style={[styles.corner, styles.cornerTL, cornerAnimStyle, { borderColor: colors.cornerColor }]} />
            <Animated.View style={[styles.corner, styles.cornerTR, cornerAnimStyle, { borderColor: colors.cornerColor }]} />
            <Animated.View style={[styles.corner, styles.cornerBL, cornerAnimStyle, { borderColor: colors.cornerColor }]} />
            <Animated.View style={[styles.corner, styles.cornerBR, cornerAnimStyle, { borderColor: colors.cornerColor }]} />

            {/* Moving scan line */}
            <Animated.View style={[styles.scanLine, scanLineAnimStyle, { backgroundColor: colors.edgeDetectColor }]} />

            {/* Document silhouette guide */}
            <View style={[styles.docSilhouette, { borderColor: colors.edgeDetectColor + '55' }]} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom} />
      </View>

      {/* Top Controls */}
      <SafeAreaView style={styles.topControls}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={[styles.statusPill, autoDetect && { backgroundColor: colors.edgeDetectColor + '33', borderColor: colors.edgeDetectColor }]}>
          {autoDetect && <View style={[styles.statusDot, { backgroundColor: colors.edgeDetectColor }]} />}
          <Text style={styles.pageCounter}>
            {capturedPages.length > 0
              ? `${capturedPages.length} page${capturedPages.length !== 1 ? 's' : ''}`
              : autoDetect ? 'Edge detection active' : 'Align document in frame'}
          </Text>
        </View>
        <TouchableOpacity style={styles.iconBtn} onPress={toggleFlash}>
          <Ionicons name={flashIcon as any} size={24} color="#fff" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Processing overlay while auto-cropping */}
      {processingCrop && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color={colors.edgeDetectColor} />
          <Text style={styles.processingText}>Detecting document edges...</Text>
        </View>
      )}

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <View style={styles.modeRow}>
          <TouchableOpacity style={styles.modeBtn} onPress={cycleScanMode}>
            <Ionicons name={scanMode === 'color' ? 'color-palette-outline' : 'contrast-outline'} size={18} color="#fff" />
            <Text style={styles.modeBtnText}>{scanModeLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, autoDetect && { backgroundColor: colors.edgeDetectColor + 'CC' }]}
            onPress={() => setAutoDetect(v => !v)}
          >
            <Ionicons name="scan-outline" size={18} color={autoDetect ? '#0A2E32' : '#fff'} />
            <Text style={[styles.modeBtnText, autoDetect && { color: '#0A2E32' }]}>
              Edge Detect: {autoDetect ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modeBtn} onPress={toggleFacing}>
            <Ionicons name="camera-reverse-outline" size={18} color="#fff" />
            <Text style={styles.modeBtnText}>Flip</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.captureRow}>
          <TouchableOpacity style={styles.sideBtn} onPress={pickFromGallery}>
            <Ionicons name="images-outline" size={28} color="#fff" />
            <Text style={styles.sideBtnText}>Import</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.shutterBtn, isCapturing && styles.shutterActive]} onPress={capturePhoto} activeOpacity={0.8} disabled={isCapturing || processingCrop}>
            {isCapturing
              ? <ActivityIndicator color="#0A2E32" />
              : <View style={[styles.shutterInner, { backgroundColor: colors.edgeDetectColor }]} />
            }
          </TouchableOpacity>

          {capturedPages.length > 0 ? (
            <TouchableOpacity style={styles.sideBtn} onPress={proceedToReview}>
              <View style={[styles.nextBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.nextBadgeText}>{capturedPages.length}</Text>
              </View>
              <Text style={styles.sideBtnText}>Next</Text>
            </TouchableOpacity>
          ) : <View style={styles.sideBtn} />}
        </View>

        {capturedPages.length > 0 && (
          <TouchableOpacity style={styles.removeLastBtn} onPress={removeLast}>
            <Ionicons name="backspace-outline" size={16} color="#fff" />
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
  container: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject },
  overlayTop: { height: TOP_H, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayMiddle: { flexDirection: 'row', height: FRAME_H },
  overlaySide: { width: SIDE_W, backgroundColor: 'rgba(0,0,0,0.6)' },
  scanFrame: { flex: 1, position: 'relative', overflow: 'hidden' },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },

  // Edge glow border - simulates "edges detected" feedback
  edgeGlowBorder: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 3,
    borderRadius: 8,
  },

  // Document silhouette guide - subtle inner rectangle showing ideal placement
  docSilhouette: {
    position: 'absolute',
    top: '6%', left: '6%', right: '6%', bottom: '6%',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 4,
  },

  // Animated scan line
  scanLine: {
    position: 'absolute',
    left: 0, right: 0, height: 3,
    shadowColor: '#39E6CC',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },

  corner: { position: 'absolute', width: 28, height: 28, borderWidth: 4 },
  cornerTL: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0, borderRadius: 4 },
  cornerTR: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0, borderRadius: 4 },
  cornerBL: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0, borderRadius: 4 },
  cornerBR: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0, borderRadius: 4 },

  topControls: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingTop: Platform.OS === 'ios' ? 0 : Spacing.md },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 22 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: 'transparent',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  pageCounter: { color: '#fff', fontSize: FontSize.sm, fontWeight: '600' },

  processingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
  },
  processingText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },

  bottomControls: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingHorizontal: Spacing.lg, backgroundColor: 'rgba(0,0,0,0.3)' },
  modeRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, marginBottom: Spacing.md, flexWrap: 'wrap' },
  modeBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  modeBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '600' },
  captureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shutterBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterActive: { opacity: 0.6 },
  shutterInner: { width: 58, height: 58, borderRadius: 29 },
  sideBtn: { width: 64, alignItems: 'center', justifyContent: 'center', gap: 4 },
  sideBtnText: { color: '#fff', fontSize: 11, fontWeight: '500' },
  nextBadge: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  nextBadgeText: { color: '#fff', fontSize: FontSize.lg, fontWeight: '700' },
  removeLastBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, marginTop: Spacing.sm },
  removeLastText: { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.sm },
  permissionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  permissionTitle: { fontSize: FontSize.xxl, fontWeight: '700', marginTop: Spacing.lg },
  permissionText: { fontSize: FontSize.md, textAlign: 'center', marginTop: Spacing.md, lineHeight: 22 },
  permissionBtn: { marginTop: Spacing.xl, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  permissionBtnText: { fontSize: FontSize.md, fontWeight: '700' },
});
