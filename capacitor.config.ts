import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.inventorytracker.app',
  appName: 'Chắt Chiu',
  webDir: 'dist/InventoryTrackingApp/browser',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#488AFF',
      sound: 'beep.wav',
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#667eea',
    },
  },
  android: {
    allowMixedContent: true,
  }
};

export default config;
