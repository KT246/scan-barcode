import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopApi, DesktopConnectInfo, DesktopScanRecord } from '../shared/desktop-api'

const api: DesktopApi = {
  getConnectInfo: () => ipcRenderer.invoke('phoneScan:getConnectInfo') as Promise<DesktopConnectInfo>,
  refreshConnectInfo: () => ipcRenderer.invoke('phoneScan:refreshConnectInfo') as Promise<DesktopConnectInfo>,
  getScanHistory: () => ipcRenderer.invoke('phoneScan:getScanHistory') as Promise<DesktopScanRecord[]>,
  openScannerPage: () => ipcRenderer.invoke('phoneScan:openScannerPage') as Promise<void>,
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
