# Scan Master Pro (v2.1)

A professional document scanning mobile app built with **Expo** and **React Native** — Adobe Scan / CamScanner-style editing, OCR, theming, and real PDF tools.

---

## What's Fixed / New in v2.1

### Fixed Issues
1. **Logo & Theme Consistency** — App icon, splash screen, and the default
   "Scan Master Pro" theme now all use the same teal palette derived from
   the logo (`#0D7377` / `#39E6CC` / `#0A4D50`).
2. **Camera Edge Detection** — The camera now shows an animated,
   pulsing edge-detection guide (corner markers, scan line, glow border)
   and an **Edge Detect** toggle that auto-crops captured photos to trim
   camera framing margins.
3. **PDF Compression** — New "PDF Document" mode in the Compress tool.
   Recompresses embedded images inside a PDF and shows before/after size
   and percentage reduction.
4. **PDF Merge** — Completely rebuilt with a real PDF parser/rebuilder
   that properly combines page objects from multiple source PDFs into a
   single valid, openable PDF.
5. **Merge Flow + Built-in PDF Editor** — Merge now has 3 steps:
   - **Select files** (from device or your saved documents), reorder/remove
   - **Edit pages** — every page from every selected PDF is listed; reorder,
     rotate (90° increments), or delete individual pages
   - **Result** — merged PDF is saved to your Merged folder, with Share
6. **Share Error Fixed** — Sharing no longer requires a prior export.
   If no export exists yet, the app automatically builds one (PDF for
   multi-page docs, the image directly for single-page) and shares it.

### New Features
1. **Advanced Page Editor** (7 tabs):
   - **Adjust** — 90°/180° rotate, horizontal flip, free-angle rotate
     (slider, any degree), brightness & contrast sliders
   - **Filter** — Original, Auto Color, Grayscale, Black & White
   - **Crop** — Auto-crop (trims framing margins) + aspect-ratio presets
     (A4, Letter, 1:1, 4:3, 16:9, 3:2, ID Card)
   - **Clean Up** — Noise reduction + sharpness enhancement pass
   - **Markup** — Draw, highlighter, arrows, and text annotations directly
     on the page, then "Apply Markup" flattens it into the image
   - **Resize** — Presets (A4, Letter, 1080p, HD, Small) + custom width/height
   - **OCR** — Extract text via OCR.space API, view result, copy all (or
     select/copy portions) to clipboard
2. **Theme System**:
   - **Dark Mode** — auto (follows device) or manual toggle, saved via AsyncStorage
   - **5 Accent Colors** — Default Teal (matches logo), Ocean Blue, Forest
     Green, Royal Purple, Ruby Red — applied consistently across dashboard,
     editor, camera, and settings

---

## OCR Setup Note

OCR uses the free [OCR.space](https://ocr.space/ocrapi) API with the public
`helloworld` demo key (rate-limited, fine for testing). For production,
get a free key at https://ocr.space/ocrapi/freekey and replace
`OCR_API_KEY` in `src/utils/imageUtils.ts`. No other changes needed.
OCR requires an internet connection.

---

## How to Build APK (Phone Only, No Laptop)

1. **GitHub**: Go to `github.dev/vjcoderai/scanmasterpro`, delete old files,
   drag in everything from this zip, commit & push.
2. **Expo**: go to expo.dev → your `scanmasterpro` project → Builds →
   New Build → Android → **preview** → Build.
3. Wait ~15 minutes → Download the APK.
4. Install on your phone (allow "Install unknown apps" if prompted).

`app.json` already contains the correct `owner` and `projectId` for this
project, and `eas.json` is configured to output an installable `.apk`.

---

## Project Structure

```
ScanMasterPro/
├── app/
│   ├── _layout.tsx              ← Theme + Document providers, StatusBar
│   ├── index.tsx                ← Redirect to tabs
│   ├── tabs/
│   │   ├── index.tsx            ← Dashboard, folder tabs, auto-export share
│   │   ├── tools.tsx            ← Tools menu
│   │   └── settings.tsx         ← Dark mode, accent themes, storage info
│   ├── scan/
│   │   ├── camera.tsx           ← Animated edge-detection camera + auto-crop
│   │   └── review.tsx           ← Review, folder + password selection
│   ├── document/
│   │   ├── [id].tsx             ← Document detail, auto-export share
│   │   └── edit.tsx             ← 7-tab editor (adjust/filter/crop/cleanup/markup/resize/ocr)
│   └── tools/
│       ├── compress.tsx         ← Image OR PDF compression
│       ├── convert.tsx          ← Images→PDF
│       ├── merge.tsx            ← 3-step merge with built-in page editor
│       └── resize.tsx           ← Standalone image resize tool
├── src/
│   ├── types/index.ts
│   ├── constants/index.ts       ← 6 themes (light/dark/blue/green/purple/red)
│   ├── components/
│   │   └── MarkupCanvas.tsx     ← Draw/highlight/arrow/text annotation layer
│   ├── hooks/
│   │   ├── useDocuments.tsx
│   │   └── useTheme.tsx         ← Dark mode (auto/manual) + accent theme
│   └── utils/
│       ├── storage.ts
│       ├── imageUtils.ts        ← Crop/rotate/filter/cleanup/resize/OCR
│       ├── edgeDetection.ts     ← Auto-crop / document edge detection
│       └── pdfUtils.ts          ← PDF builder, parser, merge, compress, page editor
└── assets/images/                ← App icons & splash (logo-matched)
```

---

## Where Files Are Stored

| Folder | Contents |
|---|---|
| `scans/` | Original scanned page images |
| `exports/` | Exported PDF/JPG/PNG, conversions, resized images |
| `merged/` | Merged PDF files |
| `compressed/` | Compressed images & PDFs |

Use the **Share** button on any document to send it to Files, Drive,
WhatsApp, etc. "Save to Gallery" sends page images to your Photos app.

---

## Verified Build

This project was verified with:
- `npx tsc --noEmit` → **0 errors**
- `npx expo export --platform web` → **all 14 routes bundled successfully**

---

## License

MIT
