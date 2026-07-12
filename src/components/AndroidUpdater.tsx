import { useState } from 'react'
import { Browser } from '@capacitor/browser'
import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import { AlertOctagon, CheckCircle2, ChevronRight, Download, LoaderCircle, ShieldCheck } from 'lucide-react'
import { GroundNavUpdater } from '../lib/updater'

const latestReleaseUrl = 'https://github.com/Sabotage1/GroundNav/releases/latest'

type UpdatePhase = 'idle' | 'checking' | 'downloading' | 'permission' | 'current' | 'installer' | 'error'

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 'signed APK'
  return `${(value / (1024 * 1024)).toFixed(1)} MB signed APK`
}

export function AndroidUpdater({ variant = 'menu' }: { variant?: 'menu' | 'card' }) {
  const [phase, setPhase] = useState<UpdatePhase>('idle')
  const [message, setMessage] = useState('Checks the public signed GitHub release')
  const [progress, setProgress] = useState(0)
  const busy = phase === 'checking' || phase === 'downloading'
  const nativeUpdaterAvailable = Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('GroundNavUpdater')

  async function openReleasePage() {
    await Browser.open({ url: latestReleaseUrl, presentationStyle: 'popover' })
  }

  async function updateAndroid() {
    if (busy) return
    if (!nativeUpdaterAvailable) {
      await openReleasePage()
      return
    }

    let progressListener: PluginListenerHandle | undefined
    setPhase('checking')
    setMessage('Checking GitHub for the latest signed release…')
    setProgress(0)

    try {
      const update = await GroundNavUpdater.checkForUpdate()
      if (!update.available) {
        setPhase('current')
        setMessage(`GroundNav v${update.currentVersionName} is up to date`)
        return
      }
      if (!update.installCompatible) {
        setPhase('error')
        setMessage(update.compatibilityMessage || 'The installed app and update use different signing keys')
        return
      }

      setPhase('downloading')
      setMessage(`Downloading v${update.latestVersionName} · ${formatBytes(update.sizeBytes)}`)
      progressListener = await GroundNavUpdater.addListener('downloadProgress', (event) => {
        setProgress(Math.max(0, Math.min(100, Math.round(event.percent))))
      })

      const result = await GroundNavUpdater.downloadAndInstall()
      if (result.status === 'permission_required') {
        setPhase('permission')
        setMessage(result.message || 'Allow installs from GroundNav, return here, then tap again')
      } else if (result.status === 'current') {
        setPhase('current')
        setMessage(`GroundNav v${result.versionName || update.latestVersionName} is up to date`)
      } else {
        setPhase('installer')
        setMessage(`Android is ready to install GroundNav v${result.versionName || update.latestVersionName}`)
      }
    } catch (caught) {
      setPhase('error')
      setMessage(caught instanceof Error ? caught.message : 'Android update failed')
    } finally {
      await progressListener?.remove()
    }
  }

  const icon = busy ? <LoaderCircle className="android-updater__spinner" /> : phase === 'current' ? <CheckCircle2 /> : phase === 'installer' ? <ShieldCheck /> : phase === 'error' ? <AlertOctagon /> : <Download />
  const title = phase === 'downloading' ? `Downloading update · ${progress}%` : phase === 'permission' ? 'Continue Android update' : phase === 'installer' ? 'Installer opened' : 'Check for Android update'

  if (variant === 'card') {
    return (
      <section className={`android-updater android-updater--card android-updater--${phase}`} aria-live="polite">
        <div><ShieldCheck /><span><strong>Signed Android updates</strong><small>Downloads only verified GroundNav releases from GitHub</small></span></div>
        <button className="button button--primary button--full" type="button" onClick={updateAndroid} disabled={busy}>{icon}{title}</button>
        {phase === 'downloading' && <progress value={progress} max="100">{progress}%</progress>}
        <p>{message}</p>
        {phase === 'error' && <button className="text-button" type="button" onClick={openReleasePage}>Open releases page instead</button>}
      </section>
    )
  }

  return (
    <div className={`android-updater android-updater--menu android-updater--${phase}`} aria-live="polite">
      <button type="button" onClick={updateAndroid} disabled={busy}>{icon}<span><strong>{title}</strong><small>{message}</small></span><ChevronRight /></button>
      {phase === 'downloading' && <progress value={progress} max="100">{progress}%</progress>}
      {phase === 'error' && <button className="text-button" type="button" onClick={openReleasePage}>Open releases page</button>}
    </div>
  )
}
