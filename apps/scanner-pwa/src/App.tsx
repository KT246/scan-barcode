import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatOneDReader, BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { io, type Socket } from 'socket.io-client'
import {
  Barcode,
  Info,
  Link2,
  Monitor,
  Send,
  Settings,
  ScanLine,
  Wifi,
  X,
} from 'lucide-react'

type MobilePage = 'connect' | 'scanner'

type DesktopConnection = {
  connected: boolean
  serverUrl: string
  token: string
  computerName: string
  ipAddress: string
  port: string
  protocol: 'http' | 'https'
  certificateUrl: string
  trustUrl: string
  error?: string
}

type LastScan = {
  value: string
  type: 'barcode' | 'qr'
  time: string
}

type LastSendState = 'idle' | 'sending' | 'received' | 'typed' | 'failed'

type LastSend = {
  state: LastSendState
  message: string
  detail?: string
  via?: 'socket' | 'http'
  time?: string
}

type SendResult = {
  delivered: boolean
  typed: boolean
  via?: LastSend['via']
  error?: string
}

type SendBarcode = (value: string, type: LastScan['type'], timestamp?: number) => Promise<SendResult>

type ScannerSettings = {
  autoSend: boolean
  duplicateLock: boolean
  scanIntervalMs: number
}

const scannerSettingsStorageKey = 'phone-scan.scanner-settings'
const defaultScannerSettings: ScannerSettings = {
  autoSend: true,
  duplicateLock: true,
  scanIntervalMs: 1000,
}
const barcodeReaderOptions = {
  delayBetweenScanAttempts: 70,
  delayBetweenScanSuccess: 350,
  tryPlayVideoTimeout: 3000,
}
const barcodeVideoConstraints: MediaStreamConstraints = {
  video: {
    facingMode: {
      ideal: 'environment',
    },
    width: {
      ideal: 1280,
    },
    height: {
      ideal: 720,
    },
    frameRate: {
      ideal: 30,
    },
  },
}

let scanAudioContext: AudioContext | null = null

function playBarcodeScanFeedback() {
  navigator.vibrate?.(45)

  const AudioContextConstructor = window.AudioContext
    ?? (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!AudioContextConstructor) {
    return
  }

  try {
    const audioContext = scanAudioContext ?? new AudioContextConstructor()
    scanAudioContext = audioContext

    const playSound = () => {
      const now = audioContext.currentTime
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()

      oscillator.type = 'square'
      oscillator.frequency.setValueAtTime(1180, now)
      oscillator.frequency.exponentialRampToValueAtTime(920, now + 0.1)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)
      oscillator.connect(gain)
      gain.connect(audioContext.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.15)
      oscillator.addEventListener('ended', () => {
        oscillator.disconnect()
        gain.disconnect()
      }, { once: true })
    }

    if (audioContext.state === 'suspended') {
      void audioContext.resume().then(playSound).catch(() => undefined)
      return
    }

    playSound()
  } catch {
    // Audio feedback is best-effort; scanning must continue even if the browser blocks sound.
  }
}

function applyBarcodeCameraTuning(controls: IScannerControls) {
  try {
    controls.streamVideoConstraintsApply?.({
      advanced: [
        { focusMode: 'continuous' } as unknown as MediaTrackConstraintSet,
        { exposureMode: 'continuous' } as unknown as MediaTrackConstraintSet,
      ],
    })
  } catch {
    // Browser support varies; scan should continue with the base constraints.
  }
}

function normalizeScannerSettings(settings: Partial<ScannerSettings>): ScannerSettings {
  const scanIntervalMs = Number.isFinite(settings.scanIntervalMs)
    ? Math.max(200, Math.min(10000, Math.round(settings.scanIntervalMs ?? defaultScannerSettings.scanIntervalMs)))
    : defaultScannerSettings.scanIntervalMs

  return {
    autoSend: settings.autoSend ?? defaultScannerSettings.autoSend,
    duplicateLock: settings.duplicateLock ?? defaultScannerSettings.duplicateLock,
    scanIntervalMs,
  }
}

