#!/usr/bin/env bash
# Builds NeonDrift.apk end to end: bundles the web game, packages it into the
# native Android shell, dexes, aligns and signs. Run from anywhere.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
GAME_DIR="$ROOT/game"
BUILD_DIR="$ANDROID_DIR/build"
ANDROID_JAR="/usr/lib/android-sdk/platforms/android-23/android.jar"
KEYSTORE="$BUILD_DIR/neondrift.keystore"
KS_PASS="neondrift123"
SMALI_CP_FILE="$ANDROID_DIR/.smali_classpath"

mkdir -p "$BUILD_DIR" "$ANDROID_DIR/assets/www"

echo "==> 1/6 Bundling web game (esbuild)"
( cd "$GAME_DIR" && npx --yes esbuild@0.20.0 src/main.js --bundle --minify --format=iife --outfile=dist/game.js )
cp "$GAME_DIR/dist/index.html" "$GAME_DIR/dist/game.js" "$ANDROID_DIR/assets/www/"

echo "==> 2/6 Resolving smali assembler classpath (Maven Central, cached after first run)"
if [ ! -f "$SMALI_CP_FILE" ]; then
  TMP_POM="$(mktemp -d)"
  cat > "$TMP_POM/pom.xml" <<'EOF'
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>tmp</groupId><artifactId>smalideps</artifactId><version>1.0</version>
  <dependencies>
    <dependency><groupId>org.smali</groupId><artifactId>smali</artifactId><version>2.5.2</version></dependency>
  </dependencies>
</project>
EOF
  ( cd "$TMP_POM" && mvn -q dependency:build-classpath -Dmdep.outputFile=cp.txt )
  cp "$TMP_POM/cp.txt" "$SMALI_CP_FILE"
fi
SMALI_CP="$(cat "$SMALI_CP_FILE")"

echo "==> 3/6 Assembling classes.dex from smali source"
java -cp "$SMALI_CP" org.jf.smali.Main assemble -o "$BUILD_DIR/classes.dex" "$ANDROID_DIR/smali_src"

echo "==> 4/6 Packaging resources + manifest + assets (aapt)"
aapt package -f -M "$ANDROID_DIR/AndroidManifest.xml" -S "$ANDROID_DIR/res" -A "$ANDROID_DIR/assets" \
  -I "$ANDROID_JAR" -F "$BUILD_DIR/app-unsigned.apk"
cp "$BUILD_DIR/app-unsigned.apk" "$BUILD_DIR/app-with-dex.apk"
( cd "$BUILD_DIR" && zip -q -j app-with-dex.apk classes.dex )

echo "==> 5/6 Aligning"
zipalign -f -p 4 "$BUILD_DIR/app-with-dex.apk" "$BUILD_DIR/app-aligned.apk"

echo "==> 6/6 Signing"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -v -keystore "$KEYSTORE" -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -alias neondrift -keyalg RSA -keysize 2048 -validity 20000 \
    -dname "CN=Neon Drift, OU=Games, O=Orhan, L=Istanbul, S=Istanbul, C=TR"
fi
apksigner sign --ks "$KEYSTORE" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --ks-key-alias neondrift --v1-signing-enabled true --v2-signing-enabled true \
  --out "$BUILD_DIR/NeonDrift.apk" "$BUILD_DIR/app-aligned.apk"

apksigner verify "$BUILD_DIR/NeonDrift.apk" >/dev/null
echo "==> Done: $BUILD_DIR/NeonDrift.apk"
