export const SOCKET_EVENTS = {
  CONNECT_PHONE: 'phone:connect',
  PHONE_CONNECTED: 'phone:connected',
  PHONE_DISCONNECTED: 'phone:disconnected',
  BARCODE_SCANNED: 'barcode:scanned',
  BARCODE_RECEIVED: 'barcode:received',
  ERROR: 'error',
} as const
