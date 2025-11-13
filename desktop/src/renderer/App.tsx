import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'

function App() {
  const [appVersion, setAppVersion] = useState<string>('')

  useEffect(() => {
    // Get app version from Electron
    if (window.electronAPI) {
      window.electronAPI.getAppVersion().then(version => {
        setAppVersion(version)
      })
    }
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-right" richColors />

      <div className="container mx-auto p-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">WhisperFlow</h1>
          <p className="text-muted-foreground">
            Транскрипция и форматирование аудио с помощью AI
          </p>
          {appVersion && (
            <p className="text-sm text-muted-foreground mt-2">
              Версия: {appVersion}
            </p>
          )}
        </header>

        <main>
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-2xl font-semibold mb-4">Добро пожаловать!</h2>
            <p className="text-muted-foreground mb-4">
              WhisperFlow находится в разработке. Скоро здесь появится функционал для:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Записи аудио с микрофона и системного звука</li>
              <li>Транскрипции речи в текст через OpenAI Whisper</li>
              <li>Форматирования текста в различные форматы</li>
              <li>Сохранения истории транскрипций</li>
              <li>Экспорта результатов в разные форматы</li>
            </ul>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-semibold mb-2">🎤 Запись</h3>
              <p className="text-sm text-muted-foreground">
                Захват аудио с микрофона или системного звука
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-semibold mb-2">✍️ Транскрипция</h3>
              <p className="text-sm text-muted-foreground">
                Преобразование речи в текст с помощью AI
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-semibold mb-2">📝 Форматирование</h3>
              <p className="text-sm text-muted-foreground">
                Автоматическое форматирование текста
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
