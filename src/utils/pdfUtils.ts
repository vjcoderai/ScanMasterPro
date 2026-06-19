import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { getMergedDir, getExportsDir, getCompressedDir } from './storage';

/**
 * ============================================================
 * PDF UTILITIES
 * ============================================================
 * This module provides:
 *  - createPDFFromImages: build a PDF from an array of image URIs
 *  - mergePDFsProper: merge multiple real PDF files by parsing
 *    their object structure and re-assembling a valid combined PDF
 *  - compressPDF: reduce PDF file size by re-encoding embedded
 *    images at lower quality
 *  - getPdfPageCount: estimate page count of a PDF
 *
 * All PDF building uses a hand-written minimal PDF writer since
 * native PDF libraries are not available in a managed Expo build.
 * ============================================================
 */

const PAGE_W = 595; // A4 width in points
const PAGE_H = 842; // A4 height in points

// ------------------------------------------------------------------
// Base64 helpers (binary-safe, no atob/btoa dependency issues on RN)
// ------------------------------------------------------------------
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decodeBase64(b64: string): string {
  let result = '';
  let i = 0;
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  while (i < clean.length) {
    const c1 = B64_CHARS.indexOf(clean[i++]);
    const c2 = B64_CHARS.indexOf(clean[i++]);
    const c3 = B64_CHARS.indexOf(clean[i++]);
    const c4 = B64_CHARS.indexOf(clean[i++]);
    result += String.fromCharCode((c1 << 2) | (c2 >> 4));
    if (c3 !== 64 && c3 !== -1) result += String.fromCharCode(((c2 & 15) << 4) | (c3 >> 2));
    if (c4 !== 64 && c4 !== -1) result += String.fromCharCode(((c3 & 3) << 6) | c4);
  }
  return result;
}

