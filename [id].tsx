{
  "expo": {
    "name": "Scan Master Pro",
    "slug": "scanmasterpro",
    "owner": "vj_coder",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "scanmasterpro",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": false,
    "extra": {
      "eas": {
        "projectId": "e2d9c2c9-7615-40f4-afcf-f1b5a15f0071"
      }
    },
    "splash": {
      "image": "./assets/images/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#105C69"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.scanmasterpro.app",
      "infoPlist": {
        "NSCameraUsageDescription": "ScanMaster Pro needs camera access to scan documents.",
        "NSPhotoLibraryUsageDescription": "ScanMaster Pro needs photo library access to import and save documents.",
        "NSPhotoLibraryAddUsageDescription": "ScanMaster Pro needs permission to save scanned documents to your photo library.",
        "NSMicrophoneUsageDescription": "Required by the camera for video functionality."
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#105C69"
      },
      "package": "com.scanmasterpro.app",
      "versionCode": 1,
      "permissions": [
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO"
      ]
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-camera",
        {
          "cameraPermission": "Allow ScanMaster Pro to access your camera to scan documents."
        }
      ],
      [
        "expo-media-library",
        {
          "photosPermission": "Allow ScanMaster Pro to access your photos.",
          "savePhotosPermission": "Allow ScanMaster Pro to save photos.",
          "isAccessMediaLocationEnabled": true
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow ScanMaster Pro to access your photos to import documents."
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
