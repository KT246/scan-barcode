import { useEffect, useState, type ReactElement } from 'react'
import QRCode from 'qrcode'
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  CircleHelp,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Home,
  Info,
  Keyboard,
  Laptop,
  Lightbulb,
  Link2,
  LockKeyhole,
  Minus,
  MoreVertical,
  Network,
  Play,
  QrCode,
  RefreshCw,
  Rocket,
  Save,
  ScanBarcode,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Square,
  Trash2,
  Usb,
  Wrench,
  Wifi,
  X,
} from 'lucide-react'
import type { DesktopConnectInfo, DesktopScanRecord, DesktopScanStatus } from './shared/desktop-api'

const fallbackScannerUrl = 'https://192.168.1.10:8787/scan?token=ABC123'
const fallbackConnectInfo: DesktopConnectInfo = {
  status: 'starting',
  computerName: 'DESKTOP',
  ipAddress: '192.168.1.10',
  port: 8787,
  protocol: 'https',
  scannerUrl: fallbackScannerUrl,
  certificateUrl: 'https://192.168.1.10:8787/cert/phone-scan-local-cert.pem',
  trustUrl: 'https://192.168.1.10:8787/trust',
  qrDataUrl: '',
  tokenPreview: 'ABC...123',
  connectedClients: 0,
}

type Page = 'home' | 'history' | 'settings' | 'help'

