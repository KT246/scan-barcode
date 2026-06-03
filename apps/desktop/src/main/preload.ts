import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi, DesktopAppSettings, DesktopConnectInfo, DesktopScanRecord } from '../shared/desktop-api'

const api: DesktopApi = {
  getConnectInfo: () => ipcRenderer.invoke('phoneScan:getConnectInfo') as Promise<DesktopConnectInfo>,
  refreshConnectInfo: () => ipcRenderer.invoke('phoneScan:refreshConnectInfo') as Promise<DesktopConnectInfo>,
  getScanHistory: () => ipcRenderer.invoke('phoneScan:getScanHistory') as Promise<DesktopScanRecord[]>,
  getSettings: () => ipcRenderer.invoke('phoneScan:getSettings') as Promise<DesktopAppSettings>,
  updateSettings: (settings) => ipcRenderer.invoke('phoneScan:updateSettings', settings) as Promise<DesktopAppSettings>,
  openScannerPage: () => ipcRenderer.invoke('phoneScan:openScannerPage') as Promise<void>,
  minimizeWindow: () => ipcRenderer.invoke('phoneScan:minimizeWindow') as Promise<void>,
  toggleMaximizeWindow: () => ipcRenderer.invoke('phoneScan:toggleMaximizeWindow') as Promise<void>,
  closeWindow: () => ipcRenderer.invoke('phoneScan:closeWindow') as Promise<void>,
  onConnectInfoChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, info: DesktopConnectInfo) => callback(info)
    ipcRenderer.on('phoneScan:connectInfoChanged', listener)

    return () => {
      ipcRenderer.off('phoneScan:connectInfoChanged', listener)
    }
  },
  onScanReceived: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, record: DesktopScanRecord) => callback(record)
    ipcRenderer.on('phoneScan:scanReceived', listener)

    return () => {
      ipcRenderer.off('phoneScan:scanReceived', listener)
    }
  },
}

contextBridge.exposeInMainWorld('phoneScan', api)
