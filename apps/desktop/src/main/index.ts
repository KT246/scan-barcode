import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, ipcMain, shell, type BrowserWindow as ElectronBrowserWindow } from 'electron'
import type { DesktopConnectInfo, DesktopScanRecord } from '../shared/desktop-api'
import { typeIntoFocusedWindow } from './keyboard'
import { startScannerServer, type ScannerServerHandle } from './scanner-server'

const desktopRoot = path.resolve(__dirname, '../..')
const repoRoot = path.resolve(desktopRoot, '../..')

let mainWindow: ElectronBrowserWindow | null = null
let server: ScannerServerHandle | null = null
let connectInfo: DesktopConnectInfo = {
  status: 'starting',
  computerName: os.hostname(),
  ipAddress: '127.0.0.1',
  port: 8787,
  scannerUrl: '',
  qrDataUrl: '',
  tokenPreview: '',
  connectedClients: 0,
}
const scanHistory: DesktopScanRecord[] = []

function resolvePreloadPath() {
  return path.join(desktopRoot, 'dist-electron', 'preload', 'index.cjs')
}

function resolveRendererEntry() {
  return path.join(desktopRoot, 'dist', 'index.html')
}

function resolveScannerDistPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'scanner-pwa')
  }

  return path.join(repoRoot, 'apps', 'scanner-pwa', 'dist')
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
  const typingResult = await typeIntoFocusedWindow(payload.value, { autoEnter: true })
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
    server = await startScannerServer({
      scannerDistPath: resolveScannerDistPath(),
      onScan: handleIncomingScan,
      onConnectionChange: broadcastConnectInfo,
    })
    broadcastConnectInfo(server.getConnectInfo())
  } catch (error) {
    broadcastConnectInfo({
      ...connectInfo,
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to start local server.',
    })
  }
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1420,
    height: 1030,
    minWidth: 1180,
    minHeight: 850,
    show: false,
    title: 'Phone Scan',
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
ipcMain.handle('phoneScan:openScannerPage', async () => {
  if (connectInfo.scannerUrl) {
    await shell.openExternal(connectInfo.scannerUrl)
  }
})

app.whenReady().then(async () => {
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
