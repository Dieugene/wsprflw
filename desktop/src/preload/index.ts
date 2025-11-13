import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // Audio permissions
  requestAudioPermission: () => ipcRenderer.invoke('request-audio-permission'),

  // System info
  platform: process.platform,
  isWindows: process.platform === 'win32',
  isMac: process.platform === 'darwin',
  isLinux: process.platform === 'linux'
})

// Type declarations for TypeScript
export interface ElectronAPI {
  getAppVersion: () => Promise<string>
  getAppPath: () => Promise<string>
  requestAudioPermission: () => Promise<{ granted: boolean; error?: any }>
  platform: string
  isWindows: boolean
  isMac: boolean
  isLinux: boolean
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
