import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { io, type Socket } from 'socket.io-client'
import {
  Barcode,
  Download,
  Info,
  Languages,
  Link2,
  Monitor,
  Send,
  Settings,
  ScanLine,
  Smartphone,
  Wifi,
  X,
} from 'lucide-react'

type MobilePage = 'connect' | 'scanner' | 'settings'
type AppLanguage = 'en' | 'lo'

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

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type ScannerSettings = {
  autoSend: boolean
  duplicateLock: boolean
  enable1D: boolean
  enable2D: boolean
  scanIntervalMs: number
  stableRead: boolean
}

const appLanguageStorageKey = 'phone-scan.language'
const scannerSettingsStorageKey = 'phone-scan.scanner-settings'
const scanIntervalOptions = [2000, 3000, 5000, 10000]
const defaultScannerSettings: ScannerSettings = {
  autoSend: true,
  duplicateLock: true,
  enable1D: true,
  enable2D: true,
  scanIntervalMs: 2000,
  stableRead: true,
}
const oneDimensionalScanFormats = [
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.CODABAR,
  BarcodeFormat.EAN_8,
  BarcodeFormat.EAN_13,
  BarcodeFormat.ITF,
  BarcodeFormat.RSS_14,
  BarcodeFormat.RSS_EXPANDED,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.UPC_EAN_EXTENSION,
]
const twoDimensionalScanFormats = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.AZTEC,
  BarcodeFormat.PDF_417,
  BarcodeFormat.MAXICODE,
]
const barcodeReaderOptions = {
  delayBetweenScanAttempts: 45,
  delayBetweenScanSuccess: 260,
  tryPlayVideoTimeout: 3000,
}
const stableScanWindowMs = 900
const scanMessageThrottleMs = 700
const barcodeVideoConstraints: MediaStreamConstraints = {
  video: {
    facingMode: {
      ideal: 'environment',
    },
    width: {
      ideal: 1920,
    },
    height: {
      ideal: 1080,
    },
    frameRate: {
      ideal: 30,
    },
  },
}

function getScanType(format: BarcodeFormat | null | undefined): LastScan['type'] {
  return format === BarcodeFormat.QR_CODE ? 'qr' : 'barcode'
}

function getEnabledScanFormats(settings: ScannerSettings) {
  return [
    ...(settings.enable1D ? oneDimensionalScanFormats : []),
    ...(settings.enable2D ? twoDimensionalScanFormats : []),
  ]
}

function createBarcodeReaderHints(enabledFormats: BarcodeFormat[]) {
  return new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, enabledFormats],
    [DecodeHintType.TRY_HARDER, true],
    [DecodeHintType.ENABLE_CODE_39_EXTENDED_MODE, true],
    [DecodeHintType.ASSUME_GS1, true],
    [DecodeHintType.RETURN_CODABAR_START_END, true],
  ])
}

function isSupportedScanFormat(format: BarcodeFormat | null | undefined, enabledFormats: BarcodeFormat[]) {
  return format == null || enabledFormats.includes(format)
}

function getNearestScanIntervalMs(value: unknown) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return defaultScannerSettings.scanIntervalMs
  }

  return scanIntervalOptions.reduce((nearest, option) => (
    Math.abs(option - numericValue) < Math.abs(nearest - numericValue) ? option : nearest
  ), scanIntervalOptions[0])
}

function isDigits(value: string) {
  return /^\d+$/.test(value)
}

function hasValidWeightedChecksum(value: string, evenPositionWeight: number, oddPositionWeight: number) {
  if (!isDigits(value) || value.length < 2) {
    return false
  }

  const expectedCheckDigit = Number(value[value.length - 1])
  const body = value.slice(0, -1)
  const sum = [...body].reduce((total, digit, index) => {
    const positionFromRight = body.length - index
    const weight = positionFromRight % 2 === 0 ? evenPositionWeight : oddPositionWeight

    return total + Number(digit) * weight
  }, 0)
  const actualCheckDigit = (10 - (sum % 10)) % 10

  return actualCheckDigit === expectedCheckDigit
}

function hasValidEanChecksum(value: string) {
  return hasValidWeightedChecksum(value, 1, 3)
}

function hasValidUpcAChecksum(value: string) {
  return hasValidWeightedChecksum(value, 1, 3)
}

function isValidScanValue(value: string, format: BarcodeFormat | null | undefined) {
  switch (format) {
    case BarcodeFormat.EAN_13:
      return value.length === 13 && hasValidEanChecksum(value)
    case BarcodeFormat.EAN_8:
      return value.length === 8 && hasValidEanChecksum(value)
    case BarcodeFormat.UPC_A:
      return value.length === 12 && hasValidUpcAChecksum(value)
    case BarcodeFormat.UPC_E:
      return isDigits(value) && (value.length === 6 || value.length === 8)
    case BarcodeFormat.UPC_EAN_EXTENSION:
      return isDigits(value) && (value.length === 2 || value.length === 5)
    case BarcodeFormat.ITF:
      return isDigits(value) && value.length >= 2 && value.length % 2 === 0
    case BarcodeFormat.RSS_14:
    case BarcodeFormat.RSS_EXPANDED:
      return isDigits(value)
    default:
      return true
  }
}

