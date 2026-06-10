# ScanMaster Pro

A professional document scanning mobile app built with **Expo** and **React Native**.

---

## How to Build APK Using Only Your Phone (No Laptop Needed)

You only need:
- A **phone or tablet** with a browser
- A free **GitHub** account → https://github.com
- A free **Expo** account → https://expo.dev

---

### STEP 1 — Create a GitHub Account (if you don't have one)

1. Open your phone browser and go to **https://github.com**
2. Tap **Sign up** → enter email, password, username
3. Verify your email

---

### STEP 2 — Upload the Project to GitHub

1. Go to **https://github.com** → tap the **+** icon → **New repository**
2. Name it: `scanmasterpro`
3. Set it to **Public**
4. Tap **Create repository**
5. On the next page, tap **uploading an existing file**
6. **Unzip** the `ScanMasterPro.zip` file on your phone first:
   - On iPhone: tap the zip → iOS will unzip it automatically
   - On Android: use Files app or any file manager to extract
7. Upload ALL the files and folders from inside the unzipped folder
   - You must upload folders one at a time on GitHub mobile:
     - First upload files in the **root** (package.json, app.json, etc.)
     - Then create folders by typing `app/` before the filename when uploading
   - **EASIER METHOD**: Use GitHub Desktop web editor:
     - After creating the repo, press the `.` key on a keyboard (or go to `github.dev/YOUR_USERNAME/scanmasterpro`)
     - This opens a VS Code editor in the browser
     - Drag and drop the entire unzipped folder contents here
8. Tap **Commit changes** with message: `Initial commit`

---

### STEP 3 — Create an Expo Account

1. Go to **https://expo.dev**
2. Tap **Sign up** → create a free account
3. Verify your email

---

### STEP 4 — Link GitHub to Expo

1. Go to **https://expo.dev** → log in
2. Tap your profile → **Settings** → **Connections**
3. Connect your **GitHub** account

---

### STEP 5 — Create the Project on Expo

1. Go to **https://expo.dev** → tap **+ New Project**
2. Select **Import from GitHub**
3. Choose your `scanmasterpro` repository
4. Expo will detect it as an Expo project automatically
5. Tap **Create Project**

---

### STEP 6 — Build the APK

1. Inside your project on **expo.dev**, tap **Builds** in the left menu
2. Tap **New Build**
3. Select platform: **Android**
4. Select profile: **preview** (this builds an APK file)
5. Tap **Build**
6. Wait 10–20 minutes — Expo builds it in the cloud for free
7. When done, tap **Download** to get your `.apk` file

---

### STEP 7 — Install APK on Your Android Phone

1. Download the APK to your Android phone
2. Open your **Files** app → find the downloaded APK
3. Tap it → if prompted, allow "Install from unknown sources"
4. Tap **Install**
5. Open **ScanMaster Pro** — done!

---

## App Features

- 📷 Camera scanning with document edge guide frame
- 📄 Multi-page scanning — combine pages into one document
- 🎨 Color / Grayscale / Black & White modes
- 💾 Save as PDF, JPG, or PNG
- ✂️ Per-page editing — rotate, aspect ratio, color mode
- 📐 Preset ratios — A4, Letter, 1:1, 4:3, 16:9, ID Card
- 🗜️ File compression tool
- 🔄 Convert images to PDF
- 📎 Merge multiple PDFs
- 📏 Resize images with custom or preset dimensions
- 🕐 Optional date/time stamp on exports
- 📱 Share with WhatsApp, Email, Drive, and any other app
- 💾 All data stored locally on your phone — no internet needed

---

## Project Structure

```
ScanMasterPro/
├── app/                     ← All screens (Expo Router)
│   ├── _layout.tsx          ← App root + providers
│   ├── index.tsx            ← Entry redirect
│   ├── tabs/                ← Bottom tab screens
│   │   ├── index.tsx        ← Documents dashboard
│   │   ├── tools.tsx        ← Tools menu
│   │   └── settings.tsx     ← Settings
│   ├── scan/
│   │   ├── camera.tsx       ← Camera capture
│   │   └── review.tsx       ← Review & save
│   ├── document/
│   │   ├── [id].tsx         ← Document viewer/exporter
│   │   └── edit.tsx         ← Page editor
│   └── tools/
│       ├── compress.tsx     ← Compress files
│       ├── convert.tsx      ← Images to PDF
│       ├── merge.tsx        ← Merge PDFs
│       └── resize.tsx       ← Resize images
├── src/
│   ├── types/               ← TypeScript types
│   ├── constants/           ← Colors, spacing, config
│   ├── hooks/               ← useDocuments state manager
│   └── utils/               ← Storage + image processing
├── assets/images/           ← Icons and splash screen
├── app.json                 ← Expo config
├── eas.json                 ← Build config (APK output)
└── package.json             ← Dependencies
```

---

## Troubleshooting

**Build fails on Expo?**
- Make sure all files were uploaded to GitHub correctly
- Check that `package.json` and `app.json` are in the root of the repo (not inside a subfolder)

**APK won't install?**
- Go to phone Settings → Security → enable "Install from unknown sources" or "Install unknown apps"

**Camera not working?**
- Make sure you granted camera permission when the app first asked
- If you denied it, go to phone Settings → Apps → ScanMaster Pro → Permissions → enable Camera

