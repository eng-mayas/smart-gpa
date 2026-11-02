#!/usr/bin/env bash
# Local APK build (requires Android Studio / SDK + JDK 17+ installed).
set -e
npm install
npm install @capacitor/core @capacitor/android @capacitor/splash-screen @capacitor/status-bar
npm install -D @capacitor/cli
npm run build
[ -d android ] || npx cap add android
npx cap sync android
cd android && chmod +x gradlew && ./gradlew assembleDebug
echo "APK: android/app/build/outputs/apk/debug/app-debug.apk"
