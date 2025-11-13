import { useEffect, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { RecordingPanel } from './components/RecordingPanel'
import { TranscriptionView } from './components/TranscriptionView'
import { FormattingPanel } from './components/FormattingPanel'
import { HistoryPanel } from './components/HistoryPanel'
import { apiService } from './services/api.service'

function App() {
  const [appVersion, setAppVersion] = useState<string>('')
  const [isConnected, setIsConnected] = useState<boolean>(false)

  useEffect(() => {
    // Get app version from Electron
    if (window.electronAPI) {
      window.electronAPI.getAppVersion().then(version => {
        setAppVersion(version)
      })
    }

    // Check backend connection
    checkBackendConnection()
  }, [])

  const checkBackendConnection = async () => {
    try {
      await apiService.healthCheck()
      setIsConnected(true)
      toast.success('Подключено к backend серверу')
    } catch (error) {
      setIsConnected(false)
      toast.error('Не удалось подключиться к backend серверу. Проверьте, что сервер запущен.')
      console.error('Backend connection error:', error)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-right" richColors />

      <div className="container mx-auto p-8 max-w-7xl">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">WhisperFlow</h1>
              <p className="text-muted-foreground">
                Транскрипция и форматирование аудио с помощью AI
              </p>
            </div>
            <div className="text-right">
              {appVersion && (
                <p className="text-sm text-muted-foreground">
                  Версия: {appVersion}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-muted-foreground">
                  {isConnected ? 'Подключено' : 'Не подключено'}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="space-y-6">
          {/* Recording Panel */}
          <RecordingPanel />

          {/* Transcription and Formatting */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TranscriptionView />
            <FormattingPanel />
          </div>

          {/* History Panel */}
          <HistoryPanel />

          {/* Instructions */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-semibold mb-3">Как использовать</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Выберите источник аудио (микрофон, системный звук или оба)</li>
              <li>Нажмите "Начать запись" или загрузите аудио файл</li>
              <li>Дождитесь завершения транскрипции (это может занять несколько минут)</li>
              <li>Опционально: выберите формат и отформатируйте текст с помощью AI</li>
              <li>Скопируйте или скачайте результаты</li>
            </ol>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-12 py-6 border-t border-border text-center text-sm text-muted-foreground">
          <p>Powered by OpenAI Whisper & GPT • WhisperFlow 2024</p>
        </footer>
      </div>
    </div>
  )
}

export default App
