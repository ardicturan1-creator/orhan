package com.bymel.Neonrift;

import android.app.Activity;
import android.os.SystemClock;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Google AdMob köprüsü.
 *
 * Çalışma zamanı reklam birimleri {@link BuildConfig} üzerinden gelir; test kimliği kullanılmaz.
 * WebView içindeki oyun bu köprüyü {@code window.BymelAds} adıyla görür ve olaylar
 * {@code window.onBymelAdEvent} geri çağrısına JSON olarak iletilir.
 */
final class AdsBridge {
    /** Aynı geçiş reklamının art arda gösterilmemesi için en kısa bekleme. */
    private static final long INTERSTITIAL_COOLDOWN_MS = 30_000L;
    /** Başarısız yüklemelerde sonsuz döngü olmaması için yeniden deneme gecikmesi. */
    private static final long RELOAD_BACKOFF_MS = 20_000L;

    private final Activity activity;
    private final WebView webView;

    private InterstitialAd interstitialAd;
    private RewardedAd rewardedAd;
    private boolean initialized;
    private boolean interstitialLoading;
    private boolean rewardedLoading;
    private boolean showingFullScreenAd;
    private long lastInterstitialShownAt;
    private long interstitialRetryAt;
    private long rewardedRetryAt;
    private String pendingRewardedRequestId;
    private boolean pendingRewardEarned;

    AdsBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    /** Oyun açılışında JS tarafından çağrılır; SDK'yı başlatır ve iki reklamı da ön yükler. */
    @JavascriptInterface
    public String initialize() {
        activity.runOnUiThread(() -> {
            if (!initialized) {
                initialized = true;
                // SDK başlatma disk/ağ işi yapar; ana iş parçacığını bloklamamak için arka planda çalıştırılır.
                new Thread(() -> MobileAds.initialize(activity, status -> activity.runOnUiThread(() -> {
                    loadInterstitial();
                    loadRewarded();
                    emit(statusEvent(true, "SDK_READY", "AdMob hazır", null));
                }))).start();
            } else {
                loadInterstitial();
                loadRewarded();
            }
        });
        return response(true, "INITIALIZING", "AdMob başlatılıyor").toString();
    }

