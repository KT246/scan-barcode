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

export type DesktopApi = {
  getConnectInfo: () => Promise<DesktopConnectInfo>
  refreshConnectInfo: () => Promise<DesktopConnectInfo>
  getScanHistory: () => Promise<DesktopScanRecord[]>
  openScannerPage: () => Promise<void>
  onConnectInfoChanged: (callback: (info: DesktopConnectInfo) => void) => () => void
  onScanReceived: (callback: (record: DesktopScanRecord) => void) => () => void
}
