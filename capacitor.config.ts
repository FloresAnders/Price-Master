import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pricemaster.app',
  appName: 'Time Master',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Camera: {
      permissions: ['camera', 'photos', 'mediaLibrary']
    },
    LocalStorage: {
      group: 'PriceMasterGroup'
    }
  }
};

export default config;