function App() {
  const [page, setPage] = useState<Page>('home')
  const [connectInfo, setConnectInfo] = useState<DesktopConnectInfo>(fallbackConnectInfo)
  const [scanHistory, setScanHistory] = useState<DesktopScanRecord[]>([])

  useEffect(() => {
    const api = window.phoneScan

    if (!api) {
      QRCode.toDataURL(fallbackScannerUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        scale: 12,
        color: {
          dark: '#050505',
          light: '#ffffff',
        },
      }).then((qrDataUrl) => {
        setConnectInfo((current) => ({ ...current, status: 'running', qrDataUrl }))
      })
      return
    }

    let mounted = true

    api.getConnectInfo().then((info) => {
      if (mounted) {
        setConnectInfo(info)
      }
    })

    api.getScanHistory().then((rows) => {
      if (mounted) {
        setScanHistory(rows)
      }
    })

    const unsubscribeInfo = api.onConnectInfoChanged((info) => {
      setConnectInfo(info)
    })
    const unsubscribeScan = api.onScanReceived((record) => {
      setScanHistory((current) => [record, ...current.filter((row) => row.id !== record.id)].slice(0, 200))
    })

    return () => {
      mounted = false
      unsubscribeInfo()
      unsubscribeScan()
    }
  }, [])

  const refreshConnectInfo = async () => {
    const info = await window.phoneScan?.refreshConnectInfo()

    if (info) {
      setConnectInfo(info)
    }
  }

  const copyScannerUrl = async () => {
    if (!connectInfo.scannerUrl) {
      return
    }

    await navigator.clipboard?.writeText(connectInfo.scannerUrl)
  }

  const openScannerPage = async () => {
    if (window.phoneScan) {
      await window.phoneScan.openScannerPage()
      return
    }

    if (connectInfo.scannerUrl) {
      window.open(connectInfo.scannerUrl, '_blank', 'noopener,noreferrer')
    }
  }

  useEffect(() => {
    if (connectInfo.qrDataUrl || !connectInfo.scannerUrl) {
      return
    }

    QRCode.toDataURL(connectInfo.scannerUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 12,
      color: {
        dark: '#050505',
        light: '#ffffff',
      },
    }).then((qrDataUrl) => {
      setConnectInfo((current) => ({ ...current, qrDataUrl }))
    })
  }, [connectInfo.qrDataUrl, connectInfo.scannerUrl])

  return (
    <main className="desktop-stage">
      <section className={`desktop-window ${page === 'settings' ? 'settings-window' : ''}`} aria-label="Phone Scan Desktop">
        <div className="titlebar">
          <div className="titlebar-left">
            <div className="app-mark small">
              <ScanBarcode size={18} strokeWidth={2.2} />
            </div>
            <span>Phone Scan</span>
          </div>
          <div className="window-controls" aria-hidden="true">
            <button type="button">
              <Minus size={17} />
            </button>
            <button type="button">
              <Square size={15} />
            </button>
            <button type="button">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className={`app-shell ${page === 'history' || page === 'help' ? 'history-shell' : ''}`}>
          <aside
            className={`sidebar ${page === 'history' || page === 'settings' || page === 'help' ? 'with-device' : ''} ${
              page === 'settings' ? 'settings-sidebar' : ''
            }`}
            aria-label="Main navigation"
          >
            <div className="sidebar-logo">
              <ScanBarcode size={66} strokeWidth={1.9} />
              {page === 'settings' && (
                <div className="sidebar-brand-text">
                  <strong>Phone Scan</strong>
                  <strong>Desktop</strong>
                </div>
              )}
            </div>

            <nav className="nav-list">
              <button
                className={`nav-item ${page === 'home' ? 'active' : ''}`}
                type="button"
                onClick={() => setPage('home')}
              >
                <Home size={26} fill={page === 'home' ? 'currentColor' : 'none'} strokeWidth={2.2} />
                <span>{page === 'settings' ? 'Connect' : 'Home'}</span>
              </button>
              <button
                className={`nav-item ${page === 'history' ? 'active' : ''}`}
                type="button"
                onClick={() => setPage('history')}
              >
                <Clock3
                  size={27}
                  fill={page === 'history' ? 'currentColor' : 'none'}
                  stroke={page === 'history' ? '#ffffff' : 'currentColor'}
                  strokeWidth={2.2}
                />
                <span>History</span>
              </button>
              <button
                className={`nav-item ${page === 'settings' ? 'active' : ''}`}
                type="button"
                onClick={() => setPage('settings')}
              >
                <Settings size={27} strokeWidth={2.2} />
                <span>Settings</span>
              </button>
              <button
                className={`nav-item ${page === 'help' ? 'active' : ''}`}
                type="button"
                onClick={() => setPage('help')}
              >
                <CircleHelp
                  size={27}
                  fill={page === 'help' ? 'currentColor' : 'none'}
                  stroke={page === 'help' ? '#ffffff' : 'currentColor'}
                  strokeWidth={2.2}
                />
                <span>Help</span>
              </button>
            </nav>

            {(page === 'history' || page === 'settings' || page === 'help') && (
              <section className="connected-device-card" aria-label="Connected phone">
                <div className="connected-status">
                  <span />
                  <strong>{connectInfo.connectedClients > 0 ? 'Connected' : 'Waiting'}</strong>
                </div>
                <div className="connected-device">
                  <Smartphone size={30} strokeWidth={1.9} />
                  <p>
                    {connectInfo.connectedClients > 0 ? `${connectInfo.connectedClients} phone connected` : 'No phone connected'}
                    <br />
                    {connectInfo.ipAddress}:{connectInfo.port}
                  </p>
                </div>
              </section>
            )}

            <div className="version">
              <span className="version-dot" />
              <span>v1.0.0</span>
              {page === 'settings' && <strong className="update-badge">Up to date</strong>}
            </div>
          </aside>

          {page === 'history' ? (
            <HistoryScreen rows={scanHistory} />
          ) : page === 'settings' ? (
            <SettingsScreen />
          ) : page === 'help' ? (
            <HelpScreen />
          ) : (
            <HomeScreen
              connectInfo={connectInfo}
              onCopyScannerUrl={copyScannerUrl}
              onOpenScannerPage={openScannerPage}
              onRefreshConnectInfo={refreshConnectInfo}
            />
          )}
        </div>
      </section>
    </main>
  )
}

