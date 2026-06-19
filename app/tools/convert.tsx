import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Alert, ActivityIndicator, Image, TextInput, Switch,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/hooks/useTheme';
import { useDocuments } from '../../src/hooks/useDocuments';
import { Spacing, BorderRadius, FontSize } from '../../src/constants';
import { formatFileSize, generateId } from '../../src/utils/storage';
import { createPDFFromImages } from '../../src/utils/pdfUtils';

export default function ConvertScreen() {
  const { colors } = useTheme();
  const { addDocument } = useDocuments();
  const [images, setImages] = useState<string[]>([]);
  const [outputName, setOutputName] = useState(`document_${Date.now()}`);
  const [addTimestamp, setAddTimestamp] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState(0);

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.9,
    });
    if (!result.canceled) {
      setImages(prev => [...prev, ...result.assets.map(a => a.uri)]);
      setResultUri(null);
    }
  };

  const removeImage = (index: number) => setImages(prev => prev.filter((_, i) => i !== index));

  const moveUp = (index: number) => {
    if (index === 0) return;
    setImages(prev => {
      const copy = [...prev];
      [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
      return copy;
    });
  };

  const handleConvert = async () => {
    if (images.length === 0) { Alert.alert('No Images', 'Add at least one image.'); return; }
    if (!outputName.trim()) { Alert.alert('Name Required', 'Enter an output file name.'); return; }
    setProcessing(true);
    try {
      const pdfUri = await createPDFFromImages(images, outputName.trim(), addTimestamp);
      setResultUri(pdfUri);
      const info = await FileSystem.getInfoAsync(pdfUri, { size: true });
      const size = info.exists && 'size' in info ? (info as any).size : 0;
      setResultSize(size);

      // Add to dashboard under converted folder
      const now = new Date().toISOString();
      await addDocument({
        id: generateId(),
        name: outputName.trim(),
        pages: images.map((uri, i) => ({ id: String(i), uri, width: 0, height: 0, rotation: 0, scanMode: 'color' as const, createdAt: now })),
        createdAt: now,
        updatedAt: now,
        format: 'pdf',
        fileUri: pdfUri,
        fileSize: size,
        thumbnail: images[0],
        folder: 'converted',
        dateTimeStamp: addTimestamp,
      });

      Alert.alert('✅ Converted!', `"${outputName}.pdf" saved to Converted folder in dashboard.`, [
        { text: 'Share', onPress: async () => { const ok = await Sharing.isAvailableAsync(); if (ok) await Sharing.shareAsync(pdfUri); } },
        { text: 'OK' },
      ]);
    } catch (e: any) {
      Alert.alert('Failed', e.message || 'Conversion failed.');
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.section, { backgroundColor: colors.surface }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{images.length} Image{images.length !== 1 ? 's' : ''}</Text>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={pickImages}>
            <Ionicons name="add" size={18} color={colors.white} />
            <Text style={[styles.addBtnText, { color: colors.white }]}>Add Images</Text>
          </TouchableOpacity>
        </View>

        {images.length === 0 ? (
          <TouchableOpacity style={[styles.emptyPicker, { borderColor: colors.primaryLight, backgroundColor: colors.primary + '05' }]} onPress={pickImages}>
            <Ionicons name="images-outline" size={40} color={colors.primaryLight} />
            <Text style={[styles.emptyPickerText, { color: colors.textSecondary }]}>Tap to select images</Text>
          </TouchableOpacity>
        ) : (
          <FlatList
            data={images}
            horizontal
            keyExtractor={(_, i) => i.toString()}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imageList}
            renderItem={({ item, index }) => (
              <View style={styles.imageItem}>
                <Image source={{ uri: item }} style={[styles.imageThumb, { backgroundColor: colors.border }]} resizeMode="cover" />
                <View style={[styles.imageNumber, { backgroundColor: colors.primary }]}>
                  <Text style={styles.imageNumberText}>{index + 1}</Text>
                </View>
                <View style={[styles.imageControls, { backgroundColor: 'rgba(255,255,255,0.9)' }]}>
                  {index > 0 && (
                    <TouchableOpacity onPress={() => moveUp(index)} style={styles.imageCtrlBtn}>
                      <Ionicons name="chevron-back" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => removeImage(index)} style={styles.imageCtrlBtn}>
                    <Ionicons name="close" size={14} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </View>

      {images.length > 0 && (
        <>
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Output Settings</Text>
            <View style={[styles.inputRow, { borderColor: colors.border }]}>
              <Ionicons name="document-outline" size={20} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={outputName}
                onChangeText={setOutputName}
                placeholder="Output file name"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>Add Date/Time Stamp</Text>
              <Switch value={addTimestamp} onValueChange={setAddTimestamp}
                trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.white} />
            </View>
            <View style={[styles.infoBox, { backgroundColor: colors.primary + '10' }]}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.primary }]}>PDF will appear in Converted folder on your dashboard.</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.convertBtn, { backgroundColor: colors.primary }, processing && styles.btnDisabled]}
              onPress={handleConvert} disabled={processing}
            >
              {processing
                ? <ActivityIndicator color={colors.white} />
                : <><Ionicons name="document-attach-outline" size={20} color={colors.white} /><Text style={[styles.convertBtnText, { color: colors.white }]}>Convert to PDF</Text></>
              }
            </TouchableOpacity>

            {resultUri && (
              <View style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.success + '40' }]}>
                <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                <View style={styles.resultInfo}>
                  <Text style={[styles.resultTitle, { color: colors.text }]}>PDF Created & Saved!</Text>
                  <Text style={[styles.resultSize, { color: colors.textSecondary }]}>{formatFileSize(resultSize)}</Text>
                </View>
                <TouchableOpacity onPress={handleShare} style={[styles.shareBtn, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons name="share-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.md },
  section: { borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.sm },
  addBtnText: { fontSize: FontSize.sm, fontWeight: '600' },
  emptyPicker: { height: 120, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderRadius: BorderRadius.md, gap: Spacing.sm },
  emptyPickerText: { fontSize: FontSize.sm },
  imageList: { gap: Spacing.sm, paddingRight: Spacing.sm },
  imageItem: { width: 80, position: 'relative' },
  imageThumb: { width: 80, height: 100, borderRadius: BorderRadius.sm },
  imageNumber: { position: 'absolute', top: 4, left: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  imageNumberText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  imageControls: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', borderBottomLeftRadius: BorderRadius.sm, borderBottomRightRadius: BorderRadius.sm, paddingVertical: 2 },
  imageCtrlBtn: { padding: 3 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 48, gap: Spacing.sm, marginBottom: Spacing.md },
  input: { flex: 1, fontSize: FontSize.md },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  switchLabel: { fontSize: FontSize.md, fontWeight: '500' },
  infoBox: { flexDirection: 'row', padding: Spacing.sm, borderRadius: BorderRadius.sm, gap: Spacing.sm, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: FontSize.xs, lineHeight: 18 },
  actions: { gap: Spacing.md },
  convertBtn: { height: 52, borderRadius: BorderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  btnDisabled: { opacity: 0.6 },
  convertBtnText: { fontSize: FontSize.md, fontWeight: '700' },
  resultCard: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, gap: Spacing.sm },
  resultInfo: { flex: 1 },
  resultTitle: { fontSize: FontSize.md, fontWeight: '700' },
  resultSize: { fontSize: FontSize.sm },
  shareBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.sm },
});
