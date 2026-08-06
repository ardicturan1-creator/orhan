package com.bymel.Neonrift;

import android.app.Activity;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class BillingBridge implements PurchasesUpdatedListener {
    private static final Set<String> ALLOWED_PRODUCTS = Collections.unmodifiableSet(new HashSet<>(Arrays.asList(
            "com.bymel.neonrift.gems_80",
            "com.bymel.neonrift.gems_500",
            "com.bymel.neonrift.gold_12000",
            "com.bymel.neonrift.starter_pack"
    )));

    private final Activity activity;
    private final WebView webView;
    private final ExecutorService verifierExecutor = Executors.newSingleThreadExecutor();
    private final Map<String, String> pendingRequestByProduct = Collections.synchronizedMap(new HashMap<>());
    private BillingClient billingClient;
    private volatile boolean ready;

    BillingBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    @JavascriptInterface
    public synchronized String initialize(String productIdsJson) {
        if (billingClient != null) {
            return response(true, ready ? "READY" : "CONNECTING", "Google Play Billing başlatıldı").toString();
        }
        validateRequestedProducts(productIdsJson);
        PendingPurchasesParams pendingParams = PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .build();
        billingClient = BillingClient.newBuilder(activity)
                .setListener(this)
                .enablePendingPurchases(pendingParams)
                .enableAutoServiceReconnection()
                .build();
        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult result) {
                ready = result.getResponseCode() == BillingClient.BillingResponseCode.OK;
                if (ready) {
                    queryExistingPurchases();
                    emit(statusEvent(true, "READY", "Google Play Billing hazır", null));
                } else {
                    emit(statusEvent(false, "SETUP_" + result.getResponseCode(), result.getDebugMessage(), null));
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                ready = false;
                emit(statusEvent(false, "SERVICE_DISCONNECTED", "Google Play bağlantısı kesildi", null));
            }
        });
        return response(true, "CONNECTING", "Google Play bağlantısı kuruluyor").toString();
    }

    @JavascriptInterface
    public String purchase(String productId, String requestId) {
        if (!ALLOWED_PRODUCTS.contains(productId)) return response(false, "UNKNOWN_PRODUCT", "Geçersiz ürün").toString();
        if (billingClient == null || !ready) return response(false, "NOT_READY", "Google Play henüz hazır değil").toString();
        if (pendingRequestByProduct.containsKey(productId)) return response(false, "BUSY", "Bu ürün için işlem sürüyor").toString();
        pendingRequestByProduct.put(productId, requestId);
        activity.runOnUiThread(() -> queryAndLaunch(productId, requestId));
        return response(true, "PENDING", "Satın alma ekranı hazırlanıyor").toString();
    }

    @JavascriptInterface
    public String restorePurchases() {
        if (billingClient == null || !ready) return response(false, "NOT_READY", "Google Play henüz hazır değil").toString();
        queryExistingPurchases();
        return response(true, "RESTORING", "Satın almalar kontrol ediliyor").toString();
    }

    private void queryAndLaunch(String productId, String requestId) {
        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.INAPP)
                .build();
        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(product))
                .build();
        billingClient.queryProductDetailsAsync(params, (result, queryResult) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || queryResult.getProductDetailsList().isEmpty()) {
                pendingRequestByProduct.remove(productId);
                emit(statusEvent(false, "PRODUCT_UNAVAILABLE", result.getDebugMessage(), requestId));
                return;
            }
            ProductDetails details = queryResult.getProductDetailsList().get(0);
            BillingFlowParams.ProductDetailsParams.Builder detailBuilder = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(details);
            List<ProductDetails.OneTimePurchaseOfferDetails> offers = details.getOneTimePurchaseOfferDetailsList();
            if (offers != null && !offers.isEmpty()) detailBuilder.setOfferToken(offers.get(0).getOfferToken());
            BillingFlowParams flowParams = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(detailBuilder.build()))
                    .build();
            BillingResult launchResult = billingClient.launchBillingFlow(activity, flowParams);
            if (launchResult.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                pendingRequestByProduct.remove(productId);
                emit(statusEvent(false, "LAUNCH_" + launchResult.getResponseCode(), launchResult.getDebugMessage(), requestId));
            }
        });
    }

    @Override
    public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase purchase : purchases) processPurchase(purchase);
            return;
        }
        String code = result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED ? "USER_CANCELED" : "BILLING_" + result.getResponseCode();
        List<Map.Entry<String, String>> pending = new ArrayList<>(pendingRequestByProduct.entrySet());
        pendingRequestByProduct.clear();
        if (pending.isEmpty()) emit(statusEvent(false, code, result.getDebugMessage(), null));
        for (Map.Entry<String, String> entry : pending) emit(statusEvent(false, code, result.getDebugMessage(), entry.getValue()));
    }

    private void queryExistingPurchases() {
        QueryPurchasesParams params = QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build();
        billingClient.queryPurchasesAsync(params, (result, purchases) -> {
            if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                for (Purchase purchase : purchases) processPurchase(purchase);
            }
        });
    }

    private void processPurchase(Purchase purchase) {
        if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
            for (String productId : purchase.getProducts()) {
                emit(statusEvent(false, "PURCHASE_PENDING", "Ödeme onayı bekleniyor", pendingRequestByProduct.get(productId)));
            }
            return;
        }
        if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) return;
        for (String productId : purchase.getProducts()) {
            if (!ALLOWED_PRODUCTS.contains(productId)) continue;
            verifyPurchase(purchase, productId, valid -> {
                if (!valid) {
                    emit(statusEvent(false, "SERVER_VERIFICATION_FAILED", "Satın alma sunucuda doğrulanamadı", pendingRequestByProduct.remove(productId)));
                    return;
                }
                if ("com.bymel.neonrift.starter_pack".equals(productId)) {
                    acknowledgeAndDeliver(purchase, productId);
                } else {
                    consumeAndDeliver(purchase, productId);
                }
            });
        }
    }

    private void consumeAndDeliver(Purchase purchase, String productId) {
        ConsumeParams params = ConsumeParams.newBuilder().setPurchaseToken(purchase.getPurchaseToken()).build();
        billingClient.consumeAsync(params, (result, token) -> {
            if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                emit(purchaseEvent(purchase, productId, pendingRequestByProduct.remove(productId)));
            } else {
                emit(statusEvent(false, "CONSUME_" + result.getResponseCode(), result.getDebugMessage(), pendingRequestByProduct.remove(productId)));
            }
        });
    }

    private void acknowledgeAndDeliver(Purchase purchase, String productId) {
        if (purchase.isAcknowledged()) {
            emit(purchaseEvent(purchase, productId, pendingRequestByProduct.remove(productId)));
            return;
        }
        AcknowledgePurchaseParams params = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchase.getPurchaseToken())
                .build();
        billingClient.acknowledgePurchase(params, result -> {
            if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                emit(purchaseEvent(purchase, productId, pendingRequestByProduct.remove(productId)));
            } else {
                emit(statusEvent(false, "ACK_" + result.getResponseCode(), result.getDebugMessage(), pendingRequestByProduct.remove(productId)));
            }
        });
    }

    private interface VerificationCallback { void onResult(boolean valid); }

    private void verifyPurchase(Purchase purchase, String productId, VerificationCallback callback) {
        if (!BuildConfig.REQUIRE_SERVER_VERIFICATION) {
            callback.onResult(true);
            return;
        }
        String endpoint = BuildConfig.PURCHASE_VERIFY_URL;
        if (endpoint == null || !endpoint.startsWith("https://")) {
            callback.onResult(false);
            return;
        }
        verifierExecutor.execute(() -> {
            boolean valid = false;
            HttpURLConnection connection = null;
            try {
                JSONObject payload = new JSONObject()
                        .put("packageName", activity.getPackageName())
                        .put("productId", productId)
                        .put("purchaseToken", purchase.getPurchaseToken());
                connection = (HttpURLConnection) new URL(endpoint).openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(7000);
                connection.setReadTimeout(7000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
                connection.setFixedLengthStreamingMode(body.length);
                try (OutputStream output = connection.getOutputStream()) { output.write(body); }
                if (connection.getResponseCode() >= 200 && connection.getResponseCode() < 300) {
                    StringBuilder text = new StringBuilder();
                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                        String line;
                        while ((line = reader.readLine()) != null && text.length() < 32768) text.append(line);
                    }
                    valid = new JSONObject(text.toString()).optBoolean("valid", false);
                }
            } catch (Exception ignored) {
                valid = false;
            } finally {
                if (connection != null) connection.disconnect();
            }
            boolean result = valid;
            activity.runOnUiThread(() -> callback.onResult(result));
        });
    }

    private void validateRequestedProducts(String productIdsJson) {
        try {
            JSONArray array = new JSONArray(productIdsJson == null ? "[]" : productIdsJson);
            for (int i = 0; i < array.length(); i++) {
                if (!ALLOWED_PRODUCTS.contains(array.optString(i))) throw new IllegalArgumentException("Unknown product requested");
            }
        } catch (JSONException error) {
            throw new IllegalArgumentException("Invalid product list", error);
        }
    }

    private JSONObject purchaseEvent(Purchase purchase, String productId, String requestId) {
        JSONObject json = response(true, "PURCHASED", "Satın alma teslimata hazır");
        try {
            json.put("type", "purchase");
            json.put("verified", true);
            json.put("productId", productId);
            json.put("purchaseToken", purchase.getPurchaseToken());
            json.put("orderId", purchase.getOrderId());
            json.put("quantity", purchase.getQuantity());
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
        String script = "window.onBymelBillingEvent&&window.onBymelBillingEvent(" + JSONObject.quote(payload.toString()) + ");";
        activity.runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }

    synchronized void close() {
        ready = false;
        if (billingClient != null) {
            billingClient.endConnection();
            billingClient = null;
        }
        verifierExecutor.shutdownNow();
    }
}