function HomeScreen({
  connectInfo,
  onCopyScannerUrl,
  onOpenScannerPage,
  onRefreshConnectInfo,
}: {
  connectInfo: DesktopConnectInfo
  onCopyScannerUrl: () => void
  onOpenScannerPage: () => void
  onRefreshConnectInfo: () => void
}) {
  const isRunning = connectInfo.status === 'running'
  const hasPhone = connectInfo.connectedClients > 0

  return (
    <section className="content-panel">
      <div className="main-content">
        <header className="hero">
          <div className="app-mark hero-mark">
            <Smartphone size={66} strokeWidth={1.9} />
            <span className="hero-barcode" />
          </div>
          <div>
            <h1>Phone Scan</h1>
            <p>Connect your phone and scan directly into any focused input.</p>
          </div>
        </header>

        <div className="dashboard-grid">
          <div className="left-column">
            <section className="card status-card">
              <div className="server-status">
                <span className="check-badge">
                  <Check size={27} strokeWidth={3.2} />
                </span>
                <span>Local Server Status:</span>
                <strong>{isRunning ? 'Running' : connectInfo.status === 'error' ? 'Error' : 'Starting'}</strong>
              </div>

              <div className="info-list">
                <InfoRow icon={<Laptop />} label="PC IP Address" value={connectInfo.ipAddress} />
                <InfoRow icon={<Network />} label="Port" value={`${connectInfo.protocol.toUpperCase()} ${connectInfo.port}`} />
                <InfoRow icon={<Wifi />} label="Connection Method" value="Wi-Fi / USB Tethering" />
              </div>
            </section>

            <section className="card instructions-card">
              <div className="section-title">
                <FileText size={29} />
                <h2>Quick Instructions</h2>
              </div>
              <ol className="steps">
                <li>
                  <span>1</span>
                  <p>Open this tool</p>
                </li>
                <li>
                  <span>2</span>
                  <p>Scan the QR with your phone</p>
                </li>
                <li>
                  <span>3</span>
                  <p>Start scanning barcodes</p>
                </li>
              </ol>
            </section>
          </div>

          <div className="center-column">
            <section className="card qr-card">
              <h2>Scan with your phone to connect</h2>
              <div className="qr-frame">
                {connectInfo.qrDataUrl ? <img src={connectInfo.qrDataUrl} alt="Scanner connection QR" /> : null}
              </div>
            </section>

            <section className="card action-card">
              <button className="secondary-button" type="button" onClick={onRefreshConnectInfo}>
                <RefreshCw size={30} />
                <span>Refresh QR</span>
              </button>
              <button className="secondary-button" type="button" onClick={onCopyScannerUrl}>
                <Copy size={28} />
                <span>Copy Link</span>
              </button>
              <button className="primary-button" type="button" onClick={onOpenScannerPage}>
                <ExternalLink size={28} />
                <span>Open Scanner Page</span>
              </button>
            </section>
          </div>

          <section className="card phone-card">
            <div className="phone-status">
              <span className={`offline-dot ${hasPhone ? 'online-dot' : ''}`} />
              <span>Phone Status: <strong>{hasPhone ? 'Connected' : 'Not connected'}</strong></span>
            </div>

            <div className="phone-empty-state">
              <div className="phone-outline">
                <Smartphone size={168} strokeWidth={1.4} />
                <span className="link-bubble">
                  <Link2 size={34} strokeWidth={2.4} />
                </span>
              </div>
              <p>
                {hasPhone ? `${connectInfo.connectedClients} phone connected` : 'Your phone will appear here'}
                <br />
                {hasPhone ? `${connectInfo.ipAddress}:${connectInfo.port}` : 'once connected.'}
              </p>
            </div>
          </section>
        </div>
      </div>

      <footer className="footer-note">
        <ShieldCheck size={33} strokeWidth={2.2} />
        <span>No cloud server. No login. Local connection only.</span>
      </footer>
    </section>
  )
}

function HistoryScreen({ rows }: { rows: DesktopScanRecord[] }) {
  return (
    <section className="content-panel history-panel">
      <div className="history-content">
        <header className="history-header">
          <div>
            <h1>Scan History</h1>
            <p>All barcodes scanned from your phone</p>
          </div>

          <div className="history-actions">
            <button className="toolbar-button clear-button" type="button">
              <Trash2 size={25} strokeWidth={2.2} />
              <span>Clear All</span>
            </button>
            <button className="toolbar-button export-button" type="button">
              <Download size={26} strokeWidth={2.2} />
              <span>Export CSV</span>
            </button>
          </div>
        </header>

        <div className="history-tools">
          <label className="search-box" aria-label="Search barcode">
            <Search size={26} strokeWidth={1.9} />
            <input type="search" placeholder="Search barcode..." />
          </label>
          <span className="total-count">Total: {rows.length}</span>
        </div>

        <section className="history-table-card">
          <div className="history-table table-head">
            <span>#</span>
            <span>Barcode</span>
            <span>Time</span>
            <span>Status</span>
            <span>Action</span>
          </div>

          {rows.length === 0 && <div className="empty-history-row">No scans yet</div>}

          {rows.map((row, index) => (
            <div className="history-table table-row" key={row.id}>
              <span className="row-index">{index + 1}</span>
              <span className="barcode-cell">
                <strong>{row.barcode}</strong>
                <Copy size={21} strokeWidth={1.9} />
              </span>
              <span className="time-cell">{row.time}</span>
              <span>
                <StatusBadge status={row.status} />
              </span>
              <span className="row-actions">
                <button type="button" aria-label="Type barcode again">
                  <Play size={24} strokeWidth={1.8} />
                </button>
                <button type="button" aria-label="Copy barcode">
                  <Copy size={23} strokeWidth={1.8} />
                </button>
                <button type="button" aria-label="More actions">
                  <MoreVertical size={24} strokeWidth={1.9} />
                </button>
              </span>
            </div>
          ))}

          <footer className="table-pagination">
            <div className="pagination-pages">
              <button className="pager muted" type="button" aria-label="Previous page">
                <ChevronLeft size={23} />
              </button>
              <button className="pager active" type="button">1</button>
              <button className="pager" type="button">2</button>
              <button className="pager" type="button">3</button>
              <span>...</span>
              <button className="pager" type="button">4</button>
              <button className="pager" type="button" aria-label="Next page">
                <ChevronRight size={23} />
              </button>
            </div>

            <button className="page-size" type="button">
              <span>10 / page</span>
              <ChevronDown size={22} />
            </button>
          </footer>
        </section>
      </div>
    </section>
  )
}

