---
description: Build and export a new Android APK
---

To update the APK with your latest code changes, run the following steps in order:

1. Build the web project to generate the production files:
```bash
npm run build
```

2. Sync the web build files to the Android project:
```bash
npx cap sync android
```

3. Build the APK using Gradle:
```bash
cd android && ./gradlew assembleDebug
```

The new APK will be located at:
`android/app/build/outputs/apk/debug/app-debug.apk`

The `/download` route in the game server is already configured to serve this file.