    /** Bölüm sonu / ölüm reklamı. Hazır değilse oyun akışı beklemeden devam eder. */
    @JavascriptInterface
    public String showGameOverAd(String requestId) {
        activity.runOnUiThread(() -> {
            if (showingFullScreenAd) {
                emit(statusEvent(false, "AD_ALREADY_VISIBLE", "Zaten bir reklam gösteriliyor", requestId));
                return;
            }
            long now = SystemClock.elapsedRealtime();
            if (lastInterstitialShownAt != 0L && now - lastInterstitialShownAt < INTERSTITIAL_COOLDOWN_MS) {
                emit(statusEvent(false, "AD_COOLDOWN", "Reklam bekleme süresinde", requestId));
                return;
            }
            if (interstitialAd == null) {
                loadInterstitial();
                emit(statusEvent(false, "AD_NOT_READY", "Reklam henüz hazır değil", requestId));
                return;
            }
            InterstitialAd ad = interstitialAd;
            interstitialAd = null;
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdShowedFullScreenContent() {
                    showingFullScreenAd = true;
                    lastInterstitialShownAt = SystemClock.elapsedRealtime();
                }

                @Override
                public void onAdDismissedFullScreenContent() {
                    showingFullScreenAd = false;
                    loadInterstitial();
                    emit(statusEvent(true, "AD_CLOSED", "Reklam kapatıldı", requestId));
                }

                @Override
                public void onAdFailedToShowFullScreenContent(AdError error) {
                    showingFullScreenAd = false;
                    loadInterstitial();
                    emit(statusEvent(false, "AD_SHOW_FAILED", error.getMessage(), requestId));
                }
            });
            ad.show(activity);
        });
        return response(true, "PENDING", "Reklam isteniyor").toString();
    }

    /** Mağazadaki ödüllü reklam. Ödül yalnızca kullanıcı reklamı hak edince bildirilir. */
    @JavascriptInterface
    public String showRewardedAd(String requestId) {
        activity.runOnUiThread(() -> {
            if (showingFullScreenAd) {
                emit(rewardEvent(false, "AD_ALREADY_VISIBLE", "Zaten bir reklam gösteriliyor", requestId, false));
                return;
            }
            if (rewardedAd == null) {
                loadRewarded();
                emit(rewardEvent(false, "AD_NOT_READY", "Ödüllü reklam henüz hazır değil", requestId, false));
                return;
            }
            RewardedAd ad = rewardedAd;
            rewardedAd = null;
            pendingRewardedRequestId = requestId;
            pendingRewardEarned = false;
            ad.setFullScreenContentCallback(new FullScreenContentCallback() {
                @Override
                public void onAdShowedFullScreenContent() {
                    showingFullScreenAd = true;
                }

                @Override
                public void onAdDismissedFullScreenContent() {
                    showingFullScreenAd = false;
                    boolean earned = pendingRewardEarned;
                    String id = pendingRewardedRequestId;
                    pendingRewardedRequestId = null;
                    pendingRewardEarned = false;
                    loadRewarded();
                    if (earned) {
                        emit(rewardEvent(true, "REWARD_EARNED", "Ödül kazanıldı", id, true));
                    } else {
                        emit(rewardEvent(false, "REWARD_SKIPPED", "Reklam tamamlanmadı", id, false));
                    }
                }

                @Override
                public void onAdFailedToShowFullScreenContent(AdError error) {
                    showingFullScreenAd = false;
                    String id = pendingRewardedRequestId;
                    pendingRewardedRequestId = null;
                    pendingRewardEarned = false;
                    loadRewarded();
                    emit(rewardEvent(false, "AD_SHOW_FAILED", error.getMessage(), id, false));
                }
            });
            // Ödül yalnızca burada işaretlenir; teslim, reklam kapandıktan sonra tek seferde bildirilir.
            ad.show(activity, reward -> pendingRewardEarned = true);
        });
        return response(true, "PENDING", "Ödüllü reklam isteniyor").toString();
    }

    /** JS tarafının düğmeyi aktif/pasif göstermesi için anlık hazır olma durumu. */
    @JavascriptInterface
    public String status() {
        JSONObject json = response(true, "OK", "");
        try {
            json.put("initialized", initialized);
            json.put("interstitialReady", interstitialAd != null);
            json.put("rewardedReady", rewardedAd != null);
        } catch (JSONException ignored) { }
        return json.toString();
    }

    private void loadInterstitial() {
        if (interstitialLoading || interstitialAd != null) return;
        long now = SystemClock.elapsedRealtime();
        if (interstitialRetryAt != 0L && now < interstitialRetryAt) return;
        interstitialLoading = true;
        InterstitialAd.load(activity, BuildConfig.ADMOB_INTERSTITIAL_UNIT_ID, new AdRequest.Builder().build(),
                new InterstitialAdLoadCallback() {
                    @Override
                    public void onAdLoaded(InterstitialAd ad) {
                        interstitialLoading = false;
                        interstitialRetryAt = 0L;
                        interstitialAd = ad;
                        emit(statusEvent(true, "INTERSTITIAL_READY", "Bölüm sonu reklamı hazır", null));
                    }

                    @Override
                    public void onAdFailedToLoad(LoadAdError error) {
                        interstitialLoading = false;
                        interstitialAd = null;
                        interstitialRetryAt = SystemClock.elapsedRealtime() + RELOAD_BACKOFF_MS;
                        emit(statusEvent(false, "INTERSTITIAL_LOAD_FAILED", error.getMessage(), null));
                    }
                });
    }

    private void loadRewarded() {
        if (rewardedLoading || rewardedAd != null) return;
        long now = SystemClock.elapsedRealtime();
        if (rewardedRetryAt != 0L && now < rewardedRetryAt) return;
        rewardedLoading = true;
        RewardedAd.load(activity, BuildConfig.ADMOB_REWARDED_UNIT_ID, new AdRequest.Builder().build(),
                new RewardedAdLoadCallback() {
                    @Override
                    public void onAdLoaded(RewardedAd ad) {
                        rewardedLoading = false;
                        rewardedRetryAt = 0L;
                        rewardedAd = ad;
                        emit(statusEvent(true, "REWARDED_READY", "Ödüllü reklam hazır", null));
                    }

                    @Override
                    public void onAdFailedToLoad(LoadAdError error) {
                        rewardedLoading = false;
                        rewardedAd = null;
                        rewardedRetryAt = SystemClock.elapsedRealtime() + RELOAD_BACKOFF_MS;
                        emit(statusEvent(false, "REWARDED_LOAD_FAILED", error.getMessage(), null));
                    }
                });
    }

    private JSONObject rewardEvent(boolean ok, String code, String message, String requestId, boolean earned) {
        JSONObject json = response(ok, code, message);
        try {
            json.put("type", "reward");
            json.put("earned", earned);
            if (requestId != null) json.put("requestId", requestId);
        } catch (JSONException ignored) { }
        return json;
    }

    private JSONObject statusEvent(boolean ok, String code, String message, String requestId) {
        JSONObject json = response(ok, code, message);
        try {
            json.put("type", "status");
            if (requestId != null) json.put("requestId", requestId);
        } catch (JSONException ignored) { }
        return json;
    }

    private JSONObject response(boolean ok, String code, String message) {
        JSONObject json = new JSONObject();
        try {
            json.put("ok", ok);
            json.put("code", code == null ? "UNKNOWN" : code);
            json.put("message", message == null ? "" : message);
        } catch (JSONException ignored) { }
        return json;
    }

    private void emit(JSONObject payload) {
        String script = "window.onBymelAdEvent&&window.onBymelAdEvent(" + JSONObject.quote(payload.toString()) + ");";
        activity.runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }

    void close() {
        interstitialAd = null;
        rewardedAd = null;
        pendingRewardedRequestId = null;
    }
}
