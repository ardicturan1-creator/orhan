#!/usr/bin/env bash
# Google Play için imzalı release AAB üretir.
#
# Gerekli ortam değişkenleri (bkz. signing.env.example):
#   BYMEL_KEYSTORE_FILE, BYMEL_KEYSTORE_PASSWORD, BYMEL_KEY_ALIAS, BYMEL_KEY_PASSWORD
# Gerekli Gradle özelliği (gradle.properties veya -P ile):
#   BYMEL_SIGNING_CERT_SHA256  (Play App Signing sertifikasının 64 haneli SHA-256'sı)
set -euo pipefail

cd "$(dirname "$0")"

missing=()
for var in BYMEL_KEYSTORE_FILE BYMEL_KEYSTORE_PASSWORD BYMEL_KEY_ALIAS BYMEL_KEY_PASSWORD; do
  [ -n "${!var:-}" ] || missing+=("$var")
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "Eksik imza ortam değişkenleri: ${missing[*]}" >&2
  echo "Bunlar ayarlanmazsa Gradle imzasız AAB üretir ve Play Console dosyayı reddeder." >&2
  exit 1
fi

if [ ! -f "$BYMEL_KEYSTORE_FILE" ]; then
  echo "Keystore bulunamadı: $BYMEL_KEYSTORE_FILE" >&2
  exit 1
fi

./gradlew --no-daemon clean bundleRelease "$@"

aab="app/build/outputs/bundle/release/app-release.aab"
if [ ! -f "$aab" ]; then
  echo "AAB üretilemedi." >&2
  exit 1
fi

echo
echo "AAB hazır: $(cd "$(dirname "$aab")" && pwd)/$(basename "$aab")"
