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
import type {
  DesktopConnectInfo,
  DesktopScanRecord,
  DesktopScanStatus,
  DesktopTypingSettings,
  DesktopTypingSuffix,
} from './shared/desktop-api'

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
type SettingsSaveState = 'idle' | 'saving' | 'saved' | 'error'

function App() {
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
  const minimizeWindow = () => {
    void window.phoneScan?.minimizeWindow()
  }
  const toggleMaximizeWindow = () => {
    void window.phoneScan?.toggleMaximizeWindow()
  }
  const closeWindow = () => {
    if (window.phoneScan) {
      void window.phoneScan.closeWindow()
      return
    }

    window.close()
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
      <section className="desktop-window" aria-label="Phone Scan Desktop">
        <div className="titlebar">
          <div className="titlebar-left">
            <div className="app-mark small">
              <ScanBarcode size={18} strokeWidth={2.2} />
            </div>
            <span>Phone Scan</span>
          </div>
          <div className="window-controls" aria-hidden="true">
            <button type="button" onClick={minimizeWindow}>
              <Minus size={17} />
            </button>
            <button type="button" onClick={toggleMaximizeWindow}>
              <Square size={15} />
            </button>
            <button type="button" onClick={closeWindow}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="app-shell">
          <aside className="sidebar" aria-label="Main navigation">
            <div className="sidebar-logo">
              <ScanBarcode size={66} strokeWidth={1.9} />
            </div>

            <nav className="nav-list">
              <div className="nav-item active" aria-current="page">
                <Home size={26} fill="currentColor" strokeWidth={2.2} />
                <span>Home</span>
              </div>
            </nav>

            <div className="version">
              <span className="version-dot" />
              <span>v1.0.0</span>
            </div>
          </aside>

          <HomeScreen
            connectInfo={connectInfo}
            latestScan={scanHistory[0] ?? null}
            onCopyScannerUrl={copyScannerUrl}
            onOpenScannerPage={openScannerPage}
            onRefreshConnectInfo={refreshConnectInfo}
          />
        </div>
      </section>
    </main>
  )
}

