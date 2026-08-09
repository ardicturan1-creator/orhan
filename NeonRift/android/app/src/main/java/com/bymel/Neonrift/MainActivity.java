package com.bymel.Neonrift;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.TextView;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

public final class MainActivity extends Activity {
    private WebView webView;
    private BillingBridge billingBridge;
    private SecureSaveBridge secureSaveBridge;
    private OnBackInvokedCallback backInvokedCallback;

    @SuppressLint({"SetJavaScriptEnabled", "ClickableViewAccessibility"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (!BuildConfig.DEBUG) getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        applyDisplayCutoutMode();
        applyImmersiveMode();

        IntegrityGuard.Result integrity = IntegrityGuard.assess(this);
        if (!integrity.valid && !BuildConfig.DEBUG) {
            showIntegrityBlock(integrity.code);
            return;
        }

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(5, 8, 23));
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setLongClickable(false);
        webView.setHapticFeedbackEnabled(false);
        webView.setOnLongClickListener(view -> true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) webView.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setTextZoom(100);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) settings.setSafeBrowsingEnabled(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                return !url.startsWith("file:///android_asset/");
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage message) {
                return true;
            }
        });

        billingBridge = new BillingBridge(this, webView);
        secureSaveBridge = new SecureSaveBridge(this, integrity);
        webView.addJavascriptInterface(billingBridge, "BymelBilling");
        webView.addJavascriptInterface(secureSaveBridge, "BymelSecure");
        webView.addJavascriptInterface(new DeviceBridge(this), "android");
        setContentView(webView);
        registerBackHandler();
        webView.loadUrl("file:///android_asset/index.html");
    }

    // Android 13+ tahmine dayalı geri (predictive back) hedef SDK 35'ten itibaren varsayılan olarak açıktır
    // ve onBackPressed() artık çağrılmaz. Geri tuşu/hareketi her sürümde aynı davranmalıdır.
    private void registerBackHandler() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return;
        backInvokedCallback = this::handleBackNavigation;
        getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT, backInvokedCallback);
    }

    private void unregisterBackHandler() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || backInvokedCallback == null) return;
        getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backInvokedCallback);
        backInvokedCallback = null;
    }

    private void showIntegrityBlock(String code) {
        TextView message = new TextView(this);
        message.setGravity(Gravity.CENTER);
        message.setTextColor(Color.rgb(246, 248, 255));
        message.setBackgroundColor(Color.rgb(5, 8, 23));
        message.setTextSize(16);
        message.setPadding(48, 48, 48, 48);
        message.setText("NEON RIFT\n\nUygulama bütünlüğü doğrulanamadı.\nKod: " + code + "\n\nResmî ve değiştirilmemiş sürümü yükleyin.");
        setContentView(message);
    }

    // Çentikli/delikli ekranlarda oyun alanının kesilmemesi için pencere çentiğin altına da uzatılır.
    // Bu ayar yalnızca pencere özniteliği olarak vardır; manifest içinde karşılığı yoktur.
    private void applyDisplayCutoutMode() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return;
        WindowManager.LayoutParams attributes = getWindow().getAttributes();
        attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        getWindow().setAttributes(attributes);
    }

    @SuppressWarnings("deprecation")
    private void applyImmersiveMode() {
        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11+ (ve 15+ zorunlu edge-to-edge) için güncel API; çentikli ekranlarda da tam ekran kalır.
            window.setDecorFitsSystemWindows(false);
            WindowInsetsController controller = window.getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.systemBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
            return;
        }
        window.getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    @Override
    protected void onResume() {
        super.onResume();
        applyImmersiveMode();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.evaluateJavascript("window.NRFlushSave&&window.NRFlushSave()", null);
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && backInvokedCallback != null) return;
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        handleBackNavigation();
    }

    private void handleBackNavigation() {
        if (webView == null) {
            finish();
            return;
        }
        String script = "(function(){"
                + "var panel=document.getElementById('panel');"
                + "if(panel&&panel.classList.contains('active')){document.getElementById('panelClose').click();return 'handled';}"
                + "var level=document.getElementById('levelup');if(level&&level.classList.contains('active'))return 'handled';"
                + "var pause=document.getElementById('pause');"
                + "if(pause&&pause.classList.contains('active')){document.getElementById('resumeButton').click();return 'handled';}"
                + "var results=document.getElementById('results');"
                + "if(results&&results.classList.contains('active')){document.getElementById('resultHome').click();return 'handled';}"
                + "var hud=document.getElementById('hud');"
                + "if(hud&&hud.classList.contains('active')){document.getElementById('pauseButton').click();return 'handled';}"
                + "return 'exit';})()";
        webView.evaluateJavascript(script, value -> {
            if ("\"exit\"".equals(value)) moveTaskToBack(true);
        });
    }

    @Override
    protected void onDestroy() {
        unregisterBackHandler();
        if (billingBridge != null) billingBridge.close();
        if (webView != null) {
            webView.removeJavascriptInterface("BymelBilling");
            webView.removeJavascriptInterface("BymelSecure");
            webView.removeJavascriptInterface("android");
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
