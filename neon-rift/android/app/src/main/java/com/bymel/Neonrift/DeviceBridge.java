package com.bymel.Neonrift;

import android.app.Activity;
import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.webkit.JavascriptInterface;

final class DeviceBridge {
    private final Activity activity;

    DeviceBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public void vibrate(int milliseconds) {
        int duration = Math.max(1, Math.min(120, milliseconds));
        Vibrator vibrator = (Vibrator) activity.getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE));
        } else {
            vibrator.vibrate(duration);
        }
    }

    @JavascriptInterface
    public void closeToHome() {
        activity.runOnUiThread(() -> activity.moveTaskToBack(true));
    }
}