const pwaText = {
  en: {
    appName: 'Phone Scan',
    languageLabel: 'Language',
    english: 'English',
    lao: 'ລາວ',
    scannerTab: 'Scanner',
    connectTab: 'Connect',
    settingsTab: 'Settings',
    connected: 'Connected',
    notConnected: 'Not Connected',
    offline: 'Offline',
    waitingForDesktop: 'Waiting for desktop',
    connectedTo: 'Connected to:',
    noDesktopQrScanned: 'No desktop QR scanned',
    missingDesktopToken: 'Missing desktop token.',
    scanQrOrIp: 'Scan QR code or enter IP to connect',
    connectionStatus: 'Connection Status',
    desktopQrScanner: 'Desktop QR Scanner',
    scanDesktopQrHere: 'Scan desktop QR here',
    desktopQrHint: 'This scanner only connects the phone to Phone Scan Desktop.',
    scanQrShown: 'Scan the QR code shown in the desktop app.',
    stopQrScanner: 'Stop QR Scanner',
    scanDesktopQr: 'Scan Desktop QR',
    beforeScanning: 'Before scanning',
    stepWifi: 'Keep phone and desktop on the same Wi-Fi network.',
    stepScanQr: 'Scan the QR from Phone Scan Desktop on this Connect page.',
    stepUseScanner: 'After connected, use Scanner for product barcodes only.',
    openBarcodeScanner: 'Open Barcode Scanner',
    desktopReady: 'Desktop is connected. You can open the barcode scanner.',
    installPwaTitle: 'Install on this phone',
    installPwaBody: 'Add Phone Scan to your home screen for faster scanning.',
    installPwaButton: 'Install app',
    installPwaManualHint: 'If install is not available, open the browser menu and choose Add to Home Screen.',
    connectionQrScannerStopped: 'Connection QR scanner stopped.',
    cameraNeedsHttpsConnect: 'Camera needs HTTPS. Open this page from HTTPS before scanning the desktop QR.',
    scanningDesktopConnectionQr: 'Scanning desktop connection QR...',
    invalidDesktopQr: 'This is not a Phone Scan desktop QR. Use the QR shown in the desktop app.',
    desktopQrDetected: 'Desktop QR detected. Opening local scanner...',
    cameraUnavailable: 'Camera unavailable.',
    cameraNeedsTrustedHttps: 'Camera needs trusted HTTPS',
    installCertificate: 'Install the Phone Scan local certificate on this phone, then reopen the scanner.',
    setup: 'Setup',
    trustedHttpsMessage: 'Camera needs trusted HTTPS. Install the Phone Scan certificate, then reopen this page.',
    alignBarcode: 'Align the code within the frame.',
    scanningBarcodeOnly: 'Scanning 1D and 2D codes...',
    qrIgnored: 'Phone Scan connection QR ignored. Use the Connect tab for desktop QR.',
    duplicateBarcodeIgnored: 'Duplicate barcode ignored.',
    autoSendOff: 'Barcode scanned. Auto send is off.',
    barcodeScannedNoDesktop: 'Barcode scanned, but desktop is not connected.',
    barcodeSending: 'Barcode scanned. Sending to desktop...',
    desktopTypedBarcode: 'Desktop received and typed the barcode.',
    desktopReceivedTypingFailed: 'Desktop received it, but typing failed. Check focused input.',
    couldNotSendBarcode: 'Could not send barcode. Check connection, firewall, or QR IP.',
    startingScanner: 'Starting barcode scanner',
    scannerAutoStarts: 'Scanner starts automatically on this tab.',
    lastScanned: 'Last scanned',
    noBarcodeYet: 'No barcode yet',
    today: 'Today',
    waitingForScan: 'Waiting for scan',
    sendAgain: 'Send Again',
    status: 'Status',
    noBarcodeSent: 'No barcode sent yet.',
    noBarcodeValue: 'No barcode value to send.',
    openConnectScanAgain: 'Open Connect and scan the desktop QR again.',
    sendingBarcode: 'Sending barcode to desktop...',
    desktopReceivedTypingFailedShort: 'Desktop received the barcode, but typing failed.',
    couldNotSendDesktop: 'Could not send barcode to desktop.',
    networkFailed: 'Network request failed.',
    scannerSettings: 'Scanner Settings',
    barcodeOnlyBehavior: 'Choose which code formats the camera should read.',
    scanFormats: 'Scan formats',
    scanFormatsHint: 'Turn on only the formats you need for faster scanning.',
    enable1D: '1D barcodes',
    enable1DHint: 'EAN, UPC, Code 128, Code 39, ITF and similar barcodes.',
    enable2D: '2D codes',
    enable2DHint: 'QR, Data Matrix, Aztec, PDF417 and similar codes.',
    scanInterval: 'Scan interval',
    scanIntervalHint: 'Minimum delay before accepting the next code.',
    stableRead: 'Stable read',
    stableReadHint: 'Confirm the same code twice before accepting it.',
    confirmingScan: 'Confirming code...',
    invalidBarcodeIgnored: 'Invalid barcode ignored.',
    waitingNextScan: 'Waiting {seconds}s before next scan.',
    ignoreDuplicates: 'Ignore duplicates',
    ignoreDuplicatesHint: 'Block the same barcode while it stays in frame.',
    autoSend: 'Auto send',
    autoSendHint: 'Send each barcode to desktop after reading.',
    debugStatus: 'Debug Status',
    server: 'Server',
    token: 'Token',
    exists: 'Exists',
    missing: 'Missing',
    socket: 'Socket',
    lastScan: 'Last Scan',
    none: 'None',
    lastSend: 'Last Send',
    typedResult: 'Typed Result',
    typed: 'Typed',
    receivedOnly: 'Received only',
    sending: 'Sending',
    notTyped: 'Not typed',
    error: 'Error',
    channel: 'Channel',
  },
  lo: {
    appName: 'Phone Scan',
    languageLabel: 'ພາສາ',
    english: 'English',
    lao: 'ລາວ',
    scannerTab: 'ສະແກນ',
    connectTab: 'ເຊື່ອມຕໍ່',
    settingsTab: 'ຕັ້ງຄ່າ',
    connected: 'ເຊື່ອມຕໍ່ແລ້ວ',
    notConnected: 'ຍັງບໍ່ເຊື່ອມຕໍ່',
    offline: 'ອອບໄລນ໌',
    waitingForDesktop: 'ລໍຖ້າເຄື່ອງຄອມ',
    connectedTo: 'ເຊື່ອມຕໍ່ກັບ:',
    noDesktopQrScanned: 'ຍັງບໍ່ໄດ້ສະແກນ QR ຈາກຄອມ',
    missingDesktopToken: 'ບໍ່ພົບ token ຈາກເຄື່ອງຄອມ.',
    scanQrOrIp: 'ສະແກນ QR ຫຼື ປ້ອນ IP ເພື່ອເຊື່ອມຕໍ່',
    connectionStatus: 'ສະຖານະການເຊື່ອມຕໍ່',
    desktopQrScanner: 'ສະແກນ QR ຈາກຄອມ',
    scanDesktopQrHere: 'ສະແກນ QR ຈາກຄອມທີ່ນີ້',
    desktopQrHint: 'ສະແກນນີ້ໃຊ້ເພື່ອເຊື່ອມກັບ Phone Scan Desktop ເທົ່ານັ້ນ.',
    scanQrShown: 'ສະແກນ QR ທີ່ສະແດງໃນແອັບ desktop.',
    stopQrScanner: 'ຢຸດສະແກນ QR',
    scanDesktopQr: 'ສະແກນ QR ຈາກຄອມ',
    beforeScanning: 'ກ່ອນສະແກນ',
    stepWifi: 'ໃຫ້ໂທລະສັບ ແລະ ຄອມຢູ່ Wi-Fi ດຽວກັນ.',
    stepScanQr: 'ສະແກນ QR ຈາກ Phone Scan Desktop ໃນໜ້າ Connect.',
    stepUseScanner: 'ຫຼັງຈາກເຊື່ອມແລ້ວ ໃຊ້ Scanner ເພື່ອສະແກນລະຫັດ 1D ແລະ 2D.',
    openBarcodeScanner: 'ເປີດສະແກນ Barcode',
    desktopReady: 'ເຄື່ອງຄອມເຊື່ອມຕໍ່ແລ້ວ. ສາມາດເປີດສະແກນ barcode ໄດ້.',
    installPwaTitle: 'ຕິດຕັ້ງໃນໂທລະສັບນີ້',
    installPwaBody: 'ເພີ່ມ Phone Scan ໄວ້ໜ້າຈໍຫຼັກ ເພື່ອສະແກນໄດ້ໄວຂຶ້ນ.',
    installPwaButton: 'ຕິດຕັ້ງແອັບ',
    installPwaManualHint: 'ຖ້າບໍ່ມີປຸ່ມຕິດຕັ້ງ ໃຫ້ເປີດເມນູ browser ແລ້ວເລືອກ Add to Home Screen.',
    connectionQrScannerStopped: 'ຢຸດສະແກນ QR ເຊື່ອມຕໍ່ແລ້ວ.',
    cameraNeedsHttpsConnect: 'ກ້ອງຕ້ອງໃຊ້ HTTPS. ເປີດໜ້ານີ້ຜ່ານ HTTPS ກ່ອນສະແກນ QR ຈາກຄອມ.',
    scanningDesktopConnectionQr: 'ກຳລັງສະແກນ QR ເຊື່ອມຕໍ່ຈາກຄອມ...',
    invalidDesktopQr: 'ນີ້ບໍ່ແມ່ນ QR ຂອງ Phone Scan Desktop. ໃຊ້ QR ທີ່ສະແດງໃນ desktop app.',
    desktopQrDetected: 'ພົບ QR ຈາກຄອມ. ກຳລັງເປີດສະແກນ local...',
    cameraUnavailable: 'ເປີດກ້ອງບໍ່ໄດ້.',
    cameraNeedsTrustedHttps: 'ກ້ອງຕ້ອງການ HTTPS ທີ່ໄວ້ໃຈໄດ້',
    installCertificate: 'ຕິດຕັ້ງ certificate ຂອງ Phone Scan ໃນໂທລະສັບນີ້ ແລ້ວເປີດ scanner ອີກຄັ້ງ.',
    setup: 'ຕັ້ງຄ່າ',
    trustedHttpsMessage: 'ກ້ອງຕ້ອງການ HTTPS ທີ່ໄວ້ໃຈໄດ້. ຕິດຕັ້ງ certificate ແລ້ວເປີດໜ້ານີ້ອີກຄັ້ງ.',
    alignBarcode: 'ວາງລະຫັດໃຫ້ຢູ່ໃນກອບ.',
    scanningBarcodeOnly: 'ກຳລັງສະແກນລະຫັດ 1D ແລະ 2D...',
    qrIgnored: 'ຂ້າມ QR ເຊື່ອມຕໍ່ Phone Scan. ໃຊ້ໜ້າ Connect ສຳລັບ QR ຈາກຄອມ.',
    duplicateBarcodeIgnored: 'ຂ້າມ barcode ທີ່ຊ້ຳ.',
    autoSendOff: 'ສະແກນ barcode ແລ້ວ. Auto send ປິດຢູ່.',
    barcodeScannedNoDesktop: 'ສະແກນ barcode ແລ້ວ ແຕ່ desktop ຍັງບໍ່ເຊື່ອມ.',
    barcodeSending: 'ສະແກນ barcode ແລ້ວ. ກຳລັງສົ່ງໄປ desktop...',
    desktopTypedBarcode: 'Desktop ຮັບແລະພິມ barcode ແລ້ວ.',
    desktopReceivedTypingFailed: 'Desktop ຮັບແລ້ວ ແຕ່ພິມບໍ່ສຳເລັດ. ກວດ input ທີ່ focus.',
    couldNotSendBarcode: 'ສົ່ງ barcode ບໍ່ໄດ້. ກວດ connection, firewall ຫຼື QR IP.',
    startingScanner: 'ກຳລັງເລີ່ມສະແກນ barcode',
    scannerAutoStarts: 'Scanner ຈະເລີ່ມເອງໃນແທັບນີ້.',
    lastScanned: 'ສະແກນຫຼ້າສຸດ',
    noBarcodeYet: 'ຍັງບໍ່ມີ barcode',
    today: 'ມື້ນີ້',
    waitingForScan: 'ລໍຖ້າສະແກນ',
    sendAgain: 'ສົ່ງອີກຄັ້ງ',
    status: 'ສະຖານະ',
    noBarcodeSent: 'ຍັງບໍ່ໄດ້ສົ່ງ barcode.',
    noBarcodeValue: 'ບໍ່ມີຄ່າ barcode ເພື່ອສົ່ງ.',
    openConnectScanAgain: 'ເປີດ Connect ແລະສະແກນ QR ຈາກ desktop ອີກຄັ້ງ.',
    sendingBarcode: 'ກຳລັງສົ່ງ barcode ໄປ desktop...',
    desktopReceivedTypingFailedShort: 'Desktop ຮັບ barcode ແລ້ວ ແຕ່ພິມບໍ່ສຳເລັດ.',
    couldNotSendDesktop: 'ສົ່ງ barcode ໄປ desktop ບໍ່ໄດ້.',
    networkFailed: 'Network request failed.',
    scannerSettings: 'ຕັ້ງຄ່າສະແກນ',
    barcodeOnlyBehavior: 'ເລືອກປະເພດລະຫັດທີ່ກ້ອງຈະອ່ານ.',
    scanFormats: 'ປະເພດລະຫັດສະແກນ',
    scanFormatsHint: 'ເປີດສະເພາະປະເພດທີ່ຕ້ອງໃຊ້ ເພື່ອໃຫ້ສະແກນໄວຂຶ້ນ.',
    enable1D: 'Barcode 1D',
    enable1DHint: 'EAN, UPC, Code 128, Code 39, ITF ແລະ barcode ຄ້າຍຄືກັນ.',
    enable2D: 'ລະຫັດ 2D',
    enable2DHint: 'QR, Data Matrix, Aztec, PDF417 ແລະລະຫັດຄ້າຍຄືກັນ.',
    scanInterval: 'ໄລຍະຫ່າງການສະແກນ',
    scanIntervalHint: 'ເວລາຂັ້ນຕ່ຳກ່ອນຮັບລະຫັດຄັ້ງຕໍ່ໄປ.',
    stableRead: 'ອ່ານໃຫ້ນິ່ງ',
    stableReadHint: 'ຢືນຢັນລະຫັດເດີມ 2 ຄັ້ງກ່ອນຮັບ.',
    confirmingScan: 'ກຳລັງຢືນຢັນລະຫັດ...',
    invalidBarcodeIgnored: 'ຂ້າມ barcode ທີ່ບໍ່ຖືກຕ້ອງ.',
    waitingNextScan: 'ລໍຖ້າ {seconds}s ກ່ອນສະແກນຄັ້ງຕໍ່ໄປ.',
    ignoreDuplicates: 'ຂ້າມຄ່າຊ້ຳ',
    ignoreDuplicatesHint: 'ບລັອກ barcode ເດີມຂະນະທີ່ຍັງຢູ່ໃນກອບ.',
    autoSend: 'ສົ່ງອັດຕະໂນມັດ',
    autoSendHint: 'ສົ່ງ barcode ແຕ່ລະອັນໄປ desktop ຫຼັງຈາກອ່ານ.',
    debugStatus: 'ສະຖານະ Debug',
    server: 'Server',
    token: 'Token',
    exists: 'ມີແລ້ວ',
    missing: 'ບໍ່ມີ',
    socket: 'Socket',
    lastScan: 'ສະແກນຫຼ້າສຸດ',
    none: 'ບໍ່ມີ',
    lastSend: 'ສົ່ງຫຼ້າສຸດ',
    typedResult: 'ຜົນການພິມ',
    typed: 'ພິມແລ້ວ',
    receivedOnly: 'ຮັບເທົ່ານັ້ນ',
    sending: 'ກຳລັງສົ່ງ',
    notTyped: 'ຍັງບໍ່ພິມ',
    error: 'ຂໍ້ຜິດພາດ',
    channel: 'ຊ່ອງທາງ',
  },
} as const

