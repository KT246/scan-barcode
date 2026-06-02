import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { io, type Socket } from 'socket.io-client'
import {
  Barcode,
  Clipboard,
  Edit3,
  Info,
  Keyboard,
  Link2,
  Menu,
  Monitor,
  Send,
  ScanLine,
  Wifi,
  X,
} from 'lucide-react'

type MobilePage = 'connect' | 'scanner' | 'manual'

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
  type: 'barcode' | 'qr' | 'manual'
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

function formatScanTime(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
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
            setPage={setPage}
          />
        ) : page === 'manual' ? (
          <ManualScreen
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
            <span className="green-dot" />
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

      <section className="connect-card how-card compact-how-card">
        <div className="mobile-card-title">
          <span className="info-dot">i</span>
          <h2>Before scanning</h2>
        </div>

        <div className="how-body">
          <ol>
            <li><span>1</span><p>Keep phone and desktop on the same Wi-Fi or USB tethering.</p></li>
            <li><span>2</span><p>Click the target input on desktop before scanning.</p></li>
            <li><span>3</span><p>Use Scanner or Manual to send barcode data.</p></li>
          </ol>
        </div>

        <button className="scan-button connect-open-scanner" type="button" onClick={() => setPage('scanner')}>
          <ScanLine size={30} strokeWidth={2.5} />
          <span>Open Scanner</span>
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
  setPage,
}: {
  connection: DesktopConnection
  lastScan: LastScan | null
  lastSend: LastSend
  recordLocalScan: (value: string, type: LastScan['type'], timestamp?: number) => LastScan | null
  sendBarcode: SendBarcode
  setPage: (page: MobilePage) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [scannerActive, setScannerActive] = useState(false)
  const [scanMessage, setScanMessage] = useState('Align the barcode within the frame.')
  const cameraNeedsTrustedHttps = !window.isSecureContext

  useEffect(() => {
    return () => {
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [])

  const toggleScanner = async () => {
    if (scannerActive) {
      controlsRef.current?.stop()
      controlsRef.current = null
      setScannerActive(false)
      setScanMessage('Scanner stopped.')
      return
    }

    if (cameraNeedsTrustedHttps) {
      setScanMessage('Camera needs trusted HTTPS. Install the Phone Scan certificate, then reopen this page.')
      return
    }

    try {
      const reader = new BrowserMultiFormatReader()
      setScannerActive(true)
      setScanMessage('Camera is scanning...')
      controlsRef.current = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: {
              ideal: 'environment',
            },
          },
        },
        videoRef.current ?? undefined,
        async (result) => {
          if (!result) {
            return
          }

          const value = result.getText()
          const timestamp = Date.now()
          controlsRef.current?.stop()
          controlsRef.current = null
          setScannerActive(false)
          recordLocalScan(value, 'barcode', timestamp)

          if (!connection.connected) {
            setScanMessage('Barcode scanned, but desktop is not connected.')
            await sendBarcode(value, 'barcode', timestamp)
            return
          }

          setScanMessage('Barcode scanned. Sending to desktop...')
          const sendResult = await sendBarcode(value, 'barcode', timestamp)
          setScanMessage(
            sendResult.delivered
              ? sendResult.typed
                ? 'Desktop received and typed the barcode.'
                : 'Desktop received it, but typing failed. Check focused input.'
              : 'Could not send barcode. Check connection, firewall, or QR IP.',
          )
        },
      )
    } catch (error) {
      setScannerActive(false)
      setScanMessage(error instanceof Error ? error.message : 'Camera unavailable.')
    }
  }

  return (
    <div className="scanner-content">
      <header className="scanner-header">
        <button className="hamburger" type="button" aria-label="Menu">
          <Menu size={41} strokeWidth={2.5} />
        </button>
        <h1>Camera Scanner</h1>
        <button className="connected-pill" type="button">
          <span />
          <strong>{connection.connected ? 'Connected' : 'Offline'}</strong>
          <i>⌄</i>
        </button>
      </header>

      <DesktopStatusPill connection={connection} />

      {cameraNeedsTrustedHttps && <CertificateNotice connection={connection} />}

      <section className={`camera-preview ${scannerActive ? 'has-video' : ''}`}>
        <video ref={videoRef} className="camera-video" muted playsInline />
        {!scannerActive && (
          <div className="camera-placeholder">
            <ScanLine size={64} strokeWidth={2.2} />
            <strong>Tap Scan to start camera</strong>
            <span>Align the barcode inside the frame.</span>
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

      <section className="scanner-controls">
        <button className="scan-control" type="button" onClick={toggleScanner}>
          <ScanLine size={59} strokeWidth={2.4} />
          <strong>{scannerActive ? 'Stop' : 'Scan'}</strong>
        </button>
        <button className="side-control" type="button" onClick={() => setPage('manual')}>
          <Keyboard size={42} strokeWidth={2.3} />
          <strong>Manual Input</strong>
        </button>
      </section>
    </div>
  )
}

function ManualScreen({
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
  const [manualValue, setManualValue] = useState(lastScan?.value ?? '')
  const sendManualValue = async () => {
    const timestamp = Date.now()
    const scan = recordLocalScan(manualValue, 'manual', timestamp)

    if (!scan) {
      await sendBarcode(manualValue, 'manual', timestamp)
      return
    }

    await sendBarcode(scan.value, 'manual', timestamp)
  }

  return (
    <div className="scanner-content manual-content">
      <header className="scanner-header manual-header">
        <button className="hamburger" type="button" aria-label="Menu">
          <Menu size={41} strokeWidth={2.5} />
        </button>
        <h1>Manual Input</h1>
        <button className="connected-pill" type="button">
          <span />
          <strong>{connection.connected ? 'Connected' : 'Offline'}</strong>
          <i>⌄</i>
        </button>
      </header>

      <DesktopStatusPill connection={connection} />

      <section className="manual-entry-card">
        <div className="manual-entry-title">
          <span>
            <Edit3 size={46} strokeWidth={2.3} />
          </span>
          <div>
            <h2>Enter Barcode Manually</h2>
            <p>Type or paste a barcode and send to your computer</p>
          </div>
        </div>

        <label className="barcode-field">
          <strong>Barcode</strong>
          <span className="input-shell">
            <input value={manualValue} onChange={(event) => setManualValue(event.target.value)} />
            <i />
            <button type="button" aria-label="Clear barcode" onClick={() => setManualValue('')}>
              <X size={27} strokeWidth={3} />
            </button>
          </span>
        </label>

        <div className="input-meta">
          <span>Supports 1D / 2D barcodes</span>
          <span>{manualValue.trim().length} characters</span>
        </div>

        <button className="manual-send-button" type="button" onClick={sendManualValue}>
          <Send size={31} strokeWidth={2.4} />
          <span>Send</span>
        </button>

        <button
          className="paste-button"
          type="button"
          onClick={async () => {
            const text = await navigator.clipboard?.readText()
            setManualValue(text ?? manualValue)
          }}
        >
          <Clipboard size={28} strokeWidth={2.3} />
          <span>Paste from Clipboard</span>
        </button>
      </section>

      <ConnectionDiagnostics connection={connection} lastScan={lastScan} lastSend={lastSend} compact />

      <section className="manual-tip-card">
        <Info size={34} strokeWidth={2.3} />
        <div>
          <strong>Tip</strong>
          <p>Make sure the input cursor is in the target field on your computer<br />before sending.</p>
        </div>
        <div className="tip-window-art" aria-hidden="true">
          <span className="tip-window-top" />
          <span className="tip-window-line one" />
          <span className="tip-window-line two" />
          <span className="tip-cursor" />
        </div>
      </section>
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
  return (
    <section className={`desktop-status-pill ${className}`}>
      <Monitor size={31} strokeWidth={2} />
      <span>
        Connected to: <strong>{connection.connected ? connection.computerName : 'Waiting for desktop'}</strong>
      </span>
      <em />
      <Wifi size={31} strokeWidth={2.4} />
      <strong>{connection.ipAddress}:{connection.port}</strong>
    </section>
  )
}

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
    { page: 'manual' as const, label: 'Manual', icon: <Edit3 size={34} strokeWidth={2.3} /> },
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
