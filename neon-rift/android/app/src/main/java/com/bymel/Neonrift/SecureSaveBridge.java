package com.bymel.Neonrift;

import android.annotation.TargetApi;
import android.content.Context;
import android.os.Build;
import android.provider.Settings;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.SecureRandom;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

final class SecureSaveBridge {
    private static final String FILE_NAME = "neonrift_secure_save_v2.dat";
    private static final String KEY_ALIAS = "bymel_neonrift_save_aes_v2";
    private static final int MAX_SAVE_BYTES = 1024 * 1024;
    private static final byte[] FALLBACK_SALT = new byte[] { 0x42, 0x59, 0x4D, 0x45, 0x4C, 0x2D, 0x4E, 0x52, 0x2D, 0x53, 0x41, 0x56, 0x45, 0x2D, 0x32 };

    private final Context context;
    private final File saveFile;
    private final IntegrityGuard.Result integrity;
    private final String storageLabel;

    SecureSaveBridge(Context context, IntegrityGuard.Result integrity) {
        this.context = context.getApplicationContext();
        this.integrity = integrity;
        File externalRoot = context.getExternalFilesDir("NeonRift");
        File root = externalRoot != null ? externalRoot : context.getNoBackupFilesDir();
        if (!root.exists()) root.mkdirs();
        this.saveFile = new File(root, FILE_NAME);
        this.storageLabel = externalRoot != null
                ? "Android/data/" + context.getPackageName() + "/files/NeonRift/" + FILE_NAME
                : "internal/no_backup/" + FILE_NAME;
    }

    @JavascriptInterface
    public synchronized String read() {
        try {
            if (!saveFile.isFile()) return response(false, "NOT_FOUND", null).toString();
            byte[] raw = readAll(saveFile);
            if (raw.length <= 0 || raw.length > MAX_SAVE_BYTES * 2) return response(false, "INVALID_SIZE", null).toString();
            JSONObject envelope = new JSONObject(new String(raw, StandardCharsets.UTF_8));
            String mode = envelope.optString("mode", "");
            String data;
            if ("AES_GCM".equals(mode) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                data = Api23.decrypt(envelope);
            } else if ("SIGNED".equals(mode)) {
                data = verifySigned(envelope);
            } else {
                return response(false, "UNKNOWN_FORMAT", null).toString();
            }
            validateJson(data);
            return response(true, "OK", data).toString();
        } catch (Exception error) {
            quarantineCorruptSave();
            return response(false, "CORRUPT_OR_TAMPERED", null).toString();
        }
    }

    @JavascriptInterface
    public synchronized String write(String json) {
        try {
            if (!integrity.valid && !BuildConfig.DEBUG) return response(false, "INTEGRITY_BLOCK", null).toString();
            validateJson(json);
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            if (bytes.length > MAX_SAVE_BYTES) return response(false, "TOO_LARGE", null).toString();
            JSONObject envelope = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                    ? Api23.encrypt(bytes)
                    : signFallback(bytes);
            atomicWrite(envelope.toString().getBytes(StandardCharsets.UTF_8));
            return response(true, "SAVED", null).toString();
        } catch (Exception error) {
            return response(false, "WRITE_FAILED", null).toString();
        }
    }

    @JavascriptInterface
    public synchronized String clear() {
        boolean deleted = !saveFile.exists() || saveFile.delete();
        return response(deleted, deleted ? "CLEARED" : "CLEAR_FAILED", null).toString();
    }

    @JavascriptInterface
    public String status() {
        try {
            JSONObject json = response(integrity.valid || BuildConfig.DEBUG, integrity.code, null);
            json.put("packageName", context.getPackageName());
            json.put("storage", storageLabel);
            json.put("encrypted", Build.VERSION.SDK_INT >= Build.VERSION_CODES.M);
            json.put("assetVerified", !integrity.assetSha256.isEmpty());
            json.put("signaturePinned", BuildConfig.EXPECTED_SIGNING_CERT_SHA256.length() == 64);
            return json.toString();
        } catch (Exception error) {
            return "{\"ok\":false,\"code\":\"STATUS_ERROR\"}";
        }
    }