function StatusBadge({ status }: { status: DesktopScanStatus }) {
  const failed = status === 'Failed'

  return (
    <span className={`status-badge ${failed ? 'failed' : 'typed'}`}>
      {failed ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}
      <strong>{status}</strong>
    </span>
  )
}

function SettingsScreen() {
  return (
    <section className="content-panel settings-panel">
      <div className="settings-content">
        <header className="settings-header">
          <h1>Settings</h1>
          <p>Customize how the app works</p>
        </header>

        <div className="settings-grid">
          <section className="settings-card typing-card">
            <CardTitle icon={<Keyboard size={25} />} title="Typing Options" />
            <SettingsRow title="Auto Enter" description="Automatically press Enter after typing">
              <Toggle checked />
            </SettingsRow>
            <SettingsRow title="Auto Tab" description="Automatically press Tab after typing">
              <Toggle />
            </SettingsRow>
            <SettingsRow title="Suffix" description="Add suffix after typing">
              <SelectButton value="Enter" />
            </SettingsRow>
            <SettingsRow title="Prefix" description="Add prefix before typing">
              <input className="settings-input prefix-input" value="Enter prefix (optional)" readOnly />
            </SettingsRow>
            <SettingsRow title="Typing Delay" description="Delay between keystrokes (ms)" last>
              <NumberInput value="10" />
            </SettingsRow>
          </section>

          <div className="right-settings-column">
            <section className="settings-card connection-card">
              <CardTitle icon={<Wifi size={25} />} title="Connection Settings" />
              <SettingsRow title="Port" description="Local server port">
                <NumberInput value="8787" wide />
              </SettingsRow>
              <SettingsRow title="Start Server on Launch" description="Automatically start local server when app launches" last>
                <Toggle checked />
              </SettingsRow>
            </section>

            <section className="settings-card general-card">
              <CardTitle icon={<Settings size={25} />} title="General" />
              <SettingsRow title="Start with Windows" description="Run app automatically when Windows starts">
                <Toggle />
              </SettingsRow>
              <SettingsRow title="Minimize to Tray" description="Minimize app to system tray instead of closing">
                <Toggle checked />
              </SettingsRow>
              <SettingsRow title="Theme" description="Choose app appearance" last>
                <SelectButton value="Light" wide />
              </SettingsRow>
            </section>
          </div>
        </div>

        <section className="settings-card advanced-card">
          <CardTitle icon={<Wrench size={25} />} title="Advanced" />
          <div className="advanced-note">
            <Info size={23} />
            <span>Advanced options are for experienced users. Changing these settings may affect app behavior.</span>
          </div>
          <button className="advanced-button" type="button">
            <span>Show Advanced Options</span>
            <ChevronDown size={19} />
          </button>
        </section>
      </div>

      <footer className="settings-footer">
        <button className="reset-button" type="button">Reset to Default</button>
        <button className="save-button" type="button">
          <Save size={22} />
          <span>Save Settings</span>
        </button>
      </footer>
    </section>
  )
}

