import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, Menu, ipcMain, shell, screen, type BrowserWindow as ElectronBrowserWindow } from 'electron'
import type {
  DesktopAppSettings,
  DesktopConnectInfo,
  DesktopLanguage,
  DesktopScanRecord,
  DesktopTypingSuffix,
} from '../shared/desktop-api'
import { typeIntoFocusedWindow } from './keyboard'
import { startScannerServer, type ScannerServerHandle } from './scanner-server'

app.setName('Phone Scan')

const desktopRoot = path.resolve(__dirname, '../..')
const repoRoot = path.resolve(desktopRoot, '../..')
const bootLogPath = path.join(os.tmpdir(), 'phone-scan-main.log')
const defaultAppSettings: DesktopAppSettings = {
  autoEnter: true,
  autoTab: false,
  suffix: 'enter',
  typingDelayMs: 80,
  language: 'en',
  hasChosenLanguage: false,
}
const defaultWindowSize = {
  width: 1280,
  height: 780,
}
const windowSafeMargin = {
  x: 96,
  y: 72,
}

function writeBootLog(message: string, error?: unknown) {
  const detail = error instanceof Error ? `${error.stack ?? error.message}` : error ? String(error) : ''

  try {
    fs.appendFileSync(bootLogPath, `[${new Date().toISOString()}] ${message}${detail ? `\n${detail}` : ''}\n`, 'utf8')
  } catch {
    // Logging must never block app startup.
  }
}

process.on('uncaughtException', (error) => {
  writeBootLog('uncaughtException', error)
})

process.on('unhandledRejection', (error) => {
  writeBootLog('unhandledRejection', error)
})

let mainWindow: ElectronBrowserWindow | null = null
let server: ScannerServerHandle | null = null
let appSettings: DesktopAppSettings = defaultAppSettings
let connectInfo: DesktopConnectInfo = {
  status: 'starting',
  computerName: os.hostname(),
  ipAddress: '127.0.0.1',
  port: 8787,
  protocol: 'https',
  scannerUrl: '',
  certificateUrl: '',
  trustUrl: '',
  qrDataUrl: '',
  tokenPreview: '',
  connectedClients: 0,
}
const scanHistory: DesktopScanRecord[] = []

function resolveSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

function normalizeSuffix(value: unknown): DesktopTypingSuffix {
  if (value === 'tab' || value === 'none' || value === 'enter') {
    return value
  }

  return 'enter'
}

function normalizeLanguage(value: unknown): DesktopLanguage {
  if (value === 'lo' || value === 'en') {
    return value
  }

  return 'en'
}

function normalizeSettings(value: Partial<DesktopAppSettings> | null | undefined): DesktopAppSettings {
  const requestedSuffix = normalizeSuffix(value?.suffix)
  const suffix: DesktopTypingSuffix = value?.autoTab ? 'tab' : value?.autoEnter ? 'enter' : requestedSuffix
  const safeDelay = Number.isFinite(value?.typingDelayMs)
    ? Math.max(0, Math.min(1000, Math.round(Number(value?.typingDelayMs))))
    : defaultAppSettings.typingDelayMs
  const hasLanguage = Object.prototype.hasOwnProperty.call(value ?? {}, 'language')

  return {
    autoEnter: suffix === 'enter',
    autoTab: suffix === 'tab',
    suffix,
    typingDelayMs: safeDelay,
    language: normalizeLanguage(value?.language),
    hasChosenLanguage: value?.hasChosenLanguage === true || hasLanguage,
  }
}

async function loadSettings() {
  try {
    const raw = await fs.promises.readFile(resolveSettingsPath(), 'utf8')
    return normalizeSettings(JSON.parse(raw) as Partial<DesktopAppSettings>)
  } catch {
    return defaultAppSettings
  }
}

async function saveSettings(nextSettings: DesktopAppSettings) {
  appSettings = normalizeSettings(nextSettings)
  await fs.promises.mkdir(path.dirname(resolveSettingsPath()), { recursive: true })
  await fs.promises.writeFile(resolveSettingsPath(), `${JSON.stringify(appSettings, null, 2)}\n`, 'utf8')

  return appSettings
}

function resolvePreloadPath() {
  return path.join(desktopRoot, 'dist-electron', 'preload', 'index.cjs')
}

function resolveRendererEntry() {
  return path.join(desktopRoot, 'dist', 'index.html')
}

function resolveWindowIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icon.png')
  }

  return path.join(desktopRoot, 'build', 'icon.png')
}

function resolveScannerDistPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'scanner-pwa')
  }

  return path.join(repoRoot, 'apps', 'scanner-pwa', 'dist')
}

function getCenteredWindowBounds(size = defaultWindowSize) {
  const { workArea } = screen.getPrimaryDisplay()
  const maxWidth = Math.max(980, workArea.width - windowSafeMargin.x * 2)
  const maxHeight = Math.max(680, workArea.height - windowSafeMargin.y * 2)
  const width = Math.min(size.width, maxWidth)
  const height = Math.min(size.height, maxHeight)

  return {
    width,
    height,
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
  }
}

function broadcastConnectInfo(info: DesktopConnectInfo) {
  connectInfo = info
  mainWindow?.webContents.send('phoneScan:connectInfoChanged', info)
}

function broadcastScanRecord(record: DesktopScanRecord) {
  mainWindow?.webContents.send('phoneScan:scanReceived', record)
}

function formatScanTime(timestamp: number) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp))
}

async function handleIncomingScan(payload: { value: string; type: 'barcode' | 'qr' | 'manual'; timestamp: number }) {
  const typingResult = await typeIntoFocusedWindow(payload.value, {
    suffix: appSettings.suffix,
    typingDelayMs: appSettings.typingDelayMs,
  })
  const record: DesktopScanRecord = {
    id: `${payload.timestamp}-${crypto.randomUUID()}`,
    barcode: payload.value,
    type: payload.type,
    timestamp: payload.timestamp,
    time: formatScanTime(payload.timestamp),
    status: typingResult.ok ? 'Typed' : 'Failed',
    error: typingResult.error,
  }

  scanHistory.unshift(record)
  scanHistory.splice(200)
  broadcastScanRecord(record)

  return typingResult
}

async function startLocalServer() {
  try {
    writeBootLog('starting local server')
    server = await startScannerServer({
      scannerDistPath: resolveScannerDistPath(),
      certificateDir: path.join(app.getPath('userData'), 'certificates'),
      onScan: handleIncomingScan,
      onConnectionChange: broadcastConnectInfo,
    })
    writeBootLog(`local server running: ${server.getConnectInfo().scannerUrl}`)
    broadcastConnectInfo(server.getConnectInfo())
  } catch (error) {
    console.error('Failed to start Phone Scan local server:', error)
    broadcastConnectInfo({
      ...connectInfo,
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to start local server.',
    })
  }
}

async function createMainWindow() {
  writeBootLog('creating main window')
  const windowBounds = getCenteredWindowBounds()

  mainWindow = new BrowserWindow({
    ...windowBounds,
    minWidth: 980,
    minHeight: 680,
    show: false,
    frame: false,
    center: true,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    title: 'Phone Scan',
    icon: resolveWindowIconPath(),
    backgroundColor: '#edf1f6',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: resolvePreloadPath(),
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    await mainWindow.loadURL(pathToFileURL(resolveRendererEntry()).toString())
  }
}

ipcMain.handle('phoneScan:getConnectInfo', () => connectInfo)
ipcMain.handle('phoneScan:refreshConnectInfo', async () => {
  if (!server) {
    await startLocalServer()
    return connectInfo
  }

  return server.refreshToken()
})
ipcMain.handle('phoneScan:getScanHistory', () => scanHistory)
ipcMain.handle('phoneScan:getSettings', () => appSettings)
ipcMain.handle('phoneScan:updateSettings', async (_event, settings: DesktopAppSettings) => saveSettings(settings))
ipcMain.handle('phoneScan:openScannerPage', async () => {
  if (connectInfo.scannerUrl) {
    await shell.openExternal(connectInfo.scannerUrl)
  }
})
ipcMain.handle('phoneScan:minimizeWindow', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize()
})
ipcMain.handle('phoneScan:closeWindow', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close()
})

app.whenReady().then(async () => {
  writeBootLog(`app ready packaged=${app.isPackaged}`)
  Menu.setApplicationMenu(null)
  appSettings = await loadSettings()
  await startLocalServer()
  await createMainWindow()
})

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createMainWindow()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async (event) => {
  if (!server) {
    return
  }

  event.preventDefault()
  const activeServer = server
  server = null
  await activeServer.close()
  app.quit()
})