function getInitialScannerSettings() {
  try {
    const rawSettings = window.localStorage.getItem(scannerSettingsStorageKey)

    if (!rawSettings) {
      return defaultScannerSettings
    }

    return normalizeScannerSettings(JSON.parse(rawSettings) as Partial<ScannerSettings>)
  } catch {
    return defaultScannerSettings
  }
}

function formatScanTime(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}

function getDesktopScannerUrl(value: string) {
  try {
    const url = new URL(value.trim())
    const token = url.searchParams.get('token')
    const scanPath = url.pathname === '/scan' || url.pathname.endsWith('/scan')

    return token && scanPath ? url : null
  } catch {
    return null
  }
}

function getInitialConnection(): DesktopConnection {
  const url = new URL(window.location.href)
  const serverUrl = url.searchParams.get('server') ?? window.location.origin
  const token = url.searchParams.get('token') ?? ''

  return {
    connected: false,
    serverUrl,
    token,
    computerName: 'Desktop',
    ipAddress: window.location.hostname || '192.168.1.15',
    port: window.location.port || '8787',
    protocol: window.location.protocol === 'https:' ? 'https' : 'http',
    certificateUrl: `${serverUrl}/cert/phone-scan-local-cert.pem`,
    trustUrl: `${serverUrl}/trust`,
    error: token ? undefined : 'Missing desktop token.',
  }
}

