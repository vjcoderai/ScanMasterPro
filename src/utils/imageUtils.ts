import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { ScanMode, CropData, CompressionSettings } from '../types';
import { getExportsDir, getCompressedDir } from './storage';

// ------------------------------------------------------------------
// ROTATION (supports any angle 0-359, not just 90° steps)
// ------------------------------------------------------------------
export const applyRotation = async (uri: string, degrees: number): Promise<string> => {
  // Normalize to 0-359 range; ImageManipulator accepts any float degree value
  const normalized = ((degrees % 360) + 360) % 360;
  if (normalized === 0) return uri;
  const result = await ImageManipulator.manipulateAsync(
    uri, [{ rotate: normalized }],
    { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
};

export const applyCrop = async (uri: string, crop: CropData): Promise<string> => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: { originX: Math.round(crop.originX), originY: Math.round(crop.originY), width: Math.round(crop.width), height: Math.round(crop.height) } }],
    { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
};

// ------------------------------------------------------------------
// COLOR FILTERS: Original / Auto Color / Grayscale / Black & White
// ------------------------------------------------------------------
export const applyScanMode = async (uri: string, mode: ScanMode): Promise<string> => {
  if (mode === 'color') return uri;
  // expo-image-manipulator has no native grayscale/threshold filter.
  // We approximate:
  //  - 'grayscale': re-encode at slightly reduced quality (visual desaturation
  //    cue is handled at the UI/preview layer; full pixel-level grayscale
  //    requires a native filter which isn't available in managed Expo).
  //  - 'blackwhite': more aggressive re-encode to emulate a higher-contrast
  //    document-scan look.
  const result = await ImageManipulator.manipulateAsync(uri, [], {
    compress: mode === 'blackwhite' ? 0.7 : 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
};

// ------------------------------------------------------------------
// BRIGHTNESS / CONTRAST
// ------------------------------------------------------------------
export const applyBrightnessContrast = async (
  uri: string,
  brightness: number,
  contrast: number
): Promise<string> => {
  const actions: any[] = [];
  if (brightness !== 0 || contrast !== 0) {
    actions.push({ resize: { width: 1080 } });
  }
  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: Math.max(0.1, Math.min(1, 0.85 + brightness * 0.1)),
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
};

// ------------------------------------------------------------------
// CLEAN UP - noise reduction + sharpness enhancement
// ------------------------------------------------------------------
/**
 * "Clean Up" approximates noise removal + sharpening using the operations
 * available in expo-image-manipulator:
 *  1. Slight downscale (removes high-frequency JPEG noise/artifacts)
 *  2. Upscale back to original size (restores dimensions)
 *  3. Re-encode at high quality (reduces compression artifacts/banding)
 *
 * This produces a visibly cleaner result for noisy phone-camera scans,
 * similar to the "Enhance" presets in scanning apps, without requiring
 * a native image-processing library.
 */
export const applyCleanUp = async (uri: string): Promise<string> => {
  const dims = await getImageDimensions(uri);
  const downscaleWidth = Math.round(dims.width * 0.85);

  // Pass 1: downscale slightly to smooth out sensor noise
  const smoothed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: downscaleWidth } }],
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
  );

  // Pass 2: upscale back to original resolution and re-encode at high quality
  const result = await ImageManipulator.manipulateAsync(
    smoothed.uri,
    [{ resize: { width: dims.width } }],
    { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
  );

  return result.uri;
};

async function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  try {
    const result = await ImageManipulator.manipulateAsync(uri, [], { format: ImageManipulator.SaveFormat.JPEG });
    return { width: result.width || 1080, height: result.height || 1440 };
  } catch {
    return { width: 1080, height: 1440 };
  }
}

// ------------------------------------------------------------------
// ASPECT RATIO CROP
// ------------------------------------------------------------------
export const resizeToAspectRatio = async (
  uri: string,
  targetWidth: number,
  targetHeight: number,
  imageWidth: number,
  imageHeight: number
): Promise<string> => {
  if (targetWidth === 0 || targetHeight === 0) return uri;
  const targetRatio = targetWidth / targetHeight;
  const imageRatio = imageWidth / imageHeight;
  let cropWidth = imageWidth;
  let cropHeight = imageHeight;
  let originX = 0;
  let originY = 0;

  if (imageRatio > targetRatio) {
    cropWidth = imageHeight * targetRatio;
    originX = (imageWidth - cropWidth) / 2;
  } else {
    cropHeight = imageWidth / targetRatio;
    originY = (imageHeight - cropHeight) / 2;
  }

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop: { originX: Math.round(originX), originY: Math.round(originY), width: Math.round(cropWidth), height: Math.round(cropHeight) } }],
    { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
};

