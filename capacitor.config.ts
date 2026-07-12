import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.groundnav.llbg',
  appName: 'LLBG GroundNav',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  }
}

export default config