type PwaTextKey = keyof typeof pwaText.en
type Translate = (key: PwaTextKey) => string

let scanAudioContext: AudioContext | null = null
let scanAudioPrimed = false
const scanVibrationPattern = [140, 55, 140]

function getScanAudioContext() {
  const AudioContextConstructor = window.AudioContext
    ?? (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!AudioContextConstructor) {
    return null
  }

  try {
    const audioContext = scanAudioContext ?? new AudioContextConstructor()
    scanAudioContext = audioContext

    return audioContext
  } catch {
    return null
  }
}

function primeBarcodeScanFeedback() {
  const audioContext = getScanAudioContext()

  if (!audioContext || scanAudioPrimed) {
    return
  }

  const playSilentPulse = () => {
    try {
      const now = audioContext.currentTime
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()

      gain.gain.setValueAtTime(0.0001, now)
      oscillator.frequency.setValueAtTime(1200, now)
      oscillator.connect(gain)
      gain.connect(audioContext.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.01)
      oscillator.addEventListener('ended', () => {
        oscillator.disconnect()
        gain.disconnect()
      }, { once: true })
      scanAudioPrimed = true
    } catch {
      // Best-effort unlock for browsers that require a user gesture before audio output.
    }
  }

  if (audioContext.state === 'suspended') {
    void audioContext.resume().then(playSilentPulse).catch(() => undefined)
    return
  }

  playSilentPulse()
}