function HelpScreen() {
  const quickStartItems = [
    ['Open Desktop Tool', 'Launch Phone Scan on your computer.'],
    ['Scan QR with your phone', 'Use your phone to scan the QR code on the Home screen.'],
    ['Click the focused input', 'Place the cursor in any input field you want to fill.'],
    ['Start scanning barcodes', 'Scan barcodes and watch them appear in the input.'],
  ]

  const issues = [
    { icon: <AlertCircle />, title: 'Phone cannot connect', description: 'Check that both devices are on the same network or USB is connected.', tone: 'red' },
    { icon: <LockKeyhole />, title: 'Camera permission denied', description: 'Allow camera permission to scan the QR code.', tone: 'orange' },
    { icon: <QrCode />, title: 'QR not opening', description: 'Use your default browser or try scanning again.', tone: 'amber' },
    { icon: <ScanBarcode />, title: 'Barcode not typed into input', description: 'Make sure the input is focused before scanning.', tone: 'rose' },
  ]

  const tips = [
    ['Keep both devices on the same network', 'This ensures a stable and fast connection.'],
    ['Click the input before scanning', 'The scanned data will be typed into the focused field.'],
    ['Allow the app through firewall if needed', 'This helps maintain a reliable connection.'],
    ['Keep the app running in the background', 'Closing the app will stop the connection.'],
  ]

  return (
    <section className="content-panel help-panel">
      <div className="help-content">
        <header className="help-header">
          <h1>Help &amp; Troubleshooting</h1>
          <p>Guides to connect and scan smoothly.</p>
        </header>

        <div className="help-grid">
          <section className="help-card quick-start-card">
            <HelpCardTitle icon={<Rocket size={31} />} title="Quick Start" />
            <ol className="quick-start-list">
              {quickStartItems.map(([title, description], index) => (
                <li key={title}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="help-card connection-methods-card">
            <HelpCardTitle icon={<Wifi size={30} />} title="Connection Methods" />
            <div className="method-card">
              <Wifi size={46} />
              <div>
                <strong>Wi-Fi</strong>
                <p>Connect both devices to the same Wi-Fi network.</p>
                <p>Recommended for most users.</p>
              </div>
            </div>
            <div className="method-card">
              <Usb size={48} />
              <div>
                <strong>USB Tethering</strong>
                <p>Connect your phone via USB and enable</p>
                <p>USB Tethering for a stable connection.</p>
              </div>
            </div>
            <div className="connection-note">
              <Info size={22} />
              <span>You can change the connection method on the Home screen.</span>
            </div>
          </section>

          <section className="help-card common-issues-card">
            <HelpCardTitle icon={<AlertTriangle size={31} />} title="Common Issues" />
            <div className="issue-list">
              {issues.map((issue) => (
                <button className="issue-item" type="button" key={issue.title}>
                  <span className={`issue-icon ${issue.tone}`}>{issue.icon}</span>
                  <span>
                    <strong>{issue.title}</strong>
                    <small>{issue.description}</small>
                  </span>
                  <ChevronDown size={21} />
                </button>
              ))}
            </div>
          </section>

          <section className="help-card tips-card">
            <HelpCardTitle icon={<Lightbulb size={31} />} title="Tips & Best Practices" />
            <div className="tips-list">
              {tips.map(([title, description]) => (
                <div className="tip-item" key={title}>
                  <CheckCircle2 size={26} />
                  <div>
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="help-action-bar">
          <button type="button">
            <BookOpen size={25} />
            <span>Open Docs</span>
          </button>
          <button type="button">
            <Link2 size={25} />
            <span>Copy Local URL</span>
          </button>
          <button type="button">
            <RefreshCw size={25} />
            <span>Restart Server</span>
          </button>
        </section>
      </div>
    </section>
  )
}

function HelpCardTitle({ icon, title }: { icon: ReactElement; title: string }) {
  return (
    <div className="help-card-title">
      {icon}
      <h2>{title}</h2>
    </div>
  )
}

function CardTitle({ icon, title }: { icon: ReactElement; title: string }) {
  return (
    <div className="settings-card-title">
      {icon}
      <h2>{title}</h2>
    </div>
  )
}

function SettingsRow({
  title,
  description,
  children,
  last = false,
}: {
  title: string
  description: string
  children: ReactElement
  last?: boolean
}) {
  return (
    <div className={`settings-row ${last ? 'last' : ''}`}>
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      {children}
    </div>
  )
}

function Toggle({ checked = false }: { checked?: boolean }) {
  return (
    <span className={`toggle ${checked ? 'checked' : ''}`} aria-hidden="true">
      <span />
    </span>
  )
}

function SelectButton({ value, wide = false }: { value: string; wide?: boolean }) {
  return (
    <button className={`select-button ${wide ? 'wide' : ''}`} type="button">
      <span>{value}</span>
      <ChevronDown size={22} />
    </button>
  )
}

function NumberInput({ value, wide = false }: { value: string; wide?: boolean }) {
  return (
    <button className={`number-input ${wide ? 'wide' : ''}`} type="button">
      <span>{value}</span>
      <span className="number-steppers">
        <ChevronDown className="up" size={17} />
        <ChevronDown size={17} />
      </span>
    </button>
  )
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactElement
  label: string
  value: string
}) {
  return (
    <div className="info-row">
      <span className="info-icon">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  )
}

export default App
