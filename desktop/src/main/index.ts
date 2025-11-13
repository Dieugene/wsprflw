import { app, BrowserWindow, ipcMain, clipboard, globalShortcut } from 'electron'
import path from 'path'

// Disable GPU acceleration for better compatibility
app.disableHardwareAcceleration()

const isDev = process.env.NODE_ENV === 'development'

let mainWindow: BrowserWindow | null = null
let isRecording: boolean = false

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'WhisperFlow',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    autoHideMenuBar: true,
    backgroundColor: '#1a1a1a'
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()
  registerGlobalShortcuts()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll()
})

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

ipcMain.handle('get-app-path', () => {
  return app.getPath('userData')
})

// Handle audio device permissions (Windows specific)
ipcMain.handle('request-audio-permission', async () => {
  try {
    // On Windows, audio permissions are handled by the OS
    return { granted: true }
  } catch (error) {
    console.error('Error requesting audio permission:', error)
    return { granted: false, error }
  }
})

// Auto-paste text to active window
ipcMain.handle('auto-paste-text', async (_event, text: string) => {
  try {
    // Save current clipboard content
    const previousClipboard = clipboard.readText()

    // Copy transcribed text to clipboard
    clipboard.writeText(text)

    // Give a short delay to ensure clipboard is updated
    await new Promise(resolve => setTimeout(resolve, 100))

    // Simulate Ctrl+V (or Cmd+V on Mac)
    // Note: This requires the target window to be focused
    // The user needs to focus the target window before transcription completes

    // Return success - the text is now in clipboard
    // User can paste it manually with Ctrl+V

    return {
      success: true,
      message: 'Text copied to clipboard. You can paste it with Ctrl+V',
      previousClipboard
    }
  } catch (error) {
    console.error('Error auto-pasting text:', error)
    return { success: false, error: String(error) }
  }
})

// Restore clipboard content
ipcMain.handle('restore-clipboard', async (_event, text: string) => {
  try {
    clipboard.writeText(text)
    return { success: true }
  } catch (error) {
    console.error('Error restoring clipboard:', error)
    return { success: false, error: String(error) }
  }
})

// Global shortcuts
function registerGlobalShortcuts() {
  // Register Ctrl+Shift+R (or Cmd+Shift+R on Mac) to toggle recording
  const shortcut = process.platform === 'darwin' ? 'Command+Shift+R' : 'Ctrl+Shift+R'

  const registered = globalShortcut.register(shortcut, () => {
    console.log(`${shortcut} pressed - toggling recording`)

    // Toggle recording state
    isRecording = !isRecording

    // Send event to renderer process
    if (mainWindow) {
      mainWindow.webContents.send('toggle-recording', isRecording)
    }
  })

  if (registered) {
    console.log(`Global shortcut ${shortcut} registered successfully`)
  } else {
    console.error(`Failed to register global shortcut ${shortcut}`)
  }
}

// Handle recording state from renderer
ipcMain.on('recording-state-changed', (_event, recording: boolean) => {
  isRecording = recording
})