function HomeScreen({
  connectInfo,
  latestScan,
  onCopyScannerUrl,
  onOpenScannerPage,
  onRefreshConnectInfo,
}: {
  connectInfo: DesktopConnectInfo
  latestScan: DesktopScanRecord | null
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

            <DesktopFlowCard connectInfo={connectInfo} latestScan={latestScan} />
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

function DesktopFlowCard({
  connectInfo,
  latestScan,
}: {
  connectInfo: DesktopConnectInfo
  latestScan: DesktopScanRecord | null
}) {
  const hasPhone = connectInfo.connectedClients > 0
  const typed = latestScan?.status === 'Typed'
  const typingFailed = latestScan?.status === 'Failed'

  return (
    <section className="card desktop-flow-card">
      <div className="section-title">
        <ScanBarcode size={25} />
        <h2>Live Flow</h2>
      </div>

      <div className="flow-status-list">
        <FlowStatusRow
          label="Phone connected"
          status={hasPhone ? 'Connected' : 'Waiting'}
          tone={hasPhone ? 'good' : 'neutral'}
          detail={hasPhone ? `${connectInfo.connectedClients} phone online` : 'Scan the QR from your phone'}
        />
        <FlowStatusRow
          label="Barcode received"
          status={latestScan ? 'Received' : 'Waiting'}
          tone={latestScan ? 'good' : 'neutral'}
          detail={latestScan ? latestScan.barcode : 'No barcode received yet'}
        />
        <FlowStatusRow
          label="Typed result"
          status={typed ? 'Typed' : typingFailed ? 'Failed' : 'Waiting'}
          tone={typed ? 'good' : typingFailed ? 'bad' : 'neutral'}
          detail={latestScan?.error ?? (typed ? 'Typed into focused input' : 'Click a target input before scanning')}
        />
      </div>
    </section>
  )
}

function FlowStatusRow({
  label,
  status,
  detail,
  tone,
}: {
  label: string
  status: string
  detail: string
  tone: 'good' | 'bad' | 'neutral'
}) {
  return (
    <div className={`flow-status-row ${tone}`}>
      <span className="flow-dot" />
      <div>
        <strong>{label}</strong>
        <p>{detail}</p>
      </div>
      <em>{status}</em>
    </div>
  )
}

function HistoryScreen({ rows }: { rows: DesktopScanRecord[] }) {
  return (
    <section className="content-panel history-panel">
      <div className="history-content">
        <header className="history-header">
          <div>
            <h1>Scan History</h1>
            <p>Latest barcodes received from the phone scanner.</p>
          </div>

          <span className="total-count">Total: {rows.length}</span>
        </header>

        <section className="history-table-card">
          <div className="history-table table-head">
            <span>#</span>
            <span>Barcode</span>
            <span>Type</span>
            <span>Time</span>
            <span>Status</span>
            <span>Copy</span>
          </div>

          {rows.length === 0 && <div className="empty-history-row">No scans yet</div>}

          {rows.map((row, index) => (
            <div className="history-table table-row" key={row.id}>
              <span className="row-index">{index + 1}</span>
              <span className="barcode-cell">
                <strong>{row.barcode}</strong>
              </span>
              <span className="type-cell">{row.type}</span>
              <span className="time-cell">{row.time}</span>
              <span>
                <StatusBadge status={row.status} />
              </span>
              <span className="row-actions">
                <button type="button" aria-label="Copy barcode" onClick={() => navigator.clipboard?.writeText(row.barcode)}>
                  <Copy size={23} strokeWidth={1.8} />
                </button>
              </span>
            </div>
          ))}
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

function SettingsScreen({
  connectInfo,
  saveState,
  settings,
  onUpdateSettings,
}: {
  connectInfo: DesktopConnectInfo
  saveState: SettingsSaveState
  settings: DesktopTypingSettings
  onUpdateSettings: (settings: DesktopTypingSettings) => void
}) {
  const setSuffix = (suffix: DesktopTypingSuffix) => {
    onUpdateSettings({
      ...settings,
      autoEnter: suffix === 'enter',
      autoTab: suffix === 'tab',
      suffix,
    })
  }

  return (
    <section className="content-panel settings-panel">
      <div className="settings-content">
        <header className="settings-header">
          <div>
            <h1>Settings</h1>
            <p>Control how scanned barcode data is typed into the focused input.</p>
          </div>
          <span className={`settings-save-state ${saveState}`}>{saveState === 'idle' ? 'Ready' : saveState}</span>
        </header>

        <div className="settings-grid">
          <section className="settings-card typing-card">
            <CardTitle icon={<Keyboard size={25} />} title="Typing Behavior" />
            <SettingsRow title="Auto Enter" description="Press Enter after each barcode is typed">
              <Toggle checked={settings.autoEnter} onChange={(checked) => setSuffix(checked ? 'enter' : 'none')} />
            </SettingsRow>
            <SettingsRow title="Auto Tab" description="Tab is disabled while Auto Enter is active">
              <Toggle checked={settings.autoTab} onChange={(checked) => setSuffix(checked ? 'tab' : 'none')} />
            </SettingsRow>
            <SettingsRow title="Suffix" description="Choose what key is pressed after typing">
              <SuffixSelect value={settings.suffix} onChange={setSuffix} />
            </SettingsRow>
            <SettingsRow title="Typing Delay" description="Delay before typing after barcode is received" last>
              <DelayInput
                value={settings.typingDelayMs}
                onChange={(typingDelayMs) => onUpdateSettings({ ...settings, typingDelayMs })}
              />
            </SettingsRow>
          </section>

          <div className="right-settings-column">
            <section className="settings-card connection-card">
              <CardTitle icon={<Wifi size={25} />} title="Local Server" />
              <SettingsRow title="Protocol" description="Local HTTPS is used so the phone camera can open">
                <ReadOnlyValue value={connectInfo.protocol.toUpperCase()} />
              </SettingsRow>
              <SettingsRow title="Port" description="Phone connects to this local desktop port">
                <ReadOnlyValue value={String(connectInfo.port)} />
              </SettingsRow>
              <SettingsRow title="IP Address" description="Current local address shown in the QR code" last>
                <ReadOnlyValue value={connectInfo.ipAddress} wide />
              </SettingsRow>
            </section>

            <section className="settings-card general-card">
              <CardTitle icon={<ShieldCheck size={25} />} title="Connection Requirements" />
              <SettingsRow title="Network" description="Phone and desktop must be on the same Wi-Fi or USB tethering">
                <ReadOnlyValue value="Local only" wide />
              </SettingsRow>
              <SettingsRow title="Certificate" description="Install local certificate if phone camera is blocked" last>
                <ReadOnlyValue value="HTTPS setup" wide />
              </SettingsRow>
            </section>
          </div>
        </div>
      </div>
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

function ReadOnlyValue({ value, tone = 'neutral', wide = false }: { value: string; tone?: 'neutral' | 'green'; wide?: boolean }) {
  return <span className={`readonly-value ${tone} ${wide ? 'wide' : ''}`}>{value}</span>
}

function Toggle({ checked = false, onChange }: { checked?: boolean; onChange?: (checked: boolean) => void }) {
  return (
    <button className={`toggle ${checked ? 'checked' : ''}`} type="button" aria-pressed={checked} onClick={() => onChange?.(!checked)}>
      <span />
    </button>
  )
}

function SuffixSelect({ value, onChange }: { value: DesktopTypingSuffix; onChange: (value: DesktopTypingSuffix) => void }) {
  return (
    <select className="settings-select" value={value} onChange={(event) => onChange(event.target.value as DesktopTypingSuffix)}>
      <option value="none">None</option>
      <option value="enter">Enter</option>
      <option value="tab">Tab</option>
    </select>
  )
}

function DelayInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <input
      className="settings-input delay-input"
      max={1000}
      min={0}
      step={10}
      type="number"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
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
