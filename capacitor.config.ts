import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Change this to your own reverse-DNS bundle id before shipping to the App Store.
  appId: 'com.yourcompany.lifeline',
  appName: 'Lifeline',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    backgroundColor: '#FAF8F5',
  },
};

export default config;
