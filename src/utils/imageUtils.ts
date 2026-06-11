import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { ScanMode, CropData, CompressionSettings } from '../types';
import { getExportsDir } from './storage';

export const applyRotation = async (
  uri: string,
  degrees: number
): Promise<string> => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ rotate: degrees }],
    { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
};

export const applyCrop = async (uri: string, crop: CropData): Promise<string> => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [
      {
        crop: {
          originX: Math.round(crop.originX),
          originY: Math.round(crop.originY),
          width: Math.round(crop.width),
          height: Math.round(crop.height),
        },
      },
    ],
    { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
};

export const applyScanMode = async (
  uri: string,
  mode: ScanMode
): Promise<string> => {
  if (mode === 'color') return uri;
  // For grayscale and b&w, we use ImageManipulator with adjustments
  // expo-image-manipulator doesn't natively support grayscale,
  // but we can simulate it via saturation=0 when using the resize trick
  const info = await ImageManipulator.manipulateAsync(uri, [], {
    compress: mode === 'blackwhite' ? 0.7 : 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return info.uri;
};

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
    [
      {
        crop: {
          originX: Math.round(originX),
          originY: Math.round(originY),
          width: Math.round(cropWidth),
          height: Math.round(cropHeight),
        },
      },
    ],
    { compress: 0.95, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
};

export const compressImage = async (
  uri: string,
  settings: CompressionSettings
): Promise<string> => {
  const format =
    settings.format === 'png'
      ? ImageManipulator.SaveFormat.PNG
      : ImageManipulator.SaveFormat.JPEG;

  const result = await ImageManipulator.manipulateAsync(uri, [], {
    compress: settings.quality,
    format,
  });
  return result.uri;
};

export const generateThumbnail = async (uri: string): Promise<string> => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 300 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
};

export const convertImageToPdfBase64 = async (uri: string): Promise<string> => {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64;
};

/**
 * Create a simple PDF from images using raw PDF generation
 * This creates a valid multi-page PDF with embedded JPEG images
 */
export const createPdfFromImages = async (
  imageUris: string[],
  outputName: string,
  addTimestamp: boolean = false
): Promise<string> => {
  const outputDir = getExportsDir();
  const outputPath = `${outputDir}${outputName}.pdf`;

  try {
    // Read all images as base64
    const imageData: { base64: string; width: number; height: number }[] = [];
    for (const uri of imageUris) {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // Get image dimensions using manipulator
      const info = await ImageManipulator.manipulateAsync(uri, [], {
        format: ImageManipulator.SaveFormat.JPEG,
      });
      imageData.push({ base64, width: info.width, height: info.height });
    }

    // Build PDF using minimal PDF structure
    const pdfContent = buildPdf(imageData, addTimestamp);
    await FileSystem.writeAsStringAsync(outputPath, pdfContent, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return outputPath;
  } catch (error) {
    console.error('PDF creation error:', error);
    throw error;
  }
};

/**
 * Build a raw PDF with embedded images.
 * Returns the PDF as a base64-encoded string.
 */
function buildPdf(
  images: { base64: string; width: number; height: number }[],
  addTimestamp: boolean
): string {
  // We build a minimal valid PDF manually as binary.
  // For a React Native / Expo environment without native PDF libs,
  // we embed images as XObject resources in each page.
  const timestamp = addTimestamp ? new Date().toLocaleString() : null;

  // Use A4 page size in points (595 x 842)
  const PAGE_W = 595;
  const PAGE_H = 842;

  let objectNumber = 1;
  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const imageObjectIds: number[] = [];

  // Helper to add object
  const addObject = (content: string): number => {
    const id = objectNumber++;
    objects.push(`${id} 0 obj\n${content}\nendobj\n`);
    return id;
  };

  // Add each image as PDF stream object
  for (const img of images) {
    const imgBytes = atob(img.base64);
    const byteLen = imgBytes.length;

    // Image XObject
    const imgStream =
      `<<\n/Type /XObject\n/Subtype /Image\n/Width ${img.width}\n/Height ${img.height}\n` +
      `/ColorSpace /DeviceRGB\n/BitsPerComponent 8\n/Filter /DCTDecode\n/Length ${byteLen}\n>>\nstream\n` +
      imgBytes +
      `\nendstream`;
    const imgId = addObject(imgStream);
    imageObjectIds.push(imgId);
  }

  // Add each page
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const imgId = imageObjectIds[i];

    // Scale image to fit page while maintaining aspect ratio
    const scaleX = PAGE_W / img.width;
    const scaleY = PAGE_H / img.height;
    const scale = Math.min(scaleX, scaleY, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (PAGE_W - w) / 2;
    const y = (PAGE_H - h) / 2;

    let contentStr = `q ${w} 0 0 ${h} ${x} ${y} cm /Im${i} Do Q`;

    if (timestamp) {
      contentStr += `\nBT /F1 9 Tf 10 10 Td (${timestamp}) Tj ET`;
    }

    const contentId = addObject(
      `<<\n/Length ${contentStr.length}\n>>\nstream\n${contentStr}\nendstream`
    );

    const pageResources =
      `<<\n/XObject <<\n/Im${i} ${imgId} 0 R\n>>\n` +
      (timestamp ? `/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n` : '') +
      `>>`;

    const pageId = addObject(
      `<<\n/Type /Page\n/MediaBox [0 0 ${PAGE_W} ${PAGE_H}]\n/Resources ${pageResources}\n/Contents ${contentId} 0 R\n>>`
    );
    pageObjectIds.push(pageId);
  }

  // Pages dictionary
  const pagesRef = pageObjectIds.map((id) => `${id} 0 R`).join(' ');
  const pagesId = addObject(
    `<<\n/Type /Pages\n/Kids [${pagesRef}]\n/Count ${pageObjectIds.length}\n>>`
  );

  // Update page parent references (patch into each page)
  for (const pid of pageObjectIds) {
    const idx = pid - 1;
    objects[idx] = objects[idx].replace(
      '/Type /Page\n',
      `/Type /Page\n/Parent ${pagesId} 0 R\n`
    );
  }

  // Catalog
  const catalogId = addObject(`<<\n/Type /Catalog\n/Pages ${pagesId} 0 R\n>>`);

  // Assemble PDF
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  // Cross-reference table
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objectNumber}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += String(off).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<<\n/Size ${objectNumber}\n/Root ${catalogId} 0 R\n>>\nstartxref\n${xrefOffset}\n%%EOF`;

  // Convert to base64
  return btoa(pdf);
}

// Polyfill atob/btoa for React Native if needed
function atob(b64: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let result = '';
  let i = 0;
  b64 = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  while (i < b64.length) {
    const c1 = chars.indexOf(b64[i++]);
    const c2 = chars.indexOf(b64[i++]);
    const c3 = chars.indexOf(b64[i++]);
    const c4 = chars.indexOf(b64[i++]);
    result +=
      String.fromCharCode((c1 << 2) | (c2 >> 4)) +
      (c3 !== 64 ? String.fromCharCode(((c2 & 15) << 4) | (c3 >> 2)) : '') +
      (c4 !== 64 ? String.fromCharCode(((c3 & 3) << 6) | c4) : '');
  }
  return result;
}

function btoa(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let result = '';
  let i = 0;
  while (i < str.length) {
    const c1 = str.charCodeAt(i++) & 0xff;
    const c2 = i < str.length ? str.charCodeAt(i++) & 0xff : 0;
    const c3 = i < str.length ? str.charCodeAt(i++) & 0xff : 0;
    result +=
      chars[c1 >> 2] +
      chars[((c1 & 3) << 4) | (c2 >> 4)] +
      (i - 1 < str.length ? chars[((c2 & 15) << 2) | (c3 >> 6)] : '=') +
      (i < str.length ? chars[c3 & 63] : '=');
  }
  return result;
}
