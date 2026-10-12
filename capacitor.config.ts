import type { CapacitorConfig } from '@capacitor/cli';

// BUILD_EDITION is set by the Android APK workflow. Each edition gets a
// separate Android package ID, so staff and customer apps can coexist.
const isStaff = process.env.BUILD_EDITION === 'staff';

const config: CapacitorConfig = {
  appId: isStaff ? 'uk.co.stakeyscycles.staff' : 'uk.co.stakeyscycles.customer',
  appName: isStaff ? "Stakey's Workshop" : "Stakey's Cycles",
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
