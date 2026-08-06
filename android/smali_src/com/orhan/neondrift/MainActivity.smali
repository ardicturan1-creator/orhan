.class public Lcom/orhan/neondrift/MainActivity;
.super Landroid/app/Activity;
.source "MainActivity.java"

.method public constructor <init>()V
    .locals 0
    invoke-direct {p0}, Landroid/app/Activity;-><init>()V
    return-void
.end method

.method protected onCreate(Landroid/os/Bundle;)V
    .locals 4

    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

    # getWindow().setFlags(FLAG_FULLSCREEN | FLAG_KEEP_SCREEN_ON, same mask) -> 0x480
    invoke-virtual {p0}, Landroid/app/Activity;->getWindow()Landroid/view/Window;
    move-result-object v0
    const/16 v1, 0x480
    invoke-virtual {v0, v1, v1}, Landroid/view/Window;->setFlags(II)V

    new-instance v0, Landroid/webkit/WebView;
    invoke-direct {v0, p0}, Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V

    invoke-virtual {v0}, Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;
    move-result-object v2

    const/4 v1, 0x1
    invoke-virtual {v2, v1}, Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V
    invoke-virtual {v2, v1}, Landroid/webkit/WebSettings;->setDomStorageEnabled(Z)V
    invoke-virtual {v2, v1}, Landroid/webkit/WebSettings;->setAllowFileAccess(Z)V
    invoke-virtual {v2, v1}, Landroid/webkit/WebSettings;->setLoadWithOverviewMode(Z)V
    invoke-virtual {v2, v1}, Landroid/webkit/WebSettings;->setUseWideViewPort(Z)V
    invoke-virtual {v2, v1}, Landroid/webkit/WebSettings;->setMediaPlaybackRequiresUserGesture(Z)V

    const-string v3, "file:///android_asset/www/index.html"
    invoke-virtual {v0, v3}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V

    invoke-virtual {p0, v0}, Landroid/app/Activity;->setContentView(Landroid/view/View;)V

    return-void
.end method