function playBarcodeScanFeedback() {
  try {
    navigator.vibrate?.(scanVibrationPattern)
  } catch {
    // Haptic feedback is best-effort; some browsers/devices ignore vibration.
  }

  const audioContext = getScanAudioContext()

  if (!audioContext) {
    return
  }

  try {
    const playSound = () => {
      const now = audioContext.currentTime
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()

      oscillator.type = 'square'
      oscillator.frequency.setValueAtTime(2200, now)
      oscillator.frequency.exponentialRampToValueAtTime(2050, now + 0.065)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.24, now + 0.006)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085)
      oscillator.connect(gain)
      gain.connect(audioContext.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.095)
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

type CameraModeCapabilities = MediaTrackCapabilities & {
  exposureMode?: string[]
  focusMode?: string[]
  torch?: boolean
  whiteBalanceMode?: string[]
  zoom?: {
    max?: number
    min?: number
    step?: number
  }
}

type BarcodeCameraConstraints = MediaTrackConstraintSet & {
  exposureMode?: string
  focusMode?: string
  torch?: boolean
  whiteBalanceMode?: string
  zoom?: number
}

function getVideoTrackFromElement(videoElement?: HTMLVideoElement | null) {
  const stream = videoElement?.srcObject

  return stream instanceof MediaStream ? stream.getVideoTracks()[0] : undefined
}

function buildBarcodeCameraConstraints(capabilities?: CameraModeCapabilities): MediaTrackConstraints {
  const advanced: BarcodeCameraConstraints[] = []
  const supportsMode = (key: 'exposureMode' | 'focusMode' | 'whiteBalanceMode', value: string) => capabilities?.[key]?.includes(value) === true

  if (supportsMode('focusMode', 'continuous')) {
    advanced.push({ focusMode: 'continuous' })
  }

  if (supportsMode('exposureMode', 'continuous')) {
    advanced.push({ exposureMode: 'continuous' })
  }

  if (supportsMode('whiteBalanceMode', 'continuous')) {
    advanced.push({ whiteBalanceMode: 'continuous' })
  }

  if (capabilities?.zoom && typeof capabilities.zoom.max === 'number' && capabilities.zoom.max > 1) {
    const minZoom = typeof capabilities.zoom.min === 'number' ? capabilities.zoom.min : 1
    const targetZoom = Math.min(capabilities.zoom.max, Math.max(minZoom, 1.25))

    advanced.push({ zoom: targetZoom })
  }

  return advanced.length > 0 ? { advanced: advanced as MediaTrackConstraintSet[] } : {}
}

async function applyBarcodeCameraTuning(controls: IScannerControls, videoElement?: HTMLVideoElement | null) {
  const track = getVideoTrackFromElement(videoElement)
  const capabilities = (() => {
    try {
      return (track?.getCapabilities?.() ?? controls.streamVideoCapabilitiesGet?.((nextTrack) => [nextTrack])) as CameraModeCapabilities | undefined
    } catch {
      return undefined
    }
  })()
  const constraints = buildBarcodeCameraConstraints(capabilities)

  if (!constraints.advanced?.length) {
    return
  }

  try {
    await track?.applyConstraints(constraints)
    return
  } catch {
    // Browser support varies; fall through to ZXing's controls helper.
  }

  try {
    controls.streamVideoConstraintsApply?.(constraints)
  } catch {
    // Camera tuning is best-effort; scan should continue with the base constraints.
  }
}

function normalizeScannerSettings(settings: Partial<ScannerSettings>): ScannerSettings {
  const scanIntervalMs = getNearestScanIntervalMs(settings.scanIntervalMs)
  let enable1D = settings.enable1D ?? defaultScannerSettings.enable1D
  const enable2D = settings.enable2D ?? defaultScannerSettings.enable2D

  if (!enable1D && !enable2D) {
    enable1D = true
  }

  return {
    autoSend: settings.autoSend ?? defaultScannerSettings.autoSend,
    duplicateLock: settings.duplicateLock ?? defaultScannerSettings.duplicateLock,
    enable1D,
    enable2D,
    scanIntervalMs,
    stableRead: settings.stableRead ?? defaultScannerSettings.stableRead,
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

function getInitialAppLanguage(): AppLanguage {
  try {
    return window.localStorage.getItem(appLanguageStorageKey) === 'lo' ? 'lo' : 'en'
  } catch {
    return 'en'
  }
}

function isPwaStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }

  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true
}

function formatScanTime(timestamp: number) {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}

function formatScanInterval(ms: number) {
  return `${ms / 1000}s`
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
  return <ScannerApp />
}

function ScannerApp() {
  const [language, setLanguage] = useState<AppLanguage>(() => getInitialAppLanguage())
  const t: Translate = (key) => pwaText[language][key]
  const [connection, setConnection] = useState<DesktopConnection>(() => getInitialConnection())
  const [page, setPage] = useState<MobilePage>(() => (connection.token ? 'scanner' : 'connect'))
  const [scannerSettings, setScannerSettings] = useState<ScannerSettings>(() => getInitialScannerSettings())
  const [lastScan, setLastScan] = useState<LastScan | null>(null)
  const [lastSend, setLastSend] = useState<LastSend>({
    state: 'idle',
    message: t('noBarcodeSent'),
  })
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [appInstalled, setAppInstalled] = useState(() => isPwaStandalone())
  const socketRef = useRef<Socket | null>(null)

  const updateScannerSettings = (nextSettings: Partial<ScannerSettings>) => {
    setScannerSettings((current) => normalizeScannerSettings({ ...current, ...nextSettings }))
  }

  const installPwa = async () => {
    if (!installPrompt) {
      return
    }

    try {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice

      setInstallPrompt(null)

      if (choice.outcome === 'accepted') {
        setAppInstalled(true)
      }
    } catch {
      setInstallPrompt(null)
    }
  }

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
      setAppInstalled(false)
    }
    const handleAppInstalled = () => {
      setInstallPrompt(null)
      setAppInstalled(true)
    }
    const displayModeQuery = window.matchMedia('(display-mode: standalone)')
    const handleDisplayModeChange = () => {
      setAppInstalled(isPwaStandalone())
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    displayModeQuery.addEventListener('change', handleDisplayModeChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      displayModeQuery.removeEventListener('change', handleDisplayModeChange)
    }
  }, [])

  useEffect(() => {
    const unlockAudio = () => {
      primeBarcodeScanFeedback()
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('touchstart', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }

    window.addEventListener('pointerdown', unlockAudio)
    window.addEventListener('touchstart', unlockAudio)
    window.addEventListener('keydown', unlockAudio)

    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('touchstart', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(appLanguageStorageKey, language)
    } catch {
      // Storage can be unavailable in private browsing; runtime language still works.
    }
  }, [language])

  useEffect(() => {
    try {
      window.localStorage.setItem(scannerSettingsStorageKey, JSON.stringify(scannerSettings))
    } catch {
      // Storage can be unavailable in private browsing; runtime settings still work.
    }
  }, [scannerSettings])

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
        message: !barcode ? t('noBarcodeValue') : t('missingDesktopToken'),
      })
      return { delivered: false, typed: false, error: !barcode ? t('noBarcodeValue') : t('missingDesktopToken') }
    }

    if (!connection.connected) {
      updateSendStatus({
        state: 'failed',
        message: t('barcodeScannedNoDesktop'),
        detail: t('openConnectScanAgain'),
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
      message: t('sendingBarcode'),
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
          error: error instanceof Error ? error.message : t('networkFailed'),
        }
      }
    }

    updateSendStatus({
      state: result.delivered ? (result.typed ? 'typed' : 'received') : 'failed',
      message: result.delivered
        ? result.typed
          ? t('desktopTypedBarcode')
          : t('desktopReceivedTypingFailedShort')
        : t('couldNotSendDesktop'),
      detail: result.error,
      via: result.via,
      time: formatScanTime(timestamp),
    })

    return result
  }

  return (
    <main className={`pwa-app language-${language}`} lang={language === 'lo' ? 'lo' : 'en'} aria-label="Phone Scan PWA">
      <section className="app-screen">
        <AppNavbar language={language} setLanguage={setLanguage} t={t} />

        {page === 'scanner' ? (
          <ScannerScreen
            connection={connection}
            lastScan={lastScan}
            recordLocalScan={recordLocalScan}
            sendBarcode={sendBarcode}
            scannerSettings={scannerSettings}
            t={t}
          />
        ) : page === 'settings' ? (
          <SettingsScreen
            scannerSettings={scannerSettings}
            updateScannerSettings={updateScannerSettings}
            t={t}
          />
        ) : (
          <ConnectScreen
            appInstalled={appInstalled}
            connection={connection}
            installPrompt={installPrompt}
            lastScan={lastScan}
            lastSend={lastSend}
            onInstallPwa={installPwa}
            setPage={setPage}
            t={t}
          />
        )}

        <MobileTabs page={page} setPage={setPage} t={t} />
      </section>
    </main>
  )
}

