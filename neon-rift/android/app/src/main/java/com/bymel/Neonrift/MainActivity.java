package com.bymel.Neonrift;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public final class MainActivity extends Activity {
    private WebView webView;
    private BillingBridge billingBridge;
    private SecureSaveBridge secureSaveBridge;
    private AdsBridge adsBridge;

    @SuppressLint({"SetJavaScriptEnabled", "ClickableViewAccessibility"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (!BuildConfig.DEBUG) getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        applyImmersiveMode();

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
        secureSaveBridge = new SecureSaveBridge(this);
        adsBridge = new AdsBridge(this, webView);
        webView.addJavascriptInterface(billingBridge, "BymelBilling");
        webView.addJavascriptInterface(secureSaveBridge, "BymelSecure");
        webView.addJavascriptInterface(adsBridge, "BymelAds");
        webView.addJavascriptInterface(new DeviceBridge(this), "android");
        setContentView(webView);
        webView.loadUrl("file:///android_asset/index.html");
    }

    private void applyImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(
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
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
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
        if (billingBridge != null) billingBridge.close();
        if (adsBridge != null) adsBridge.close();
        if (webView != null) {
            webView.removeJavascriptInterface("BymelBilling");
            webView.removeJavascriptInterface("BymelSecure");
            webView.removeJavascriptInterface("BymelAds");
            webView.removeJavascriptInterface("android");
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
