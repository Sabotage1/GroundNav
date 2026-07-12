import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.groundnav.llbg',
  appName: 'LLBG GroundNav',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  android: {
    // The native UI is served from https://localhost while the test tower runs
    // on the Mac's plain-HTTP LAN address. Both API fetches and ws:// traffic
    // require WebView mixed-content mode in addition to clear-text permission.
    allowMixedContent: true
  }
}

export default config