function AppNavbar({
  language,
  setLanguage,
  t,
}: {
  language: AppLanguage
  setLanguage: (language: AppLanguage) => void
  t: Translate
}) {
  return (
    <header className="app-navbar">
      <div className="app-navbar-brand">
        <img src="/app-logo-icon.png" alt="Phone Scan logo" />
        <span>{t('appName')}</span>
      </div>

      <div className="language-switcher" aria-label={t('languageLabel')}>
        <Languages size={18} strokeWidth={2.3} />
        <button
          type="button"
          className={language === 'en' ? 'active' : ''}
          aria-pressed={language === 'en'}
          onClick={() => setLanguage('en')}
        >
          EN
        </button>
        <button
          type="button"
          className={language === 'lo' ? 'active language-option-lo' : 'language-option-lo'}
          aria-pressed={language === 'lo'}
          onClick={() => setLanguage('lo')}
        >
          ລາວ
        </button>
      </div>
    </header>
  )
}

function ConnectScreen({
  appInstalled,
  connection,
  installPrompt,
  lastScan,
  lastSend,
  onInstallPwa,
  setPage,
  t,
}: {
  appInstalled: boolean
  connection: DesktopConnection
  installPrompt: BeforeInstallPromptEvent | null
  lastScan: LastScan | null
  lastSend: LastSend
  onInstallPwa: () => void
  setPage: (page: MobilePage) => void
  t: Translate
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [connectScannerActive, setConnectScannerActive] = useState(false)
  const [connectScanMessage, setConnectScanMessage] = useState(
    connection.connected ? t('desktopReady') : t('scanQrShown'),
  )
  const cameraNeedsTrustedHttps = !window.isSecureContext
  const connectionMessage = connection.connected
    ? `${connection.computerName} - ${connection.ipAddress}:${connection.port}`
    : connection.error === 'Missing desktop token.'
      ? t('scanQrOrIp')
      : connection.error ?? t('scanQrOrIp')

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
      setConnectScanMessage(t('connectionQrScannerStopped'))
      return
    }

    if (cameraNeedsTrustedHttps) {
      setConnectScanMessage(t('cameraNeedsHttpsConnect'))
      return
    }

    try {
      const reader = new BrowserMultiFormatReader()
      setConnectScannerActive(true)
      setConnectScanMessage(t('scanningDesktopConnectionQr'))
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
            setConnectScanMessage(t('invalidDesktopQr'))
            return
          }

          setConnectScanMessage(t('desktopQrDetected'))
          window.location.assign(scannerUrl.href)
        },
      )
    } catch (error) {
      setConnectScannerActive(false)
      setConnectScanMessage(error instanceof Error ? error.message : t('cameraUnavailable'))
    }
  }

  return (
    <div className="pwa-content">
      <section className="connect-card status-card-mobile compact-connect-card">
        <div className="mobile-card-title">
          <span className="bars">
            <i />
            <i />
            <i />
            <i />
          </span>
          <h2>{t('connectionStatus')}</h2>
        </div>

        <div className="not-connected-box">
          <div className="status-copy">
            <span className={`green-dot ${connection.connected ? 'online' : 'offline'}`} />
            <div>
              <strong>{connection.connected ? t('connected') : t('notConnected')}</strong>
              <p>{connectionMessage}</p>
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

      {!appInstalled && (
        <InstallPwaCard installPrompt={installPrompt} onInstallPwa={onInstallPwa} t={t} />
      )}

      <section className="connect-card connect-qr-scanner-card">
        <div className="mobile-card-title">
          <span className="info-dot">QR</span>
          <h2>{t('desktopQrScanner')}</h2>
        </div>

        <div className={`connect-qr-preview ${connectScannerActive ? 'has-video' : ''}`}>
          <video ref={videoRef} className="camera-video" muted playsInline />
          {!connectScannerActive && (
            <div className="connect-qr-placeholder">
              <Link2 size={42} strokeWidth={2.5} />
              <strong>{t('scanDesktopQrHere')}</strong>
              <span>{t('desktopQrHint')}</span>
            </div>
          )}
        </div>

        <p className="connect-scan-message">{connectScanMessage}</p>

        <button className="scan-button connect-open-scanner" type="button" onClick={toggleConnectScanner}>
          <ScanLine size={30} strokeWidth={2.5} />
          <span>{connectScannerActive ? t('stopQrScanner') : t('scanDesktopQr')}</span>
        </button>
      </section>

      <section className="connect-card how-card compact-how-card">
        <div className="mobile-card-title">
          <span className="info-dot">i</span>
          <h2>{t('beforeScanning')}</h2>
        </div>

        <div className="how-body">
          <ol>
            <li><span>1</span><p>{t('stepWifi')}</p></li>
            <li><span>2</span><p>{t('stepScanQr')}</p></li>
            <li><span>3</span><p>{t('stepUseScanner')}</p></li>
          </ol>
        </div>

        <button className="scan-button connect-open-scanner" type="button" onClick={() => setPage('scanner')}>
          <Barcode size={30} strokeWidth={2.5} />
          <span>{t('openBarcodeScanner')}</span>
        </button>
      </section>

      <ConnectionDiagnostics connection={connection} lastScan={lastScan} lastSend={lastSend} t={t} />
    </div>
  )
}