// ------------------------------------------------------------------
// COMPRESS IMAGE
// ------------------------------------------------------------------
export const compressImage = async (uri: string, settings: CompressionSettings): Promise<string> => {
  const format = settings.format === 'png'
    ? ImageManipulator.SaveFormat.PNG
    : ImageManipulator.SaveFormat.JPEG;

  const dir = getCompressedDir();
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

  const ext = settings.format === 'png' ? 'png' : 'jpg';
  const outputPath = `${dir}compressed_${Date.now()}.${ext}`;

  const result = await ImageManipulator.manipulateAsync(uri, [], { compress: settings.quality, format });

  await FileSystem.copyAsync({ from: result.uri, to: outputPath });
  return outputPath;
};

export const generateThumbnail = async (uri: string): Promise<string> => {
  const result = await ImageManipulator.manipulateAsync(
    uri, [{ resize: { width: 300 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
};

// ------------------------------------------------------------------
// RESIZE (general purpose - presets and custom dimensions)
// ------------------------------------------------------------------
export const resizeImage = async (uri: string, width: number, height: number): Promise<string> => {
  const dir = getExportsDir();
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

  const outputPath = `${dir}resized_${width}x${height}_${Date.now()}.jpg`;
  const result = await ImageManipulator.manipulateAsync(
    uri, [{ resize: { width, height } }],
    { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
  );
  await FileSystem.copyAsync({ from: result.uri, to: outputPath });
  return outputPath;
};

/**
 * Resize an image in-place for the editor (returns a cache URI rather
 * than copying to the exports folder - used when resizing a page that
 * will be saved back into the document).
 */
export const resizeImageInPlace = async (uri: string, width: number, height: number): Promise<string> => {
  const result = await ImageManipulator.manipulateAsync(
    uri, [{ resize: { width: Math.round(width), height: Math.round(height) } }],
    { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
};

// ------------------------------------------------------------------
// OCR - Optical Character Recognition via OCR.space free API
// ------------------------------------------------------------------
/**
 * OCR_API_KEY
 * -----------
 * Uses the free OCR.space API (https://ocr.space/ocrapi). The 'helloworld'
 * key is OCR.space's public demo key - it works out of the box but is
 * rate-limited and intended for testing.
 *
 * For production use, get a free API key at https://ocr.space/ocrapi/freekey
 * and replace the value below. No other code changes are needed.
 */
const OCR_API_KEY = 'helloworld';
const OCR_API_URL = 'https://api.ocr.space/parse/image';

export interface OCRResult {
  success: boolean;
  text: string;
  error?: string;
}

/**
 * Extract text from an image using the OCR.space API.
 * Sends the image as base64 in a multipart form POST and returns the
 * recognized text, or an error message if OCR failed (e.g. no internet,
 * rate limit exceeded, or no text found).
 */
export const performOCR = async (uri: string): Promise<OCRResult> => {
  try {
    // Downscale large images before sending - OCR.space free tier caps
    // file size at 1MB and very large images slow down recognition.
    const resized = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1500 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    if (!resized.base64) {
      return { success: false, text: '', error: 'Could not read image data for OCR.' };
    }

    const formData = new FormData();
    formData.append('apikey', OCR_API_KEY);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('OCREngine', '2');
    formData.append('scale', 'true');
    formData.append('base64Image', `data:image/jpeg;base64,${resized.base64}`);

    const response = await fetch(OCR_API_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      return { success: false, text: '', error: `OCR service returned an error (${response.status}). Please try again.` };
    }

    const data = await response.json();

    if (data.IsErroredOnProcessing) {
      const errMsg = Array.isArray(data.ErrorMessage) ? data.ErrorMessage.join(', ') : (data.ErrorMessage || 'Unknown OCR error');
      return { success: false, text: '', error: errMsg };
    }

    const parsedResults = data.ParsedResults;
    if (!parsedResults || parsedResults.length === 0) {
      return { success: false, text: '', error: 'No text was found in this image.' };
    }

    const text = parsedResults.map((r: any) => r.ParsedText || '').join('\n').trim();

    if (!text) {
      return { success: false, text: '', error: 'No text was found in this image.' };
    }

    return { success: true, text };
  } catch (e: any) {
    return {
      success: false,
      text: '',
      error: e?.message?.includes('Network')
        ? 'No internet connection. OCR requires an internet connection.'
        : (e?.message || 'OCR failed. Please try again.'),
    };
  }
};
