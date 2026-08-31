import type { CapacitorConfig } from "@capacitor/cli";

/** TWIN SOCCER — Android paketleme yapılandırması. */
const config: CapacitorConfig = {
  appId: "com.bymel.twinsoccer",
  appName: "Twin Soccer",
  webDir: "dist",
  android: {
    // Tek dosyalık build zaten yereldir; şema http yerine https olarak kalsın.
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