function InstallPwaCard({
  installPrompt,
  onInstallPwa,
  t,
}: {
  installPrompt: BeforeInstallPromptEvent | null
  onInstallPwa: () => void
  t: Translate
}) {
  return (
    <section className="connect-card install-pwa-card">
      <span className="install-pwa-icon">
        <Smartphone size={28} strokeWidth={2.3} />
      </span>
      <div className="install-pwa-copy">
        <strong>{t('installPwaTitle')}</strong>
        <p>{installPrompt ? t('installPwaBody') : t('installPwaManualHint')}</p>
      </div>
      {installPrompt && (
        <button type="button" onClick={onInstallPwa}>
          <Download size={20} strokeWidth={2.4} />
          <span>{t('installPwaButton')}</span>
        </button>
      )}
    </section>
  )
}

function ScannerScreen({
  connection,
  lastScan,
  recordLocalScan,
  sendBarcode,
  scannerSettings,
  t,
}: {
  connection: DesktopConnection
  lastScan: LastScan | null
  recordLocalScan: (value: string, type: LastScan['type'], timestamp?: number) => LastScan | null
  sendBarcode: SendBarcode
  scannerSettings: ScannerSettings
  t: Translate
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const scanInFlightRef = useRef(false)
  const lastAcceptedScanRef = useRef<{ value: string; at: number } | null>(null)
  const connectionRef = useRef(connection)
  const recordLocalScanRef = useRef(recordLocalScan)
  const sendBarcodeRef = useRef(sendBarcode)
  const settingsRef = useRef(scannerSettings)
  const enabledFormatsRef = useRef(getEnabledScanFormats(scannerSettings))
  const focusTuneTimersRef = useRef<number[]>([])
  const pendingStableScanRef = useRef<{ value: string; format: BarcodeFormat | null; count: number; at: number } | null>(null)
  const scanMessageUpdateRef = useRef<{ text: string; at: number } | null>(null)
  const [scannerActive, setScannerActive] = useState(false)
  const [scanMessage, setScanMessage] = useState(t('alignBarcode'))
  const cameraNeedsTrustedHttps = !window.isSecureContext

  useEffect(() => {
    connectionRef.current = connection
    recordLocalScanRef.current = recordLocalScan
    sendBarcodeRef.current = sendBarcode
  }, [connection, recordLocalScan, sendBarcode])

  useEffect(() => {
    settingsRef.current = scannerSettings
    enabledFormatsRef.current = getEnabledScanFormats(scannerSettings)
  }, [scannerSettings])

  const updateScanMessage = (message: string, throttleMs = 0) => {
    const timestamp = Date.now()
    const lastUpdate = scanMessageUpdateRef.current

    if (throttleMs > 0 && lastUpdate?.text === message && timestamp - lastUpdate.at < throttleMs) {
      return
    }

    scanMessageUpdateRef.current = { text: message, at: timestamp }
    setScanMessage(message)
  }

  const confirmStableScan = (
    value: string,
    format: BarcodeFormat | null | undefined,
    timestamp: number,
    activeSettings: ScannerSettings,
  ) => {
    if (!activeSettings.stableRead) {
      return true
    }

    const normalizedFormat = format ?? null
    const pending = pendingStableScanRef.current
    const isSamePendingScan = pending?.value === value
      && pending.format === normalizedFormat
      && timestamp - pending.at <= stableScanWindowMs

    if (!isSamePendingScan) {
      pendingStableScanRef.current = { value, format: normalizedFormat, count: 1, at: timestamp }
      updateScanMessage(t('confirmingScan'), scanMessageThrottleMs)
      return false
    }

    const count = pending.count + 1

    if (count < 2) {
      pendingStableScanRef.current = { value, format: normalizedFormat, count, at: timestamp }
      updateScanMessage(t('confirmingScan'), scanMessageThrottleMs)
      return false
    }

    pendingStableScanRef.current = null
    return true
  }

  const clearFocusTuneTimers = () => {
    focusTuneTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    focusTuneTimersRef.current = []
  }

  const scheduleFocusTuning = (controls: IScannerControls) => {
    clearFocusTuneTimers()
    void applyBarcodeCameraTuning(controls, videoRef.current)
    focusTuneTimersRef.current = [350, 1200, 2400].map((delay) => window.setTimeout(() => {
      void applyBarcodeCameraTuning(controls, videoRef.current)
    }, delay))
  }

  const stopScanner = () => {
    clearFocusTuneTimers()
    controlsRef.current?.stop()
    controlsRef.current = null
    scanInFlightRef.current = false
    pendingStableScanRef.current = null
    setScannerActive(false)
  }

  const startScanner = async () => {
    if (controlsRef.current) {
      return
    }

    if (cameraNeedsTrustedHttps) {
      updateScanMessage(t('trustedHttpsMessage'))
      return
    }

    try {
      const reader = new BrowserMultiFormatReader(createBarcodeReaderHints(enabledFormatsRef.current), barcodeReaderOptions)
      scanInFlightRef.current = false
      setScannerActive(true)
      updateScanMessage(t('scanningBarcodeOnly'))
      const controls = await reader.decodeFromConstraints(
        barcodeVideoConstraints,
        videoRef.current ?? undefined,
        async (result) => {
          if (!result || scanInFlightRef.current) {
            return
          }

          const value = result.getText().trim()
          const format = result.getBarcodeFormat()
          const scanType = getScanType(format)
          const activeSettings = settingsRef.current

          if (!value || !isSupportedScanFormat(format, enabledFormatsRef.current)) {
            return
          }

          const scannerUrl = getDesktopScannerUrl(value)

          if (scannerUrl) {
            updateScanMessage(t('qrIgnored'), scanMessageThrottleMs)
            return
          }

          if (!isValidScanValue(value, format)) {
            pendingStableScanRef.current = null
            updateScanMessage(t('invalidBarcodeIgnored'), scanMessageThrottleMs)
            return
          }

          const timestamp = Date.now()
          const lastAcceptedScan = lastAcceptedScanRef.current
          const elapsedSinceLastScan = lastAcceptedScan ? timestamp - lastAcceptedScan.at : Number.POSITIVE_INFINITY

          if (!confirmStableScan(value, format, timestamp, activeSettings)) {
            return
          }

          if (lastAcceptedScan && elapsedSinceLastScan < activeSettings.scanIntervalMs) {
            updateScanMessage(
              lastAcceptedScan.value === value && activeSettings.duplicateLock
                ? t('duplicateBarcodeIgnored')
                : t('waitingNextScan').replace(
                  '{seconds}',
                  String(Math.ceil((activeSettings.scanIntervalMs - elapsedSinceLastScan) / 1000)),
                ),
              scanMessageThrottleMs,
            )
            return
          }

          scanInFlightRef.current = true
          lastAcceptedScanRef.current = { value, at: timestamp }

          try {
            recordLocalScanRef.current(value, scanType, timestamp)
            playBarcodeScanFeedback()

            if (!activeSettings.autoSend) {
              updateScanMessage(t('autoSendOff'))
              return
            }

            if (!connectionRef.current.connected) {
              updateScanMessage(t('barcodeScannedNoDesktop'))
              await sendBarcodeRef.current(value, scanType, timestamp)
              return
            }

            updateScanMessage(t('barcodeSending'))
            const sendResult = await sendBarcodeRef.current(value, scanType, timestamp)
            updateScanMessage(
              sendResult.delivered
                ? sendResult.typed
                  ? t('desktopTypedBarcode')
                  : t('desktopReceivedTypingFailed')
                : t('couldNotSendBarcode'),
            )
          } finally {
            scanInFlightRef.current = false
          }
        },
      )
      controlsRef.current = controls
      scheduleFocusTuning(controls)
    } catch (error) {
      controlsRef.current?.stop()
      controlsRef.current = null
      setScannerActive(false)
      updateScanMessage(error instanceof Error ? error.message : t('cameraUnavailable'))
    }
  }

  useEffect(() => {
    void startScanner()

    return () => {
      stopScanner()
    }
  }, [scannerSettings.enable1D, scannerSettings.enable2D])

  return (
    <div className="scanner-content">
      <DesktopStatusPill connection={connection} t={t} />

      {cameraNeedsTrustedHttps && <CertificateNotice connection={connection} t={t} />}

      <section className={`camera-preview ${scannerActive ? 'has-video' : ''}`}>
        <video ref={videoRef} className="camera-video" muted playsInline />
        {!scannerActive && (
          <div className="camera-placeholder">
            <ScanLine size={64} strokeWidth={2.2} />
            <strong>{t('startingScanner')}</strong>
            <span>{t('scannerAutoStarts')}</span>
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
          <div className="last-scanned-copy">
            <p>{t('lastScanned')}</p>
            <strong>{lastScan?.value ?? t('noBarcodeYet')}</strong>
            <time>{lastScan ? `${t('today')}, ${lastScan.time}` : t('waitingForScan')}</time>
          </div>
          <button type="button" disabled={!lastScan} onClick={() => lastScan && sendBarcode(lastScan.value, lastScan.type)}>
            <Send size={30} strokeWidth={2.3} />
            <span>{t('sendAgain')}</span>
          </button>
        </div>
        <div className="scan-tips compact-scan-tips">
          <div>
            <div className="tips-title">
              <span>◌</span>
              <strong>{t('status')}</strong>
            </div>
            <p>{scanMessage}</p>
          </div>
        </div>
      </section>

    </div>
  )
}

function SettingsScreen({
  scannerSettings,
  updateScannerSettings,
  t,
}: {
  scannerSettings: ScannerSettings
  updateScannerSettings: (settings: Partial<ScannerSettings>) => void
  t: Translate
}) {
  return (
    <div className="scanner-content settings-content">
      <section className="scanner-settings-card settings-page-card">
        <div className="scanner-settings-header">
          <div>
            <strong>{t('scannerSettings')}</strong>
            <span>{t('barcodeOnlyBehavior')}</span>
          </div>
        </div>

        <div className="scanner-setting-section">
          <strong>{t('scanFormats')}</strong>
          <small>{t('scanFormatsHint')}</small>
        </div>

        <label className="scanner-setting-row">
          <span>
            <strong>{t('enable1D')}</strong>
            <small>{t('enable1DHint')}</small>
          </span>
          <input
            type="checkbox"
            checked={scannerSettings.enable1D}
            onChange={(event) => updateScannerSettings({ enable1D: event.target.checked })}
          />
        </label>

        <label className="scanner-setting-row">
          <span>
            <strong>{t('enable2D')}</strong>
            <small>{t('enable2DHint')}</small>
          </span>
          <input
            type="checkbox"
            checked={scannerSettings.enable2D}
            onChange={(event) => updateScannerSettings({ enable2D: event.target.checked })}
          />
        </label>

        <label className="scanner-setting-row">
          <span>
            <strong>{t('scanInterval')}</strong>
            <small>{t('scanIntervalHint')}</small>
          </span>
          <div className="scan-interval-options" role="group" aria-label={t('scanInterval')}>
            {scanIntervalOptions.map((intervalMs) => (
              <button
                key={intervalMs}
                type="button"
                className={scannerSettings.scanIntervalMs === intervalMs ? 'active' : ''}
                aria-pressed={scannerSettings.scanIntervalMs === intervalMs}
                onClick={() => updateScannerSettings({ scanIntervalMs: intervalMs })}
              >
                {formatScanInterval(intervalMs)}
              </button>
            ))}
          </div>
        </label>

        <label className="scanner-setting-row">
          <span>
            <strong>{t('stableRead')}</strong>
            <small>{t('stableReadHint')}</small>
          </span>
          <input
            type="checkbox"
            checked={scannerSettings.stableRead}
            onChange={(event) => updateScannerSettings({ stableRead: event.target.checked })}
          />
        </label>

        <label className="scanner-setting-row">
          <span>
            <strong>{t('ignoreDuplicates')}</strong>
            <small>{t('ignoreDuplicatesHint')}</small>
          </span>
          <input
            type="checkbox"
            checked={scannerSettings.duplicateLock}
            onChange={(event) => updateScannerSettings({ duplicateLock: event.target.checked })}
          />
        </label>

        <label className="scanner-setting-row">
          <span>
            <strong>{t('autoSend')}</strong>
            <small>{t('autoSendHint')}</small>
          </span>
          <input
            type="checkbox"
            checked={scannerSettings.autoSend}
            onChange={(event) => updateScannerSettings({ autoSend: event.target.checked })}
          />
        </label>
      </section>
    </div>
  )
}

function DesktopStatusPill({
  connection,
  t,
  className = '',
}: {
  connection: DesktopConnection
  t: Translate
  className?: string
}) {
  const endpoint = connection.token ? `${connection.ipAddress}:${connection.port}` : t('noDesktopQrScanned')

  return (
    <section className={`desktop-status-pill ${className}`}>
      <Monitor size={31} strokeWidth={2} />
      <span>
        {t('connectedTo')} <strong>{connection.connected ? connection.computerName : t('waitingForDesktop')}</strong>
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

function CertificateNotice({ connection, t }: { connection: DesktopConnection; t: Translate }) {
  return (
    <section className="certificate-notice">
      <Info size={28} strokeWidth={2.3} />
      <div>
        <strong>{t('cameraNeedsTrustedHttps')}</strong>
        <p>{t('installCertificate')}</p>
      </div>
      <a href={connection.trustUrl || connection.certificateUrl}>{t('setup')}</a>
    </section>
  )
}

function ConnectionDiagnostics({
  connection,
  lastScan,
  lastSend,
  t,
  compact = false,
}: {
  connection: DesktopConnection
  lastScan: LastScan | null
  lastSend: LastSend
  t: Translate
  compact?: boolean
}) {
  return (
    <section className={`diagnostics-card ${compact ? 'compact' : ''}`}>
      <div className="diagnostics-title">
        <span className={`diagnostics-dot ${connection.connected ? 'online' : 'offline'}`} />
        <strong>{t('debugStatus')}</strong>
      </div>

      <div className="diagnostics-grid">
        <DiagnosticRow label={t('server')} value={connection.serverUrl} />
        <DiagnosticRow label={t('token')} value={connection.token ? t('exists') : t('missing')} tone={connection.token ? 'good' : 'bad'} />
        <DiagnosticRow label={t('socket')} value={connection.connected ? t('connected') : t('offline')} tone={connection.connected ? 'good' : 'bad'} />
        <DiagnosticRow label={t('lastScan')} value={lastScan ? `${lastScan.value} (${lastScan.type})` : t('none')} />
        <DiagnosticRow label={t('lastSend')} value={lastSend.message} tone={lastSend.state === 'typed' || lastSend.state === 'received' ? 'good' : lastSend.state === 'failed' ? 'bad' : 'neutral'} />
        <DiagnosticRow label={t('typedResult')} value={lastSend.state === 'typed' ? t('typed') : lastSend.state === 'received' ? t('receivedOnly') : lastSend.state === 'sending' ? t('sending') : t('notTyped')} tone={lastSend.state === 'typed' ? 'good' : lastSend.state === 'received' || lastSend.state === 'failed' ? 'bad' : 'neutral'} />
        {lastSend.detail && <DiagnosticRow label={t('error')} value={lastSend.detail} tone="bad" />}
        {lastSend.via && <DiagnosticRow label={t('channel')} value={lastSend.via.toUpperCase()} />}
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
  t,
}: {
  page: MobilePage
  setPage: (page: MobilePage) => void
  t: Translate
}) {
  const tabs = [
    { page: 'scanner' as const, label: t('scannerTab'), icon: <ScanLine size={34} strokeWidth={2.2} /> },
    { page: 'connect' as const, label: t('connectTab'), icon: <Link2 size={35} strokeWidth={2.6} /> },
    { page: 'settings' as const, label: t('settingsTab'), icon: <Settings size={34} strokeWidth={2.3} /> },
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
