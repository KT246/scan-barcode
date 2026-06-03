export type DesktopServerStatus = 'starting' | 'running' | 'error'

export type DesktopConnectInfo = {
  status: DesktopServerStatus
  computerName: string
  ipAddress: string
  port: number
  protocol: 'http' | 'https'
  scannerUrl: string
  certificateUrl: string
  trustUrl: string
  qrDataUrl: string
  tokenPreview: string
  connectedClients: number
  error?: string
}

export type DesktopScanStatus = 'Typed' | 'Failed'

export type DesktopScanRecord = {
  id: string
  barcode: string
  type: 'barcode' | 'qr' | 'manual'
  timestamp: number
  time: string
  status: DesktopScanStatus
  error?: string
}

export type DesktopTypingSuffix = 'none' | 'enter' | 'tab'

export type DesktopLanguage = 'en' | 'lo'

export type DesktopTypingSettings = {
  autoEnter: boolean
  autoTab: boolean
  suffix: DesktopTypingSuffix
  typingDelayMs: number
}

export type DesktopAppSettings = DesktopTypingSettings & {
  language: DesktopLanguage
  hasChosenLanguage: boolean
}

export type DesktopApi = {
  getConnectInfo: () => Promise<DesktopConnectInfo>
  refreshConnectInfo: () => Promise<DesktopConnectInfo>
  getScanHistory: () => Promise<DesktopScanRecord[]>
  getSettings: () => Promise<DesktopAppSettings>
  updateSettings: (settings: DesktopAppSettings) => Promise<DesktopAppSettings>
  openScannerPage: () => Promise<void>
  minimizeWindow: () => Promise<void>
  toggleMaximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  onConnectInfoChanged: (callback: (info: DesktopConnectInfo) => void) => () => void
  onScanReceived: (callback: (record: DesktopScanRecord) => void) => () => void
}
