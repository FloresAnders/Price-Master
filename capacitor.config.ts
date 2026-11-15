import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.timemaster.app",
  appName: "Time Master",
  webDir: "capacitor-web",
  server: {
    url: "https://www.timemaster.es/",
    androidScheme: "https",
    cleartext: false,
  },
};

export default config;
