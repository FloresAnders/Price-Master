import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.timemaster.app',
  appName: 'Time Master',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Camera: {
      permissions: ['camera', 'photos', 'mediaLibrary']
    },
    Clipboard: {
      // No requiere permisos explícitos, pero se declara para claridad
      description: 'Permite copiar y pegar texto entre la app y el sistema'
    },
    LocalStorage: {
      group: 'TimeMasterGroup'
    }
  }
};

export default config;
