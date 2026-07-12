import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export interface GroundNavUpdateInfo {
  available: boolean
  installCompatible: boolean
  compatibilityMessage?: string
  currentVersionName: string
  currentVersionCode: number
  latestVersionName: string
  latestVersionCode: number
  sizeBytes: number
  releaseUrl: string
  apkName: string
  tag: string
}

export interface GroundNavInstallResult {
  status: 'current' | 'permission_required' | 'installer_opened'
  versionName?: string
  message?: string
}

export interface GroundNavDownloadProgress {
  receivedBytes: number
  totalBytes: number
  percent: number
}

interface GroundNavUpdaterPlugin {
  getCurrentVersion(): Promise<{ versionName: string; versionCode: number }>
  checkForUpdate(): Promise<GroundNavUpdateInfo>
  downloadAndInstall(): Promise<GroundNavInstallResult>
  cancelDownload(): Promise<{ cancelled: boolean }>
  addListener(
    eventName: 'downloadProgress',
    listener: (event: GroundNavDownloadProgress) => void
  ): Promise<PluginListenerHandle>
}

export const GroundNavUpdater = registerPlugin<GroundNavUpdaterPlugin>('GroundNavUpdater')

