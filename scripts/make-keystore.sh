#!/usr/bin/env bash
# Generates a release keystore for signing the APK, then prints the base64 to paste into the
# GitHub secret KEYSTORE_BASE64. Keep the .keystore file and passwords safe: losing them means
# users must uninstall before installing a future version.
set -e
keytool -genkeypair -v -keystore smartgpa-release.keystore -alias smartgpa \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Atmata Group, O=Atmata Group, C=SY"
echo
echo "=== KEYSTORE_BASE64 (copy everything below into the GitHub secret) ==="
base64 -w0 smartgpa-release.keystore 2>/dev/null || base64 smartgpa-release.keystore
echo
