import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { io, type Socket } from 'socket.io-client'
import {
  Barcode,
  Camera,
  Clock3,
  Clipboard,
  CornerDownLeft,
  Edit3,
  Eraser,
  Flashlight,
  HelpCircle,
  Info,
  Keyboard,
  Link2,
  Menu,
  Monitor,
  Pause,
  QrCode,
  RotateCcw,
  Send,
  ScanLine,
  Settings,
  SquarePen,
  Wifi,
  Trash2,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

type MobilePage = 'connect' | 'scanner' | 'manual' | 'shortcuts'

type DesktopConnection = {
  connected: boolean
  serverUrl: string
  token: string
  computerName: string
  ipAddress: string
  port: string
  error?: string
}

type LastScan = {
  value: string
  type: 'barcode' | 'qr' | 'manual'
  time: string
}

type SendBarcode = (value: string, type: LastScan['type']) => Promise<boolean>

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
    error: token ? undefined : 'Missing desktop token.',
  }
}

function App() {
  const [connection, setConnection] = useState<DesktopConnection>(() => getInitialConnection())
  const [page, setPage] = useState<MobilePage>(() => (connection.token ? 'scanner' : 'connect'))
  const [lastScan, setLastScan] = useState<LastScan | null>(null)
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

    socket.on('desktop:ready', (info: { computerName?: string; ipAddress?: string; port?: number }) => {
      setConnection((current) => ({
        ...current,
        connected: true,
        computerName: info.computerName ?? current.computerName,
        ipAddress: info.ipAddress ?? current.ipAddress,
        port: info.port ? String(info.port) : current.port,
        error: undefined,
      }))
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [connection.serverUrl, connection.token])

  const sendBarcode: SendBarcode = async (value, type) => {
    const barcode = value.trim()

    if (!barcode || !connection.token) {
      return false
    }

    const payload = {
      token: connection.token,
      value: barcode,
      type,
      timestamp: Date.now(),
    }

    const sentBySocket = await new Promise<boolean>((resolve) => {
      const socket = socketRef.current

      if (!socket?.connected) {
        resolve(false)
        return
      }

      socket.timeout(5000).emit('barcode:scanned', payload, (error: Error | null, result?: { ok?: boolean }) => {
        resolve(!error && result?.ok !== false)
      })
    })

    if (!sentBySocket) {
      try {
        const response = await fetch(`${connection.serverUrl}/api/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = (await response.json()) as { ok?: boolean }

        if (result.ok === false) {
          return false
        }
      } catch {
        return false
      }
    }

    setLastScan({
      value: barcode,
      type,
      time: new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(payload.timestamp)),
    })

    return true
  }

  return (
    <main className="pwa-app" aria-label="Phone Scan PWA">
      <section className="app-screen">
        {page === 'scanner' ? (
          <ScannerScreen connection={connection} lastScan={lastScan} sendBarcode={sendBarcode} />
        ) : page === 'manual' ? (
          <ManualScreen connection={connection} lastScan={lastScan} sendBarcode={sendBarcode} />
        ) : page === 'shortcuts' ? (
          <ShortcutsScreen connection={connection} />
        ) : (
          <ConnectScreen connection={connection} setPage={setPage} />
        )}

        <MobileTabs page={page} setPage={setPage} />
      </section>
    </main>
  )
}

function ConnectScreen({
  connection,
  setPage,
}: {
  connection: DesktopConnection
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
            <p>Connect this phone to your desktop tool<br />to start scanning and typing</p>
          </div>
        </div>
        <button className="help-link" type="button">
          <HelpCircle size={28} />
          <span>Help</span>
        </button>
      </header>

      <section className="connect-card qr-connect-card">
        <div className="qr-card-top">
          <span className="scan-orb">
            <ScanLine size={43} strokeWidth={2.7} />
          </span>
          <div className="qr-copy">
            <h2>Scan QR Code</h2>
            <p>Scan the QR code from<br />Phone Scan (Desktop)</p>
          </div>
          <DesktopQrIllustration />
        </div>

        <button className="scan-button" type="button" onClick={() => setPage('scanner')}>
          <QrCode size={33} strokeWidth={2.5} />
          <span>{connection.connected ? 'Open Scanner' : 'Waiting for Desktop'}</span>
        </button>

        <div className="divider">
          <span />
          <strong>or</strong>
          <span />
        </div>

        <button className="manual-button" type="button">
          <Keyboard size={31} strokeWidth={2.4} />
          <span>Enter IP Address Manually</span>
          <i>›</i>
        </button>
      </section>

      <section className="connect-card status-card-mobile">
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

      <section className="connect-card how-card">
        <div className="mobile-card-title">
          <span className="info-dot">i</span>
          <h2>How to connect</h2>
        </div>

        <div className="how-body">
          <ol>
            <li><span>1</span><p>Open Phone Scan on your computer</p></li>
            <li><span>2</span><p>Make sure both devices are on the same Wi-Fi network</p></li>
            <li><span>3</span><p>Scan the QR code or enter the IP address</p></li>
            <li><span>4</span><p>Start scanning and typing!</p></li>
          </ol>
          <div className="bulb-art" aria-hidden="true">
            <span className="bulb-rays" />
            <span className="bulb" />
          </div>
        </div>
      </section>
    </div>
  )
}

function ScannerScreen({
  connection,
  lastScan,
  sendBarcode,
}: {
  connection: DesktopConnection
  lastScan: LastScan | null
  sendBarcode: SendBarcode
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [scannerActive, setScannerActive] = useState(false)
  const [scanMessage, setScanMessage] = useState('Align the barcode within the frame.')

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
          controlsRef.current?.stop()
          controlsRef.current = null
          setScannerActive(false)
          setScanMessage('Barcode sent to desktop.')
          await sendBarcode(value, 'barcode')
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

      <section className={`camera-preview ${scannerActive ? 'has-video' : ''}`}>
        <video ref={videoRef} className="camera-video" muted playsInline />
        <div className="blur-bg" />
        <button className="light-pill" type="button">
          <Zap size={30} strokeWidth={2.4} />
          <span>Tap to turn on light</span>
        </button>
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />
        <div className="parcel-box">
          <div className="barcode-label">
            <span>EAN-13</span>
            <div className="barcode-lines">
              {Array.from({ length: 47 }, (_, index) => (
                <i key={index} />
              ))}
            </div>
            <strong>8&nbsp;&nbsp;936123&nbsp;&nbsp;456789</strong>
          </div>
        </div>
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
        <div className="scan-tips">
          <div>
            <div className="tips-title">
              <span>◌</span>
              <strong>Scan Tips</strong>
            </div>
            <p>{scanMessage}</p>
            <p>Make sure it is well-lit and not blurry.</p>
          </div>
          <div className="tips-barcode-art" aria-hidden="true">
            <span className="tip-corner tl" />
            <span className="tip-corner tr" />
            <span className="tip-corner bl" />
            <span className="tip-corner br" />
            <div className="mini-barcode">
              {Array.from({ length: 18 }, (_, index) => (
                <i key={index} />
              ))}
            </div>
            <em />
          </div>
        </div>
      </section>

      <section className="scanner-controls">
        <button className="side-control" type="button">
          <Flashlight size={42} strokeWidth={2.3} />
          <strong>Flash</strong>
          <span>Off</span>
        </button>
        <button className="scan-control" type="button" onClick={toggleScanner}>
          <ScanLine size={59} strokeWidth={2.4} />
          <strong>{scannerActive ? 'Stop' : 'Scan'}</strong>
        </button>
        <button className="side-control" type="button">
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
  sendBarcode,
}: {
  connection: DesktopConnection
  lastScan: LastScan | null
  sendBarcode: SendBarcode
}) {
  const [manualValue, setManualValue] = useState(lastScan?.value ?? '8936123456789')
  const recentInputs = [
    ...(lastScan ? [[lastScan.value, `Today, ${lastScan.time}`]] : []),
    ['8936123456789', 'Today, 10:24 AM'],
    ['6901234567892', 'Today, 10:20 AM'],
    ['1234567890123', 'Today, 10:18 AM'],
    ['9786041234567', 'Today, 10:15 AM'],
    ['8857123456789', 'Today, 10:12 AM'],
  ]

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

        <button className="manual-send-button" type="button" onClick={() => sendBarcode(manualValue, 'manual')}>
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

      <section className="recent-card">
        <div className="recent-title">
          <span>
            <Clock3 size={34} strokeWidth={2.2} />
          </span>
          <h2>Recent Inputs</h2>
        </div>

        <div className="recent-list">
          {recentInputs.map(([code, time]) => (
            <button className="recent-item" type="button" key={code}>
              <span className="recent-barcode-icon">
                <Barcode size={31} strokeWidth={2.1} />
              </span>
              <span>
                <strong>{code}</strong>
                <small>{time}</small>
              </span>
              <i>›</i>
            </button>
          ))}
        </div>

        <button className="clear-history-button" type="button">
          <Trash2 size={28} strokeWidth={2.2} />
          <span>Clear History</span>
        </button>
      </section>

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

function ShortcutsScreen({ connection }: { connection: DesktopConnection }) {
  const globalShortcuts = [
    {
      icon: <ScanLine />,
      title: 'Start / Stop Scanning',
      description: 'Start or stop barcode scanning',
      keys: ['Ctrl', 'Alt', 'S'],
    },
    {
      icon: <Keyboard />,
      title: 'Manual Input',
      description: 'Open manual input window',
      keys: ['Ctrl', 'Alt', 'M'],
    },
    {
      icon: <Clock3 />,
      title: 'Open History',
      description: 'Open scan history',
      keys: ['Ctrl', 'Alt', 'H'],
    },
    {
      icon: <Settings />,
      title: 'Open Settings',
      description: 'Open settings window',
      keys: ['Ctrl', ','],
    },
    {
      icon: <HelpCircle />,
      title: 'Open Help',
      description: 'Open help and troubleshooting',
      keys: ['F1'],
    },
  ]

  const scanningShortcuts = [
    {
      icon: <Zap />,
      title: 'Toggle Flashlight',
      description: 'Turn camera flashlight on/off',
      keys: ['F'],
    },
    {
      icon: <Camera />,
      title: 'Switch Camera',
      description: 'Switch between front and back camera',
      keys: ['C'],
    },
    {
      icon: <ZoomIn />,
      title: 'Zoom In',
      description: 'Zoom in while scanning',
      keys: ['+'],
    },
    {
      icon: <ZoomOut />,
      title: 'Zoom Out',
      description: 'Zoom out while scanning',
      keys: ['-'],
    },
  ]

  const typingShortcuts = [
    {
      icon: <Eraser />,
      title: 'Clear Typed Text',
      description: 'Clear the last typed text',
      keys: ['Esc'],
    },
    {
      icon: <CornerDownLeft />,
      title: 'Delete Last Character',
      description: 'Delete the last typed character',
      keys: ['Backspace'],
    },
    {
      icon: <Pause />,
      title: 'Pause / Resume Typing',
      description: 'Pause or resume auto typing',
      keys: ['Ctrl', 'Alt', 'P'],
    },
  ]

  return (
    <div className="scanner-content shortcuts-content">
      <header className="scanner-header shortcuts-header">
        <button className="hamburger" type="button" aria-label="Menu">
          <Menu size={41} strokeWidth={2.5} />
        </button>
        <h1>Keyboard Shortcuts</h1>
        <button className="restore-button" type="button">
          <RotateCcw size={27} strokeWidth={2.3} />
          <span>Restore Defaults</span>
        </button>
      </header>

      <DesktopStatusPill connection={connection} className="shortcuts-status" />

      <ShortcutGroup title="Global Shortcuts" shortcuts={globalShortcuts} />
      <ShortcutGroup title="Scanning Shortcuts" shortcuts={scanningShortcuts} />
      <ShortcutGroup title="Typing Shortcuts" shortcuts={typingShortcuts} compact />

      <section className="shortcuts-tip-card">
        <Info size={34} strokeWidth={2.3} />
        <div>
          <strong>Tip</strong>
          <p>You can click the edit icon ( <SquarePen size={24} strokeWidth={2.1} /> ) next to any shortcut to customize it.</p>
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

function ShortcutGroup({
  title,
  shortcuts,
  compact = false,
}: {
  title: string
  shortcuts: Array<{ icon: JSX.Element; title: string; description: string; keys: string[] }>
  compact?: boolean
}) {
  return (
    <section className={`shortcut-section ${compact ? 'compact' : ''}`}>
      <h2>{title}</h2>
      <div className="shortcut-card">
        {shortcuts.map((shortcut) => (
          <div className="shortcut-row" key={shortcut.title}>
            <span className="shortcut-icon">{shortcut.icon}</span>
            <div className="shortcut-copy">
              <strong>{shortcut.title}</strong>
              <p>{shortcut.description}</p>
            </div>
            <div className="shortcut-keys">
              {shortcut.keys.map((key, index) => (
                <span className="key-combo" key={`${shortcut.title}-${key}-${index}`}>
                  {index > 0 && <em>+</em>}
                  <kbd>{key}</kbd>
                </span>
              ))}
            </div>
            <button className="shortcut-edit" type="button" aria-label={`Edit ${shortcut.title}`}>
              <SquarePen size={27} strokeWidth={2.2} />
            </button>
          </div>
        ))}
      </div>
    </section>
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
    { page: 'connect' as const, label: 'Connect', icon: <Link2 size={35} strokeWidth={2.6} /> },
    { page: 'scanner' as const, label: 'Scanner', icon: <ScanLine size={34} strokeWidth={2.2} /> },
    { page: 'manual' as const, label: 'Manual', icon: <Edit3 size={34} strokeWidth={2.3} /> },
    { page: 'shortcuts' as const, label: 'Shortcuts', icon: <Keyboard size={34} strokeWidth={2.3} /> },
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

function DesktopQrIllustration() {
  return (
    <div className="desktop-qr-art" aria-hidden="true">
      <div className="laptop-art">
        <div className="laptop-screen">
          <div className="tiny-qr">
            {Array.from({ length: 25 }, (_, index) => (
              <span key={index} />
            ))}
          </div>
        </div>
        <div className="laptop-base" />
      </div>
      <div className="hand-phone">
        <span className="hand" />
        <span className="phone-art">
          <ScanLine size={31} strokeWidth={2.5} />
        </span>
      </div>
    </div>
  )
}

export default App
