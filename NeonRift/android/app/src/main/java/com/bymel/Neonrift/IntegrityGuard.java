package com.bymel.Neonrift;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import android.os.Debug;

import java.io.BufferedInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;

final class IntegrityGuard {
    private static final String EXPECTED_PACKAGE = "com.bymel.Neonrift";
    private static final String[] CRITICAL_ASSETS = {
            "css/game.css",
            "index.html",
            "js/audio.js",
            "js/billing.js",
            "js/config.js",
            "js/core.js",
            "js/game.js",
            "vendor/three.min.js"
    };

    static final class Result {
        final boolean valid;
        final String code;
        final String signingSha256;
        final String assetSha256;

        Result(boolean valid, String code, String signingSha256, String assetSha256) {
            this.valid = valid;
            this.code = code;
            this.signingSha256 = signingSha256 == null ? "" : signingSha256;
            this.assetSha256 = assetSha256 == null ? "" : assetSha256;
        }
    }

    private IntegrityGuard() { }

    static Result assess(Context context) {
        try {
            if (!EXPECTED_PACKAGE.equals(context.getPackageName())) {
                return new Result(false, "PACKAGE_MISMATCH", "", "");
            }

            String assets = digestCriticalAssets(context);
            if (!constantTimeEquals(normalize(BuildConfig.GAME_ASSET_SHA256), normalize(assets))) {
                return new Result(false, "ASSET_TAMPERED", "", assets);
            }

            String signing = signingCertificateSha256(context);
            if (BuildConfig.DEBUG) {
                return new Result(true, "DEBUG_OK", signing, assets);
            }

            ApplicationInfo appInfo = context.getApplicationInfo();
            if ((appInfo.flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0 || Debug.isDebuggerConnected() || Debug.waitingForDebugger()) {
                return new Result(false, "DEBUGGER_DETECTED", signing, assets);
            }

            String expected = normalize(BuildConfig.EXPECTED_SIGNING_CERT_SHA256);
            if (expected.length() != 64) {
                return new Result(false, "SIGNATURE_PIN_MISSING", signing, assets);
            }
            if (!constantTimeEquals(expected, normalize(signing))) {
                return new Result(false, "SIGNATURE_MISMATCH", signing, assets);
            }

            if (BuildConfig.REQUIRE_PLAY_INSTALLER && !isInstalledByPlay(context)) {
                return new Result(false, "UNTRUSTED_INSTALLER", signing, assets);
            }
            return new Result(true, "OK", signing, assets);
        } catch (Exception error) {
            return new Result(false, "INTEGRITY_ERROR", "", "");
        }
    }

    private static String digestCriticalAssets(Context context) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] buffer = new byte[16384];
        for (String assetPath : CRITICAL_ASSETS) {
            digest.update(assetPath.getBytes(StandardCharsets.UTF_8));
            digest.update((byte) 0);
            try (InputStream raw = context.getAssets().open(assetPath);
                 BufferedInputStream input = new BufferedInputStream(raw)) {
                int read;
                while ((read = input.read(buffer)) != -1) digest.update(buffer, 0, read);
            }
        }
        return toHex(digest.digest());
    }

    @SuppressWarnings("deprecation")
    private static String signingCertificateSha256(Context context) throws Exception {
        PackageManager manager = context.getPackageManager();
        PackageInfo info;
        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            info = manager.getPackageInfo(context.getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
            if (info.signingInfo == null) return "";
            // APK üzerinde etkin olan güncel imzayı doğrula; sertifika rotasyonundaki eski geçmişi sabitleme için kullanma.
            signatures = info.signingInfo.getApkContentsSigners();
        } else {
            info = manager.getPackageInfo(context.getPackageName(), PackageManager.GET_SIGNATURES);
            signatures = info.signatures;
        }
        if (signatures == null || signatures.length == 0) return "";
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return toHex(digest.digest(signatures[0].toByteArray()));
    }

    @SuppressWarnings("deprecation")
    private static boolean isInstalledByPlay(Context context) {
        try {
            String installer;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                installer = context.getPackageManager().getInstallSourceInfo(context.getPackageName()).getInstallingPackageName();
            } else {
                installer = context.getPackageManager().getInstallerPackageName(context.getPackageName());
            }
            return "com.android.vending".equals(installer);
        } catch (Exception ignored) {
            return false;
        }
    }

    private static String normalize(String value) {
        return value == null ? "" : value.replaceAll("[^A-Fa-f0-9]", "").toUpperCase(Locale.US);
    }

    private static boolean constantTimeEquals(String first, String second) {
        return MessageDigest.isEqual(first.getBytes(StandardCharsets.US_ASCII), second.getBytes(StandardCharsets.US_ASCII));
    }

    private static String toHex(byte[] value) {
        StringBuilder result = new StringBuilder(value.length * 2);
        for (byte item : value) result.append(String.format(Locale.US, "%02X", item));
        return result.toString();
    }
}
