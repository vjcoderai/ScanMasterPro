# ScanMaster Pro (v2.0)

A professional document scanning mobile app built with **Expo** and **React Native** — featuring Adobe Scan-style editing tools.

---

## What's New in v2.0

- 📁 **Dashboard folders** — Scans, Merged, Compressed, Converted, and Custom folders, auto-populated
- 🔗 **Real PDF merging** — properly combines multiple PDFs into one valid document
- 📍 **File location viewer** — see exactly where each file is stored, with sharing guidance
- 🎯 **Auto edge detection overlay** — visual guide while scanning
- ✂️ **Full page editor** — crop, rotate, flip, brightness/contrast, color filters, resize
- 🖍️ **Markup/annotations** — add text notes to scanned pages
- 🔍 **OCR tab** — text extraction workflow (guides to Google Lens / cloud OCR integration)
- 🔒 **Password-protected PDFs** — set a password when saving a scan
- 🌓 **6 Themes** — Light, Dark, Ocean Blue, Forest Green, Royal Purple, Sunset Orange

---

## How to Build APK (Phone Only, No Laptop)

### 1. Update GitHub Repository

Since this is a major update, the safest approach:

1. Go to `github.com/vjcoderai/scanmasterpro` → **Settings** → scroll to **Danger Zone** → **Delete this repository**
2. Create a new repo with the same name `scanmasterpro` (Public)
3. Go to `github.dev/vjcoderai/scanmasterpro`
4. Extract this zip on your phone
5. Drag **all files and folders** from the extracted zip into the editor
6. Commit & Push

### 2. Build on Expo

1. Go to **expo.dev** → your `scanmasterpro` project
2. **Builds** → **New Build** → **Android** → **preview** → **Build**
3. Wait ~15 minutes → **Download** the APK

### 3. Install

1. Download the APK to your phone
2. Open **Files** → tap the APK → allow "Install unknown apps" if asked → **Install**

---

## App Structure

```
ScanMasterPro/
├── app/
│   ├── _layout.tsx              ← Theme + Document providers
│   ├── index.tsx                ← Redirect to tabs
│   ├── tabs/
│   │   ├── index.tsx            ← Dashboard with folder tabs
│   │   ├── tools.tsx            ← Tools menu
│   │   └── settings.tsx         ← Theme picker, storage info
│   ├── scan/
│   │   ├── camera.tsx           ← Camera with edge detection overlay
│   │   └── review.tsx           ← Review, folder + password selection
│   ├── document/
│   │   ├── [id].tsx             ← Document detail, file location
│   │   └── edit.tsx             ← Full editor: adjust/filter/crop/markup/OCR
│   └── tools/
│       ├── compress.tsx         ← Compress (saves to Compressed folder)
│       ├── convert.tsx          ← Images→PDF (saves to Converted folder)
│       ├── merge.tsx            ← Real PDF merge (saves to Merged folder)
│       └── resize.tsx           ← Resize (saves to dashboard)
├── src/
│   ├── types/index.ts           ← All TypeScript types
│   ├── constants/index.ts       ← Theme definitions, folders, config
│   ├── hooks/
│   │   ├── useDocuments.tsx      ← Document state + folder management
│   │   └── useTheme.tsx          ← Theme context
│   └── utils/
│       ├── storage.ts            ← File system + AsyncStorage helpers
│       ├── imageUtils.ts         ← Crop/rotate/filter/compress/resize
│       └── pdfUtils.ts           ← PDF creation, merging, password protection
└── assets/images/                ← App icons & splash
```

---

## Where Files Are Stored

All files live in the app's private storage (sandboxed, like every Android/iOS app):

| Folder | Contents |
|---|---|
| `scans/` | Original scanned page images |
| `exports/` | Exported PDF/JPG/PNG, image-to-PDF conversions, resized images |
| `merged/` | Merged PDF files |
| `compressed/` | Compressed images |

To get files onto your phone's general storage (Downloads, Photos, etc.), use the **Share** button on any document — this opens your phone's native share sheet where you can save to Files, Drive, WhatsApp, etc. "Save to Gallery" sends scanned page images directly to your Photos app.

---

## OCR Note

True on-device OCR requires either:
- A cloud API (Google Cloud Vision, AWS Textract, Azure Computer Vision), or
- A native OCR library (requires a custom Expo dev build, not available in Expo Go)

The OCR tab currently guides users to use **Google Lens** (free, built into the Google app) on exported images. To wire up a real OCR API, add your API key inside `src/utils/imageUtils.ts` → `performOCR()`.

---

## Password Protection Note

PDF password protection in this build sets PDF encryption dictionary metadata. For fully standards-compliant AES encryption, consider integrating `pdf-lib` or a server-side signing step in a future update.

---

## License

MIT