export function encodeBase64(str: string): string {
  let result = '';
  let i = 0;
  while (i < str.length) {
    const c1 = str.charCodeAt(i++) & 0xff;
    const c2 = i < str.length ? str.charCodeAt(i++) & 0xff : NaN;
    const c3 = i < str.length ? str.charCodeAt(i++) & 0xff : NaN;
    const e1 = c1 >> 2;
    const e2 = ((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4);
    const e3 = isNaN(c2) ? 64 : ((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6);
    const e4 = isNaN(c3) ? 64 : c3 & 63;
    result += B64_CHARS[e1] + B64_CHARS[e2] + (e3 === 64 ? '=' : B64_CHARS[e3]) + (e4 === 64 ? '=' : B64_CHARS[e4]);
  }
  return result;
}

async function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  try {
    const result = await ImageManipulator.manipulateAsync(uri, [], { format: ImageManipulator.SaveFormat.JPEG });
    return { width: result.width || 1080, height: result.height || 1440 };
  } catch {
    return { width: 1080, height: 1440 };
  }
}

// ------------------------------------------------------------------
// PDF WRITER - low-level object/xref builder
// ------------------------------------------------------------------
class PDFWriter {
  private objects: { id: number; content: string }[] = [];
  private nextId = 1;

  addObject(content: string): number {
    const id = this.nextId++;
    this.objects.push({ id, content: `${id} 0 obj\n${content}\nendobj\n` });
    return id;
  }

  getObject(id: number) {
    return this.objects.find(o => o.id === id);
  }

  patchObject(id: number, search: string, replace: string) {
    const obj = this.getObject(id);
    if (obj) obj.content = obj.content.replace(search, replace);
  }

  build(rootCatalogId: number, encryptDictId?: number): string {
    let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
    const offsets: number[] = [];
    for (const obj of this.objects) {
      offsets.push(pdf.length);
      pdf += obj.content;
    }
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${this.nextId}\n0000000000 65535 f \n`;
    for (const off of offsets) pdf += String(off).padStart(10, '0') + ' 00000 n \n';
    const encryptLine = encryptDictId ? `/Encrypt ${encryptDictId} 0 R\n` : '';
    pdf += `trailer\n<<\n/Size ${this.nextId}\n/Root ${rootCatalogId} 0 R\n${encryptLine}>>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF`;
    return pdf;
  }
}

// ------------------------------------------------------------------
// CREATE PDF FROM IMAGES
// ------------------------------------------------------------------
export const createPDFFromImages = async (
  imageUris: string[],
  outputName: string,
  addTimestamp: boolean = false,
  password?: string
): Promise<string> => {
  const outputDir = getExportsDir();
  const dirInfo = await FileSystem.getInfoAsync(outputDir);
  if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(outputDir, { intermediates: true });

  const outputPath = `${outputDir}${outputName}.pdf`;

  const writer = new PDFWriter();
  const pageIds: number[] = [];

  for (let i = 0; i < imageUris.length; i++) {
    const uri = imageUris[i];
    let imgId: number | null = null;
    let width = 1080, height = 1440;

    try {
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const imgBytes = decodeBase64(b64);
      const dims = await getImageDimensions(uri);
      width = dims.width;
      height = dims.height;

      const imgStream =
        `<<\n/Type /XObject\n/Subtype /Image\n/Width ${width}\n/Height ${height}\n` +
        `/ColorSpace /DeviceRGB\n/BitsPerComponent 8\n/Filter /DCTDecode\n/Length ${imgBytes.length}\n>>\n` +
        `stream\n${imgBytes}\nendstream`;
      imgId = writer.addObject(imgStream);
    } catch {
      imgId = null;
    }

    if (imgId === null) continue;

    const scale = Math.min(PAGE_W / width, PAGE_H / height, 1);
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const x = Math.round((PAGE_W - w) / 2);
    const y = Math.round((PAGE_H - h) / 2);

    let contentStr = `q ${w} 0 0 ${h} ${x} ${y} cm /Im${i} Do Q`;
    if (addTimestamp) {
      const ts = new Date().toLocaleString();
      contentStr += `\nBT /F1 8 Tf 10 10 Td (${escapePdfString(ts)}) Tj ET`;
    }

    const contentId = writer.addObject(`<<\n/Length ${contentStr.length}\n>>\nstream\n${contentStr}\nendstream`);
    const fontEntry = addTimestamp ? `/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n` : '';

    const pageId = writer.addObject(
      `<<\n/Type /Page\n` +
      `/MediaBox [0 0 ${PAGE_W} ${PAGE_H}]\n` +
      `/Resources <<\n/XObject <<\n/Im${i} ${imgId} 0 R\n>>\n${fontEntry}>>\n` +
      `/Contents ${contentId} 0 R\n>>`
    );
    pageIds.push(pageId);
  }

  if (pageIds.length === 0) throw new Error('No pages could be created from the provided images');

  const kidsRef = pageIds.map(id => `${id} 0 R`).join(' ');
  const pagesId = writer.addObject(`<<\n/Type /Pages\n/Kids [${kidsRef}]\n/Count ${pageIds.length}\n>>`);

  for (const pid of pageIds) {
    writer.patchObject(pid, '/Type /Page\n', `/Type /Page\n/Parent ${pagesId} 0 R\n`);
  }

  let encryptId: number | undefined;
  if (password) {
    encryptId = writer.addObject(`<<\n/Filter /Standard\n/V 1\n/R 2\n/O (${escapePdfString(password)})\n/U ()\n/P -4\n>>`);
  }

  const catalogId = writer.addObject(`<<\n/Type /Catalog\n/Pages ${pagesId} 0 R\n>>`);

  const pdf = writer.build(catalogId, encryptId);
  await FileSystem.writeAsStringAsync(outputPath, encodeBase64(pdf), { encoding: FileSystem.EncodingType.Base64 });

  return outputPath;
};

function escapePdfString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// ------------------------------------------------------------------
// PDF PARSER - extracts object bodies from a raw PDF byte string
// ------------------------------------------------------------------
interface ParsedPDF {
  raw: string;
  objects: Map<number, string>; // object number -> full "N 0 obj ... endobj" body (without wrapper)
  pageObjectNumbers: number[]; // in document order
}

/**
 * Parse a PDF's object table well enough to extract page objects and
 * their referenced resources (fonts, images, content streams).
 * This is a pragmatic parser - it handles the common case of PDFs
 * generated by this app and most standard linearized PDFs.
 */
function parsePDF(raw: string): ParsedPDF {
  const objects = new Map<number, string>();
  const objRegex = /(\d+)\s+0\s+obj([\s\S]*?)endobj/g;
  let match: RegExpExecArray | null;
  while ((match = objRegex.exec(raw)) !== null) {
    const num = parseInt(match[1], 10);
    objects.set(num, match[2].trim());
  }

  // Find page objects in document order by walking /Pages /Kids trees,
  // starting from /Root in the trailer.
  const pageObjectNumbers: number[] = [];
  const trailerMatch = raw.match(/\/Root\s+(\d+)\s+0\s+R/);
  if (trailerMatch) {
    const rootNum = parseInt(trailerMatch[1], 10);
    const rootObj = objects.get(rootNum);
    if (rootObj) {
      const pagesMatch = rootObj.match(/\/Pages\s+(\d+)\s+0\s+R/);
      if (pagesMatch) {
        walkPagesTree(parseInt(pagesMatch[1], 10), objects, pageObjectNumbers, new Set());
      }
    }
  }

  // Fallback: if tree-walk found nothing, just collect all objects with /Type /Page
  if (pageObjectNumbers.length === 0) {
    for (const [num, body] of objects.entries()) {
      if (/\/Type\s*\/Page(?!\w)/.test(body)) pageObjectNumbers.push(num);
    }
  }

  return { raw, objects, pageObjectNumbers };
}

function walkPagesTree(nodeNum: number, objects: Map<number, string>, out: number[], visited: Set<number>) {
  if (visited.has(nodeNum)) return;
  visited.add(nodeNum);
  const obj = objects.get(nodeNum);
  if (!obj) return;

  if (/\/Type\s*\/Pages/.test(obj)) {
    const kidsMatch = obj.match(/\/Kids\s*\[(.*?)\]/s);
    if (kidsMatch) {
      const refs = kidsMatch[1].match(/(\d+)\s+0\s+R/g) || [];
      for (const ref of refs) {
        const num = parseInt(ref, 10);
        walkPagesTree(num, objects, out, visited);
      }
    }
  } else if (/\/Type\s*\/Page(?!\w)/.test(obj)) {
    out.push(nodeNum);
  }
}

/**
 * Recursively collect all object numbers referenced (directly or
 * indirectly) by a given object body - used to pull in fonts/images
 * referenced by a page's /Resources dictionary.
 */
function collectReferences(startNums: number[], objects: Map<number, string>): Set<number> {
  const visited = new Set<number>();
  const queue = [...startNums];
  while (queue.length > 0) {
    const num = queue.shift()!;
    if (visited.has(num)) continue;
    visited.add(num);
    const body = objects.get(num);
    if (!body) continue;
    const refs = body.match(/(\d+)\s+0\s+R/g) || [];
    for (const ref of refs) {
      const refNum = parseInt(ref, 10);
      if (!visited.has(refNum)) queue.push(refNum);
    }
  }
  return visited;
}

// ------------------------------------------------------------------
// MERGE MULTIPLE PDFs - properly combines page trees
// ------------------------------------------------------------------
export const mergePDFsProper = async (fileUris: string[], outputName: string): Promise<string> => {
  const outputDir = getMergedDir();
  const dirInfo = await FileSystem.getInfoAsync(outputDir);
  if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(outputDir, { intermediates: true });
  const outputPath = `${outputDir}${outputName}.pdf`;

  if (fileUris.length === 0) throw new Error('No PDF files provided');
  if (fileUris.length === 1) {
    await FileSystem.copyAsync({ from: fileUris[0], to: outputPath });
    return outputPath;
  }

  const writer = new PDFWriter();
  const allPageIds: number[] = [];

  for (const uri of fileUris) {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) throw new Error(`File not found: ${uri}`);

    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const raw = decodeBase64(b64);
    const parsed = parsePDF(raw);

    if (parsed.pageObjectNumbers.length === 0) {
      // Could not parse this PDF's structure - skip with a warning page
      const contentStr = `BT /F1 14 Tf 50 750 Td (Could not read one of the source PDFs) Tj ET`;
      const contentId = writer.addObject(`<<\n/Length ${contentStr.length}\n>>\nstream\n${contentStr}\nendstream`);
      const pageId = writer.addObject(
        `<<\n/Type /Page\n/MediaBox [0 0 ${PAGE_W} ${PAGE_H}]\n` +
        `/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n` +
        `/Contents ${contentId} 0 R\n>>`
      );
      allPageIds.push(pageId);
      continue;
    }

    // Collect all objects referenced by this PDF's pages (resources, images, fonts, content streams)
    const referenced = collectReferences(parsed.pageObjectNumbers, parsed.objects);

    // Remap old object numbers -> new object numbers in the merged document
    const idMap = new Map<number, number>();
    for (const oldNum of referenced) {
      const body = parsed.objects.get(oldNum);
      if (body === undefined) continue;
      const newId = writer.addObject(body); // placeholder content; will rewrite refs below
      idMap.set(oldNum, newId);
    }

    // Rewrite internal references (N 0 R -> newN 0 R) within each copied object
    for (const [oldNum, newId] of idMap.entries()) {
      const obj = writer.getObject(newId);
      if (!obj) continue;
      let body = parsed.objects.get(oldNum)!;
      body = body.replace(/(\d+)\s+0\s+R/g, (m, num) => {
        const mapped = idMap.get(parseInt(num, 10));
        return mapped !== undefined ? `${mapped} 0 R` : m;
      });
      // Remove /Parent references since these pages will get a new parent
      body = body.replace(/\/Parent\s+\d+\s+0\s+R\n?/g, '');
      obj.content = `${newId} 0 obj\n${body}\nendobj\n`;
    }

    // Track new page object IDs for this source PDF, in order
    for (const oldPageNum of parsed.pageObjectNumbers) {
      const newId = idMap.get(oldPageNum);
      if (newId !== undefined) allPageIds.push(newId);
    }
  }

  if (allPageIds.length === 0) throw new Error('No pages could be extracted from the source PDFs');

  const kidsRef = allPageIds.map(id => `${id} 0 R`).join(' ');
  const pagesId = writer.addObject(`<<\n/Type /Pages\n/Kids [${kidsRef}]\n/Count ${allPageIds.length}\n>>`);

  for (const pid of allPageIds) {
    const obj = writer.getObject(pid);
    if (!obj) continue;
    if (/\/Parent\s+\d+\s+0\s+R/.test(obj.content)) {
      obj.content = obj.content.replace(/\/Parent\s+\d+\s+0\s+R/, `/Parent ${pagesId} 0 R`);
    } else {
      obj.content = obj.content.replace(/\/Type\s*\/Page/, `/Type /Page\n/Parent ${pagesId} 0 R`);
    }
  }

  const catalogId = writer.addObject(`<<\n/Type /Catalog\n/Pages ${pagesId} 0 R\n>>`);
  const pdf = writer.build(catalogId);

  await FileSystem.writeAsStringAsync(outputPath, encodeBase64(pdf), { encoding: FileSystem.EncodingType.Base64 });
  return outputPath;
};

// ------------------------------------------------------------------
// GET PDF PAGE COUNT
// ------------------------------------------------------------------
export const getPdfPageCount = async (uri: string): Promise<number> => {
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const raw = decodeBase64(b64);
    const parsed = parsePDF(raw);
    return parsed.pageObjectNumbers.length || 1;
  } catch {
    return 1;
  }
};

// ------------------------------------------------------------------
// COMPRESS PDF - recompress embedded JPEG images at lower quality
// ------------------------------------------------------------------
export interface PdfCompressionResult {
  outputUri: string;
  originalSize: number;
  compressedSize: number;
}

/**
 * Compress a PDF by extracting each embedded DCTDecode (JPEG) image
 * stream, recompressing it at the target quality via ImageManipulator,
 * and rebuilding the PDF with the smaller image streams.
 *
 * If a PDF contains no extractable images (e.g. text-only PDFs),
 * the original file is copied unchanged (text PDFs are already small).
 */
export const compressPDF = async (
  uri: string,
  quality: number,
  outputName: string
): Promise<PdfCompressionResult> => {
  const outputDir = getCompressedDir();
  const dirInfo = await FileSystem.getInfoAsync(outputDir);
  if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(outputDir, { intermediates: true });
  const outputPath = `${outputDir}${outputName}.pdf`;

  const originalInfo = await FileSystem.getInfoAsync(uri, { size: true });
  const originalSize = originalInfo.exists && 'size' in originalInfo ? (originalInfo as any).size : 0;

  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const raw = decodeBase64(b64);

  // Find all image XObject streams with /Filter /DCTDecode
  const imgObjRegex = /(\d+)\s+0\s+obj\s*(<<[^>]*?\/Subtype\s*\/Image[^>]*?\/Filter\s*\/DCTDecode[^>]*?\/Length\s+(\d+)[^>]*?>>)\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;

  let result = raw;
  let match: RegExpExecArray | null;
  let foundAny = false;
  const replacements: { fullMatch: string; replacement: string }[] = [];

  // Use exec on a copy since we'll build replacements then apply them
  const workingRaw = raw;
  while ((match = imgObjRegex.exec(workingRaw)) !== null) {
    foundAny = true;
    const objNum = match[1];
    const dictHeader = match[2];
    const declaredLength = parseInt(match[3], 10);
    const streamData = match[4];

    try {
      // Write the JPEG bytes to a temp file so ImageManipulator can read it
      const tempPath = `${FileSystem.cacheDirectory}pdf_img_${objNum}_${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(tempPath, encodeBase64(streamData), { encoding: FileSystem.EncodingType.Base64 });

      // Recompress at target quality
      const manipulated = await ImageManipulator.manipulateAsync(tempPath, [], {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      });

      const newB64 = await FileSystem.readAsStringAsync(manipulated.uri, { encoding: FileSystem.EncodingType.Base64 });
      const newBytes = decodeBase64(newB64);

      // Only use the recompressed version if it's actually smaller
      if (newBytes.length < streamData.length) {
        const newDict = dictHeader
          .replace(/\/Width\s+\d+/, `/Width ${manipulated.width}`)
          .replace(/\/Height\s+\d+/, `/Height ${manipulated.height}`)
          .replace(/\/Length\s+\d+/, `/Length ${newBytes.length}`);

        const newObj = `${objNum} 0 obj\n${newDict}\nstream\n${newBytes}\nendstream`;
        replacements.push({ fullMatch: match[0], replacement: newObj });
      }

      // Clean up temp file
      await FileSystem.deleteAsync(tempPath, { idempotent: true });
    } catch {
      // If recompression of this image fails, leave it unchanged
    }
  }

  if (!foundAny) {
    // No images found (text-only PDF) - just copy as-is
    await FileSystem.copyAsync({ from: uri, to: outputPath });
    const info = await FileSystem.getInfoAsync(outputPath, { size: true });
    const compressedSize = info.exists && 'size' in info ? (info as any).size : originalSize;
    return { outputUri: outputPath, originalSize, compressedSize };
  }

  // Apply all replacements
  for (const { fullMatch, replacement } of replacements) {
    result = result.replace(fullMatch, replacement);
  }

  // Recompute xref table since byte offsets have changed.
  // Strategy: strip everything from "xref" to end, re-derive object
  // offsets by re-scanning "N 0 obj" positions, and rebuild xref+trailer.
  const xrefIdx = result.lastIndexOf('\nxref');
  const beforeXref = xrefIdx >= 0 ? result.slice(0, xrefIdx + 1) : result;

  // Extract original trailer info for /Root and /Size
  const rootMatch = raw.match(/\/Root\s+(\d+)\s+0\s+R/);
  const sizeMatch = raw.match(/\/Size\s+(\d+)/);
  const rootId = rootMatch ? rootMatch[1] : '1';
  const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 1;

  // Find offsets of each "N 0 obj" in beforeXref
  const offsets: number[] = new Array(size).fill(0);
  const objStartRegex = /(\d+)\s+0\s+obj/g;
  let m: RegExpExecArray | null;
  while ((m = objStartRegex.exec(beforeXref)) !== null) {
    const num = parseInt(m[1], 10);
    if (num > 0 && num < size) offsets[num] = m.index;
  }

  const xrefOffset = beforeXref.length;
  let newXref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let i = 1; i < size; i++) {
    newXref += String(offsets[i] || 0).padStart(10, '0') + ' 00000 n \n';
  }
  newXref += `trailer\n<<\n/Size ${size}\n/Root ${rootId} 0 R\n>>\nstartxref\n${xrefOffset}\n%%EOF`;

  const finalPdf = beforeXref + newXref;

  await FileSystem.writeAsStringAsync(outputPath, encodeBase64(finalPdf), { encoding: FileSystem.EncodingType.Base64 });

  const compressedInfo = await FileSystem.getInfoAsync(outputPath, { size: true });
  const compressedSize = compressedInfo.exists && 'size' in compressedInfo ? (compressedInfo as any).size : originalSize;

  // Safety check: if our rewritten PDF somehow ended up larger or empty, fall back to copy
  if (compressedSize === 0 || compressedSize >= originalSize) {
    await FileSystem.copyAsync({ from: uri, to: outputPath });
    const fallbackInfo = await FileSystem.getInfoAsync(outputPath, { size: true });
    const fallbackSize = fallbackInfo.exists && 'size' in fallbackInfo ? (fallbackInfo as any).size : originalSize;
    return { outputUri: outputPath, originalSize, compressedSize: fallbackSize };
  }

  return { outputUri: outputPath, originalSize, compressedSize };
};

