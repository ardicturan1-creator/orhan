-keepclassmembers class com.bymel.Neonrift.** {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes *Annotation*
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
}

# Google Mobile Ads SDK, reklam biçimlerini yansıma ile çözer.
-keep class com.google.android.gms.ads.** { *; }
-dontwarn com.google.android.gms.ads.**
