import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Change this to your own reverse-DNS bundle id before shipping to the App Store.
  appId: 'com.yourcompany.driftwood',
  appName: 'Driftwood',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    backgroundColor: '#F2F3EF',
  },
};

export default config;
