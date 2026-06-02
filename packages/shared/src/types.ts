export type ConnectionStatus = 'waiting' | 'connected' | 'disconnected'

export type ScanPayload = {
  token: string
  value: string
  type: 'barcode' | 'qr'
  timestamp: number
}

export type ToolSettings = {
  autoEnter: boolean
  autoTab: boolean
  typingDelayMs: number
  suffix: 'none' | 'enter' | 'tab'
}
