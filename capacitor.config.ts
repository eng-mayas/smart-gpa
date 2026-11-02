import type { CapacitorConfig } from "@capacitor/cli";

// Native wrapper config (Android / iOS). See README → "تطبيق موبايل".
const config: CapacitorConfig = {
  appId: "com.atmata.smartgpa",
  appName: "Smart GPA",
  webDir: "dist",
  backgroundColor: "#f3f6fb",
  android: { allowMixedContent: false },
  ios: { contentInset: "automatic" },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: "#1060a8", showSpinner: false },
    StatusBar: { style: "LIGHT", backgroundColor: "#1060a8" },
  },
};

export default config;