function App() {
  const [connection, setConnection] = useState<DesktopConnection>(() => getInitialConnection())
  const [page, setPage] = useState<MobilePage>(() => (connection.token ? 'scanner' : 'connect'))
  const [lastScan, setLastScan] = useState<LastScan | null>(null)
  const [lastSend, setLastSend] = useState<LastSend>({
    state: 'idle',
    message: 'No barcode sent yet.',
  })
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!connection.token) {
      return
    }

    const socket = io(connection.serverUrl, {
      auth: { token: connection.token },
      query: { token: connection.token },
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setConnection((current) => ({ ...current, connected: true, error: undefined }))
    })

    socket.on('disconnect', () => {
      setConnection((current) => ({ ...current, connected: false }))
    })

    socket.on('connect_error', (error) => {
      setConnection((current) => ({ ...current, connected: false, error: error.message }))
    })

    socket.on('desktop:ready', (info: {
      computerName?: string
      ipAddress?: string
      port?: number
      protocol?: 'http' | 'https'
      certificateUrl?: string
      trustUrl?: string
    }) => {
      setConnection((current) => ({
        ...current,
        connected: true,
        computerName: info.computerName ?? current.computerName,
        ipAddress: info.ipAddress ?? current.ipAddress,
        port: info.port ? String(info.port) : current.port,
        protocol: info.protocol ?? current.protocol,
        certificateUrl: info.certificateUrl ?? current.certificateUrl,
        trustUrl: info.trustUrl ?? current.trustUrl,
        error: undefined,
      }))
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [connection.serverUrl, connection.token])

  const recordLocalScan = (value: string, type: LastScan['type'], timestamp = Date.now()) => {
    const barcode = value.trim()

    if (!barcode) {
      return null
    }

    const scan: LastScan = {
      value: barcode,
      type,
      time: formatScanTime(timestamp),
    }

    setLastScan(scan)
    return scan
  }

  const updateSendStatus = (next: LastSend) => {
    setLastSend({
      ...next,
      time: next.time ?? formatScanTime(Date.now()),
    })
  }

  const sendBarcode: SendBarcode = async (value, type, timestamp = Date.now()) => {
    const barcode = value.trim()

    if (!barcode || !connection.token) {
      updateSendStatus({
        state: 'failed',
        message: !barcode ? 'No barcode value to send.' : 'Missing desktop token.',
      })
      return { delivered: false, typed: false, error: !barcode ? 'No barcode value to send.' : 'Missing desktop token.' }
    }

    if (!connection.connected) {
      updateSendStatus({
        state: 'failed',
        message: 'Barcode scanned, but desktop is not connected.',
        detail: 'Open Connect and scan the desktop QR again.',
      })
      return { delivered: false, typed: false, error: 'Desktop is not connected.' }
    }

    const payload = {
      token: connection.token,
      value: barcode,
      type,
      timestamp,
    }

    updateSendStatus({
      state: 'sending',
      message: 'Sending barcode to desktop...',
    })

    const socketResult = await new Promise<SendResult | null>((resolve) => {
      const socket = socketRef.current

      if (!socket?.connected) {
        resolve(null)
        return
      }

      socket.timeout(5000).emit('barcode:scanned', payload, (error: Error | null, result?: { ok?: boolean; error?: string }) => {
        if (error) {
          resolve(null)
          return
        }

        resolve({
          delivered: true,
          typed: result?.ok !== false,
          via: 'socket',
          error: result?.error,
        })
      })
    })

    let result = socketResult

    if (!result) {
      try {
        const response = await fetch(`${connection.serverUrl}/api/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const body = (await response.json()) as { ok?: boolean; error?: string }

        if (!response.ok) {
          result = { delivered: false, typed: false, via: 'http', error: body.error ?? response.statusText }
        } else {
          result = {
            delivered: true,
            typed: body.ok !== false,
            via: 'http',
            error: body.error,
          }
        }
      } catch (error) {
        result = {
          delivered: false,
          typed: false,
          error: error instanceof Error ? error.message : 'Network request failed.',
        }
      }
    }

    updateSendStatus({
      state: result.delivered ? (result.typed ? 'typed' : 'received') : 'failed',
      message: result.delivered
        ? result.typed
          ? 'Desktop received and typed the barcode.'
          : 'Desktop received the barcode, but typing failed.'
        : 'Could not send barcode to desktop.',
      detail: result.error,
      via: result.via,
      time: formatScanTime(timestamp),
    })

    return result
  }

  return (
    <main className="pwa-app" aria-label="Phone Scan PWA">
      <section className="app-screen">
        {page === 'scanner' ? (
          <ScannerScreen
            connection={connection}
            lastScan={lastScan}
            lastSend={lastSend}
            recordLocalScan={recordLocalScan}
            sendBarcode={sendBarcode}
          />
        ) : (
          <ConnectScreen connection={connection} lastScan={lastScan} lastSend={lastSend} setPage={setPage} />
        )}

        <MobileTabs page={page} setPage={setPage} />
      </section>
    </main>
  )
}

function ConnectScreen({
  connection,
  lastScan,
  lastSend,
  setPage,
}: {
  connection: DesktopConnection
  lastScan: LastScan | null
  lastSend: LastSend
  setPage: (page: MobilePage) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [connectScannerActive, setConnectScannerActive] = useState(false)
  const [connectScanMessage, setConnectScanMessage] = useState(
    connection.connected ? 'Desktop is connected. You can open the barcode scanner.' : 'Scan the QR code shown in the desktop app.',
  )
  const cameraNeedsTrustedHttps = !window.isSecureContext

  useEffect(() => {
    return () => {
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [])

  const stopConnectScanner = () => {
    controlsRef.current?.stop()
    controlsRef.current = null
    setConnectScannerActive(false)
  }

  const toggleConnectScanner = async () => {
    if (connectScannerActive) {
      stopConnectScanner()
      setConnectScanMessage('Connection QR scanner stopped.')
      return
    }

    if (cameraNeedsTrustedHttps) {
      setConnectScanMessage('Camera needs HTTPS. Open this page from HTTPS before scanning the desktop QR.')
      return
    }

    try {
      const reader = new BrowserMultiFormatReader()
      setConnectScannerActive(true)
      setConnectScanMessage('Scanning desktop connection QR...')
      controlsRef.current = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: {
              ideal: 'environment',
            },
          },
        },
        videoRef.current ?? undefined,
        (result) => {
          if (!result) {
            return
          }

          const scannerUrl = getDesktopScannerUrl(result.getText())
          stopConnectScanner()

          if (!scannerUrl) {
            setConnectScanMessage('This is not a Phone Scan desktop QR. Use the QR shown in the desktop app.')
            return
          }

          setConnectScanMessage('Desktop QR detected. Opening local scanner...')
          window.location.assign(scannerUrl.href)
        },
      )
    } catch (error) {
      setConnectScannerActive(false)
      setConnectScanMessage(error instanceof Error ? error.message : 'Camera unavailable.')
    }
  }

  return (
    <div className="pwa-content">
      <header className="connect-header">
        <div className="pwa-brand">
          <img src="/app-logo-icon.png" alt="Phone Scan logo" />
          <span>Phone Scan</span>
        </div>
        <div className="title-row">
          <Link2 size={40} strokeWidth={3} />
          <div>
            <h1>Connect to Desktop</h1>
            <p>{connection.connected ? `${connection.computerName} is ready` : connection.error ?? 'Scan the desktop QR code to connect'}</p>
          </div>
        </div>
      </header>

      <section className="connect-card status-card-mobile compact-connect-card">
        <div className="mobile-card-title">
          <span className="bars">
            <i />
            <i />
            <i />
            <i />
          </span>
          <h2>Connection Status</h2>
        </div>

        <div className="not-connected-box">
          <div className="status-copy">
            <span className={`green-dot ${connection.connected ? 'online' : 'offline'}`} />
            <div>
              <strong>{connection.connected ? 'Connected' : 'Not Connected'}</strong>
              <p>
                {connection.connected
                  ? `${connection.computerName} - ${connection.ipAddress}:${connection.port}`
                  : connection.error ?? 'Scan QR code or enter IP to connect'}
              </p>
            </div>
          </div>
          <div className="device-link-art" aria-hidden="true">
            <span className="phone-mini" />
            <span className="dash-line" />
            <X size={22} strokeWidth={3.4} />
            <span className="dash-line" />
            <span className="laptop-mini" />
          </div>
        </div>
      </section>

      <section className="connect-card connect-qr-scanner-card">
        <div className="mobile-card-title">
          <span className="info-dot">QR</span>
          <h2>Desktop QR Scanner</h2>
        </div>

        <div className={`connect-qr-preview ${connectScannerActive ? 'has-video' : ''}`}>
          <video ref={videoRef} className="camera-video" muted playsInline />
          {!connectScannerActive && (
            <div className="connect-qr-placeholder">
              <Link2 size={42} strokeWidth={2.5} />
              <strong>Scan desktop QR here</strong>
              <span>This scanner only connects the phone to Phone Scan Desktop.</span>
            </div>
          )}
        </div>

        <p className="connect-scan-message">{connectScanMessage}</p>

        <button className="scan-button connect-open-scanner" type="button" onClick={toggleConnectScanner}>
          <ScanLine size={30} strokeWidth={2.5} />
          <span>{connectScannerActive ? 'Stop QR Scanner' : 'Scan Desktop QR'}</span>
        </button>
      </section>

      <section className="connect-card how-card compact-how-card">
        <div className="mobile-card-title">
          <span className="info-dot">i</span>
          <h2>Before scanning</h2>
        </div>

        <div className="how-body">
          <ol>
            <li><span>1</span><p>Keep phone and desktop on the same Wi-Fi or USB tethering.</p></li>
            <li><span>2</span><p>Scan the QR from Phone Scan Desktop on this Connect page.</p></li>
            <li><span>3</span><p>After connected, use Scanner for product barcodes only.</p></li>
          </ol>
        </div>

        <button className="scan-button connect-open-scanner" type="button" onClick={() => setPage('scanner')}>
          <Barcode size={30} strokeWidth={2.5} />
          <span>Open Barcode Scanner</span>
        </button>
      </section>

      <ConnectionDiagnostics connection={connection} lastScan={lastScan} lastSend={lastSend} />
    </div>
  )
}

function ScannerScreen({
  connection,
  lastScan,
  lastSend,
  recordLocalScan,
  sendBarcode,
}: {
  connection: DesktopConnection
  lastScan: LastScan | null
  lastSend: LastSend
  recordLocalScan: (value: string, type: LastScan['type'], timestamp?: number) => LastScan | null
  sendBarcode: SendBarcode
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const scanInFlightRef = useRef(false)
  const lastAcceptedScanRef = useRef<{ value: string; at: number } | null>(null)
  const connectionRef = useRef(connection)
  const recordLocalScanRef = useRef(recordLocalScan)
  const sendBarcodeRef = useRef(sendBarcode)
  const [scannerSettings, setScannerSettings] = useState<ScannerSettings>(() => getInitialScannerSettings())
  const settingsRef = useRef(scannerSettings)
  const [scannerActive, setScannerActive] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [scanMessage, setScanMessage] = useState('Align the barcode within the frame.')
  const cameraNeedsTrustedHttps = !window.isSecureContext

  const updateScannerSettings = (nextSettings: Partial<ScannerSettings>) => {
    setScannerSettings((current) => normalizeScannerSettings({ ...current, ...nextSettings }))
  }

  useEffect(() => {
    connectionRef.current = connection
    recordLocalScanRef.current = recordLocalScan
    sendBarcodeRef.current = sendBarcode
  }, [connection, recordLocalScan, sendBarcode])

  useEffect(() => {
    settingsRef.current = scannerSettings

    try {
      window.localStorage.setItem(scannerSettingsStorageKey, JSON.stringify(scannerSettings))
    } catch {
      // Storage can be unavailable in private browsing; runtime settings still work.
    }
  }, [scannerSettings])

  const stopScanner = () => {
    controlsRef.current?.stop()
    controlsRef.current = null
    scanInFlightRef.current = false
    setScannerActive(false)
  }

  const startScanner = async () => {
    if (controlsRef.current) {
      return
    }

    if (cameraNeedsTrustedHttps) {
      setScanMessage('Camera needs trusted HTTPS. Install the Phone Scan certificate, then reopen this page.')
      return
    }

    try {
      const reader = new BrowserMultiFormatOneDReader(undefined, barcodeReaderOptions)
      scanInFlightRef.current = false
      setScannerActive(true)
      setScanMessage('Scanning barcode only...')
      const controls = await reader.decodeFromConstraints(
        barcodeVideoConstraints,
        videoRef.current ?? undefined,
        async (result) => {
          if (!result || scanInFlightRef.current) {
            return
          }

          const value = result.getText().trim()

          if (!value) {
            return
          }

          const scannerUrl = getDesktopScannerUrl(value)

          if (scannerUrl) {
            setScanMessage('QR ignored. Use the Connect tab to scan desktop QR.')
            return
          }

          const timestamp = Date.now()
          const lastAcceptedScan = lastAcceptedScanRef.current
          const activeSettings = settingsRef.current
          const elapsedSinceLastScan = lastAcceptedScan ? timestamp - lastAcceptedScan.at : Number.POSITIVE_INFINITY

          if (
            lastAcceptedScan
            && elapsedSinceLastScan < activeSettings.scanIntervalMs
            && (lastAcceptedScan.value !== value || activeSettings.duplicateLock)
          ) {
            setScanMessage(
              lastAcceptedScan.value === value
                ? 'Duplicate barcode ignored.'
                : `Waiting ${Math.ceil((activeSettings.scanIntervalMs - elapsedSinceLastScan) / 1000)}s before next scan.`,
            )
            return
          }

          scanInFlightRef.current = true
          lastAcceptedScanRef.current = { value, at: timestamp }

          try {
            recordLocalScanRef.current(value, 'barcode', timestamp)
            playBarcodeScanFeedback()

            if (!activeSettings.autoSend) {
              setScanMessage('Barcode scanned. Auto send is off.')
              return
            }

            if (!connectionRef.current.connected) {
              setScanMessage('Barcode scanned, but desktop is not connected.')
              await sendBarcodeRef.current(value, 'barcode', timestamp)
              return
            }

            setScanMessage('Barcode scanned. Sending to desktop...')
            const sendResult = await sendBarcodeRef.current(value, 'barcode', timestamp)
            setScanMessage(
              sendResult.delivered
                ? sendResult.typed
                  ? 'Desktop received and typed the barcode.'
                  : 'Desktop received it, but typing failed. Check focused input.'
                : 'Could not send barcode. Check connection, firewall, or QR IP.',
            )
          } finally {
            scanInFlightRef.current = false
          }
        },
      )
      controlsRef.current = controls
      applyBarcodeCameraTuning(controls)
    } catch (error) {
      controlsRef.current?.stop()
      controlsRef.current = null
      setScannerActive(false)
      setScanMessage(error instanceof Error ? error.message : 'Camera unavailable.')
    }
  }

  useEffect(() => {
    void startScanner()

    return () => {
      stopScanner()
    }
  }, [])

  return (
    <div className="scanner-content">
      <header className="scanner-header">
        <button
          className={`hamburger scanner-settings-toggle ${settingsOpen ? 'active' : ''}`}
          type="button"
          aria-label="Scanner settings"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <Settings size={39} strokeWidth={2.5} />
        </button>
        <h1>Camera Scanner</h1>
        <button className="connected-pill" type="button">
          <span className={connection.connected ? 'online' : 'offline'} />
          <strong>{connection.connected ? 'Connected' : 'Offline'}</strong>
          <i>⌄</i>
        </button>
      </header>

      <DesktopStatusPill connection={connection} />

      {cameraNeedsTrustedHttps && <CertificateNotice connection={connection} />}

      {settingsOpen && (
        <section className="scanner-settings-card">
          <div className="scanner-settings-header">
            <div>
              <strong>Scanner Settings</strong>
              <span>Barcode-only camera behavior</span>
            </div>
            <button type="button" aria-label="Close scanner settings" onClick={() => setSettingsOpen(false)}>
              <X size={24} strokeWidth={2.5} />
            </button>
          </div>

          <label className="scanner-setting-row">
            <span>
              <strong>Scan interval</strong>
              <small>Minimum delay before accepting the next read.</small>
            </span>
            <input
              min="0.2"
              max="10"
              step="0.1"
              type="number"
              value={scannerSettings.scanIntervalMs / 1000}
              onChange={(event) => updateScannerSettings({ scanIntervalMs: Number(event.target.value) * 1000 })}
            />
          </label>

          <label className="scanner-setting-row">
            <span>
              <strong>Ignore duplicates</strong>
              <small>Block the same barcode while it stays in frame.</small>
            </span>
            <input
              type="checkbox"
              checked={scannerSettings.duplicateLock}
              onChange={(event) => updateScannerSettings({ duplicateLock: event.target.checked })}
            />
          </label>

          <label className="scanner-setting-row">
            <span>
              <strong>Auto send</strong>
              <small>Send each barcode to desktop after reading.</small>
            </span>
            <input
              type="checkbox"
              checked={scannerSettings.autoSend}
              onChange={(event) => updateScannerSettings({ autoSend: event.target.checked })}
            />
          </label>
        </section>
      )}

      <section className={`camera-preview ${scannerActive ? 'has-video' : ''}`}>
        <video ref={videoRef} className="camera-video" muted playsInline />
        {!scannerActive && (
          <div className="camera-placeholder">
            <ScanLine size={64} strokeWidth={2.2} />
            <strong>Starting barcode scanner</strong>
            <span>Scanner starts automatically on this tab.</span>
          </div>
        )}
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />
        <span className="scan-laser" />
      </section>

      <section className="scanner-info-card">
        <div className="last-scanned">
          <span className="scan-success-icon">
            <Barcode size={46} strokeWidth={2.4} />
          </span>
          <div>
            <p>Last scanned</p>
            <strong>{lastScan?.value ?? 'No barcode yet'}</strong>
            <time>{lastScan ? `Today, ${lastScan.time}` : 'Waiting for scan'}</time>
          </div>
          <button type="button" disabled={!lastScan} onClick={() => lastScan && sendBarcode(lastScan.value, lastScan.type)}>
            <Send size={30} strokeWidth={2.3} />
            <span>Send Again</span>
          </button>
        </div>
        <div className="scan-tips compact-scan-tips">
          <div>
            <div className="tips-title">
              <span>◌</span>
              <strong>Status</strong>
            </div>
            <p>{scanMessage}</p>
          </div>
        </div>
      </section>

      <ConnectionDiagnostics connection={connection} lastScan={lastScan} lastSend={lastSend} compact />
    </div>
  )
}

function DesktopStatusPill({
  connection,
  className = '',
}: {
  connection: DesktopConnection
  className?: string
}) {
  const endpoint = connection.token ? `${connection.ipAddress}:${connection.port}` : 'No desktop QR scanned'

  return (
    <section className={`desktop-status-pill ${className}`}>
      <Monitor size={31} strokeWidth={2} />
      <span>
        Connected to: <strong>{connection.connected ? connection.computerName : 'Waiting for desktop'}</strong>
      </span>
      <em />
      <Wifi size={31} strokeWidth={2.4} />
      <strong>{endpoint}</strong>
    </section>
  )
}

/*

          <i>⌄</i>
*/

function CertificateNotice({ connection }: { connection: DesktopConnection }) {
  return (
    <section className="certificate-notice">
      <Info size={28} strokeWidth={2.3} />
      <div>
        <strong>Camera needs trusted HTTPS</strong>
        <p>Install the Phone Scan local certificate on this phone, then reopen the scanner.</p>
      </div>
      <a href={connection.trustUrl || connection.certificateUrl}>Setup</a>
    </section>
  )
}

function ConnectionDiagnostics({
  connection,
  lastScan,
  lastSend,
  compact = false,
}: {
  connection: DesktopConnection
  lastScan: LastScan | null
  lastSend: LastSend
  compact?: boolean
}) {
  return (
    <section className={`diagnostics-card ${compact ? 'compact' : ''}`}>
      <div className="diagnostics-title">
        <span className={`diagnostics-dot ${connection.connected ? 'online' : 'offline'}`} />
        <strong>Debug Status</strong>
      </div>

      <div className="diagnostics-grid">
        <DiagnosticRow label="Server" value={connection.serverUrl} />
        <DiagnosticRow label="Token" value={connection.token ? 'Exists' : 'Missing'} tone={connection.token ? 'good' : 'bad'} />
        <DiagnosticRow label="Socket" value={connection.connected ? 'Connected' : 'Offline'} tone={connection.connected ? 'good' : 'bad'} />
        <DiagnosticRow label="Last Scan" value={lastScan ? `${lastScan.value} (${lastScan.type})` : 'None'} />
        <DiagnosticRow label="Last Send" value={lastSend.message} tone={lastSend.state === 'typed' || lastSend.state === 'received' ? 'good' : lastSend.state === 'failed' ? 'bad' : 'neutral'} />
        <DiagnosticRow label="Typed Result" value={lastSend.state === 'typed' ? 'Typed' : lastSend.state === 'received' ? 'Received only' : lastSend.state === 'sending' ? 'Sending' : 'Not typed'} tone={lastSend.state === 'typed' ? 'good' : lastSend.state === 'received' || lastSend.state === 'failed' ? 'bad' : 'neutral'} />
        {lastSend.detail && <DiagnosticRow label="Error" value={lastSend.detail} tone="bad" />}
        {lastSend.via && <DiagnosticRow label="Channel" value={lastSend.via.toUpperCase()} />}
      </div>
    </section>
  )
}

function DiagnosticRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'good' | 'bad'
}) {
  return (
    <div className={`diagnostic-row ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function MobileTabs({
  page,
  setPage,
}: {
  page: MobilePage
  setPage: (page: MobilePage) => void
}) {
  const tabs = [
    { page: 'scanner' as const, label: 'Scanner', icon: <ScanLine size={34} strokeWidth={2.2} /> },
    { page: 'connect' as const, label: 'Connect', icon: <Link2 size={35} strokeWidth={2.6} /> },
  ]

  return (
    <nav className="mobile-tabs scanner-tabs" aria-label="Scanner navigation">
      {tabs.map((tab) => (
        <button
          className={page === tab.page ? 'active' : ''}
          key={tab.page}
          type="button"
          onClick={() => setPage(tab.page)}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

export default App
