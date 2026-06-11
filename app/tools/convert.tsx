import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
  Switch,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize } from '../../src/constants';
import { createPdfFromImages } from '../../src/utils/imageUtils';
import { formatFileSize } from '../../src/utils/storage';
import * as FileSystem from 'expo-file-system';

export default function ConvertScreen() {
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
      setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
      setResultUri(null);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setImages((prev) => {
      const copy = [...prev];
      [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
      return copy;
    });
  };

  const handleConvert = async () => {
    if (images.length === 0) {
      Alert.alert('No Images', 'Please add at least one image.');
      return;
    }
    if (!outputName.trim()) {
      Alert.alert('Name Required', 'Please enter an output file name.');
      return;
    }
    setProcessing(true);
    try {
      const pdfUri = await createPdfFromImages(images, outputName.trim(), addTimestamp);
      setResultUri(pdfUri);
      const info = await FileSystem.getInfoAsync(pdfUri, { size: true });
      if (info.exists && 'size' in info) setResultSize((info as any).size);
    } catch (e: any) {
      Alert.alert('Conversion Failed', e.message || 'Failed to convert images to PDF.');
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
    <View style={styles.container}>
      {/* Images List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{images.length} Image{images.length !== 1 ? 's' : ''}</Text>
          <TouchableOpacity style={styles.addBtn} onPress={pickImages}>
            <Ionicons name="add" size={18} color={Colors.white} />
            <Text style={styles.addBtnText}>Add Images</Text>
          </TouchableOpacity>
        </View>

        {images.length === 0 ? (
          <TouchableOpacity style={styles.emptyPicker} onPress={pickImages}>
            <Ionicons name="images-outline" size={40} color={Colors.primaryLight} />
            <Text style={styles.emptyPickerText}>Tap to select images from gallery</Text>
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
                <Image source={{ uri: item }} style={styles.imageThumb} resizeMode="cover" />
                <View style={styles.imageNumber}>
                  <Text style={styles.imageNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.imageControls}>
                  {index > 0 && (
                    <TouchableOpacity onPress={() => moveUp(index)} style={styles.imageCtrlBtn}>
                      <Ionicons name="chevron-back" size={14} color={Colors.primary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => removeImage(index)} style={styles.imageCtrlBtn}>
                    <Ionicons name="close" size={14} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </View>

      {/* Settings */}
      {images.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Output Settings</Text>
          <View style={styles.inputRow}>
            <Ionicons name="document-outline" size={20} color={Colors.textSecondary} />
            <TextInput
              style={styles.input}
              value={outputName}
              onChangeText={setOutputName}
              placeholder="Output file name"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Add Date/Time Stamp</Text>
            <Switch
              value={addTimestamp}
              onValueChange={setAddTimestamp}
              trackColor={{ true: Colors.primary, false: Colors.border }}
              thumbColor={Colors.white}
            />
          </View>
        </View>
      )}

      {/* Convert Button */}
      {images.length > 0 && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.convertBtn, processing && styles.btnDisabled]}
            onPress={handleConvert}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="document-attach-outline" size={20} color={Colors.white} />
                <Text style={styles.convertBtnText}>Convert to PDF</Text>
              </>
            )}
          </TouchableOpacity>

          {resultUri && (
            <View style={styles.resultCard}>
              <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
              <View style={styles.resultInfo}>
                <Text style={styles.resultTitle}>PDF Created!</Text>
                <Text style={styles.resultSize}>{formatFileSize(resultSize)}</Text>
              </View>
              <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
                <Ionicons name="share-outline" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  addBtnText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '600' },
  emptyPicker: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primaryLight,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    backgroundColor: Colors.primary + '05',
  },
  emptyPickerText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  imageList: { gap: Spacing.sm, paddingRight: Spacing.sm },
  imageItem: { width: 80, position: 'relative' },
  imageThumb: { width: 80, height: 100, borderRadius: BorderRadius.sm, backgroundColor: Colors.border },
  imageNumber: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageNumberText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  imageControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomLeftRadius: BorderRadius.sm,
    borderBottomRightRadius: BorderRadius.sm,
    paddingVertical: 2,
  },
  imageCtrlBtn: { padding: 3 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  input: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontSize: FontSize.md, color: Colors.text, fontWeight: '500' },
  actions: { gap: Spacing.md },
  convertBtn: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  convertBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '10',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.success + '40',
    gap: Spacing.sm,
  },
  resultInfo: { flex: 1 },
  resultTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  resultSize: { fontSize: FontSize.sm, color: Colors.textSecondary },
  shareBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '15',
    borderRadius: BorderRadius.sm,
  },
});