    private JSONObject signFallback(byte[] data) throws Exception {
        JSONObject envelope = new JSONObject();
        String payload = Base64.encodeToString(data, Base64.NO_WRAP);
        envelope.put("v", 2);
        envelope.put("mode", "SIGNED");
        envelope.put("payload", payload);
        envelope.put("mac", Base64.encodeToString(hmac(payload.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP));
        return envelope;
    }

    private String verifySigned(JSONObject envelope) throws Exception {
        String payload = envelope.getString("payload");
        byte[] expected = Base64.decode(envelope.getString("mac"), Base64.NO_WRAP);
        byte[] actual = hmac(payload.getBytes(StandardCharsets.UTF_8));
        if (!MessageDigest.isEqual(expected, actual)) throw new SecurityException("Save MAC mismatch");
        byte[] decoded = Base64.decode(payload, Base64.NO_WRAP);
        return new String(decoded, StandardCharsets.UTF_8);
    }

    private byte[] hmac(byte[] data) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        digest.update(context.getPackageName().getBytes(StandardCharsets.UTF_8));
        digest.update(integrity.signingSha256.getBytes(StandardCharsets.US_ASCII));
        String androidId = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID);
        if (androidId != null) digest.update(androidId.getBytes(StandardCharsets.UTF_8));
        digest.update(FALLBACK_SALT);
        SecretKeySpec key = new SecretKeySpec(digest.digest(), "HmacSHA256");
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(key);
        return mac.doFinal(data);
    }

    private void validateJson(String json) throws Exception {
        if (json == null) throw new IllegalArgumentException("Missing save");
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        if (bytes.length == 0 || bytes.length > MAX_SAVE_BYTES) throw new IllegalArgumentException("Invalid save size");
        new JSONObject(json);
    }

    private void atomicWrite(byte[] data) throws Exception {
        File temp = new File(saveFile.getParentFile(), FILE_NAME + ".tmp");
        try (FileOutputStream output = new FileOutputStream(temp, false)) {
            output.write(data);
            output.flush();
            output.getFD().sync();
        }
        if (saveFile.exists() && !saveFile.delete()) throw new IllegalStateException("Old save cannot be replaced");
        if (!temp.renameTo(saveFile)) throw new IllegalStateException("Atomic rename failed");
    }

    private byte[] readAll(File file) throws Exception {
        long length = file.length();
        if (length < 0 || length > Integer.MAX_VALUE) throw new IllegalArgumentException("Invalid file size");
        byte[] data = new byte[(int) length];
        try (FileInputStream input = new FileInputStream(file)) {
            int offset = 0;
            while (offset < data.length) {
                int read = input.read(data, offset, data.length - offset);
                if (read < 0) break;
                offset += read;
            }
            if (offset != data.length) throw new IllegalStateException("Short read");
        }
        return data;
    }

    private void quarantineCorruptSave() {
        if (!saveFile.isFile()) return;
        File quarantine = new File(saveFile.getParentFile(), FILE_NAME + ".corrupt");
        if (quarantine.exists()) quarantine.delete();
        saveFile.renameTo(quarantine);
    }

    private JSONObject response(boolean ok, String code, String data) {
        JSONObject json = new JSONObject();
        try {
            json.put("ok", ok);
            json.put("code", code);
            if (data != null) json.put("data", data);
        } catch (Exception ignored) { }
        return json;
    }

    @TargetApi(Build.VERSION_CODES.M)
    private static final class Api23 {
        private static SecretKey getOrCreateKey() throws Exception {
            KeyStore store = KeyStore.getInstance("AndroidKeyStore");
            store.load(null);
            if (store.containsAlias(KEY_ALIAS)) return ((KeyStore.SecretKeyEntry) store.getEntry(KEY_ALIAS, null)).getSecretKey();
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setRandomizedEncryptionRequired(true)
                    .build());
            return generator.generateKey();
        }

        static JSONObject encrypt(byte[] data) throws Exception {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey(), new SecureRandom());
            byte[] encrypted = cipher.doFinal(data);
            JSONObject envelope = new JSONObject();
            envelope.put("v", 2);
            envelope.put("mode", "AES_GCM");
            envelope.put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP));
            envelope.put("payload", Base64.encodeToString(encrypted, Base64.NO_WRAP));
            return envelope;
        }

        static String decrypt(JSONObject envelope) throws Exception {
            byte[] iv = Base64.decode(envelope.getString("iv"), Base64.NO_WRAP);
            byte[] encrypted = Base64.decode(envelope.getString("payload"), Base64.NO_WRAP);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        }
    }
}