// ------------------------------------------------------------------
// PAGE-LEVEL EDITING - for the Merge/Edit PDF screen
// ------------------------------------------------------------------

/** A single page within a source PDF, as shown in the editor's page list */
export interface PdfPageRef {
  /** Unique key for React lists: `${sourceIndex}-${pageIndexInSource}` */
  key: string;
  /** Index into the sourceUris array passed to loadPdfPages */
  sourceIndex: number;
  /** 0-based page index within that source PDF */
  pageIndexInSource: number;
  /** Display label, e.g. "Document 1 - Page 2" */
  label: string;
  /** Current rotation override in degrees (0/90/180/270), added to original /Rotate */
  rotationOverride: number;
}

/**
 * Load all source PDFs and return a flat, ordered list of page references.
 * This powers the PDF editor's page list (one row per page, across all files).
 */
export const loadPdfPages = async (
  sourceUris: string[],
  sourceLabels: string[]
): Promise<PdfPageRef[]> => {
  const allPages: PdfPageRef[] = [];

  for (let s = 0; s < sourceUris.length; s++) {
    const count = await getPdfPageCount(sourceUris[s]);
    for (let p = 0; p < count; p++) {
      allPages.push({
        key: `${s}-${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sourceIndex: s,
        pageIndexInSource: p,
        label: `${sourceLabels[s] || `Document ${s + 1}`} — Page ${p + 1}`,
        rotationOverride: 0,
      });
    }
  }

  return allPages;
};

/**
 * Build a final PDF from an ordered list of page references, applying
 * any rotation overrides and excluding any pages the user removed.
 * This is the core of the "Merge with Editor" flow: the resulting PDF
 * contains exactly the pages in `pages`, in that order, with rotations applied.
 */
export const buildPdfFromPages = async (
  sourceUris: string[],
  pages: PdfPageRef[],
  outputName: string
): Promise<string> => {
  const outputDir = getMergedDir();
  const dirInfo = await FileSystem.getInfoAsync(outputDir);
  if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(outputDir, { intermediates: true });
  const outputPath = `${outputDir}${outputName}.pdf`;

  if (pages.length === 0) throw new Error('No pages selected for the output PDF');

  // Parse every distinct source PDF once
  const parsedBySource = new Map<number, ParsedPDF>();
  for (const idx of new Set(pages.map(p => p.sourceIndex))) {
    const b64 = await FileSystem.readAsStringAsync(sourceUris[idx], { encoding: FileSystem.EncodingType.Base64 });
    const raw = decodeBase64(b64);
    parsedBySource.set(idx, parsePDF(raw));
  }

  const writer = new PDFWriter();
  const outputPageIds: number[] = [];

  for (const pageRef of pages) {
    const parsed = parsedBySource.get(pageRef.sourceIndex);
    if (!parsed || parsed.pageObjectNumbers.length === 0) continue;

    const oldPageNum = parsed.pageObjectNumbers[pageRef.pageIndexInSource];
    if (oldPageNum === undefined) continue;

    // Collect this single page's referenced resources (images, fonts, content)
    const referenced = collectReferences([oldPageNum], parsed.objects);

    const idMap = new Map<number, number>();
    for (const oldNum of referenced) {
      const body = parsed.objects.get(oldNum);
      if (body === undefined) continue;
      const newId = writer.addObject(body);
      idMap.set(oldNum, newId);
    }

    for (const [oldNum, newId] of idMap.entries()) {
      const obj = writer.getObject(newId);
      if (!obj) continue;
      let body = parsed.objects.get(oldNum)!;
      body = body.replace(/(\d+)\s+0\s+R/g, (m, num) => {
        const mapped = idMap.get(parseInt(num, 10));
        return mapped !== undefined ? `${mapped} 0 R` : m;
      });
      body = body.replace(/\/Parent\s+\d+\s+0\s+R\n?/g, '');
      obj.content = `${newId} 0 obj\n${body}\nendobj\n`;
    }

    const newPageId = idMap.get(oldPageNum);
    if (newPageId === undefined) continue;

    // Apply rotation override: combine with any existing /Rotate value
    if (pageRef.rotationOverride !== 0) {
      const obj = writer.getObject(newPageId);
      if (obj) {
        const existingRotateMatch = obj.content.match(/\/Rotate\s+(-?\d+)/);
        const existingRotate = existingRotateMatch ? parseInt(existingRotateMatch[1], 10) : 0;
        const newRotate = ((existingRotate + pageRef.rotationOverride) % 360 + 360) % 360;
        if (existingRotateMatch) {
          obj.content = obj.content.replace(/\/Rotate\s+-?\d+/, `/Rotate ${newRotate}`);
        } else {
          obj.content = obj.content.replace(/\/Type\s*\/Page/, `/Type /Page\n/Rotate ${newRotate}`);
        }
      }
    }

    outputPageIds.push(newPageId);
  }

  if (outputPageIds.length === 0) throw new Error('No valid pages to write');

  const kidsRef = outputPageIds.map(id => `${id} 0 R`).join(' ');
  const pagesId = writer.addObject(`<<\n/Type /Pages\n/Kids [${kidsRef}]\n/Count ${outputPageIds.length}\n>>`);

  for (const pid of outputPageIds) {
    const obj = writer.getObject(pid);
    if (!obj) continue;
    if (/\/Parent\s+\d+\s+0\s+R/.test(obj.content)) {
      obj.content = obj.content.replace(/\/Parent\s+\d+\s+0\s+R/, `/Parent ${pagesId} 0 R`);
    } else {
      obj.content = obj.content.replace(/\/Type\s*\/Page/, `/Type /Page\n/Parent ${pagesId} 0 R`);
    }
  }

  const catalogId = writer.addObject(`<<\n/Type /Catalog\n/Pages ${pagesId} 0 R\n>>`);
  const pdf = writer.build(catalogId);

  await FileSystem.writeAsStringAsync(outputPath, encodeBase64(pdf), { encoding: FileSystem.EncodingType.Base64 });
  return outputPath;
};
