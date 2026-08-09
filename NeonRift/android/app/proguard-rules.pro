-keepclassmembers class com.bymel.Neonrift.** {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes *Annotation*
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
}
