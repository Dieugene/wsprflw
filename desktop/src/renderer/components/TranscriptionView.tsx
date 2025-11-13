/**
 * Transcription view component
 */

import { FileText, Copy, Download, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useTranscriptionStore } from '../store/transcription.store'
import { TranscriptionStatus } from '../types/api'
import { toast } from 'sonner'

export function TranscriptionView() {
  const {
    currentJobId,
    transcriptionStatus,
    transcriptionProgress,
    transcriptionText,
    transcriptionError,
  } = useTranscriptionStore()

  const handleCopy = () => {
    if (transcriptionText) {
      navigator.clipboard.writeText(transcriptionText)
      toast.success('Текст скопирован в буфер обмена')
    }
  }

  const handleDownload = () => {
    if (transcriptionText) {
      const blob = new Blob([transcriptionText], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transcription_${Date.now()}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Файл загружен')
    }
  }

  if (!currentJobId) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="w-16 h-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Нет активной транскрипции</h3>
          <p className="text-sm text-muted-foreground">
            Начните запись или загрузите аудио файл, чтобы увидеть результаты транскрипции
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Транскрипция</h2>
        {transcriptionStatus === TranscriptionStatus.COMPLETED && (
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
              title="Копировать"
            >
              <Copy className="w-4 h-4" />
              Копировать
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
              title="Скачать"
            >
              <Download className="w-4 h-4" />
              Скачать
            </button>
          </div>
        )}
      </div>

      {/* Status indicator */}
      <div className="mb-4">
        {transcriptionStatus === TranscriptionStatus.PENDING && (
          <div className="flex items-center gap-2 text-yellow-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Ожидание обработки...</span>
          </div>
        )}

        {transcriptionStatus === TranscriptionStatus.PROCESSING && (
          <div>
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Транскрибируется... {transcriptionProgress}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${transcriptionProgress}%` }}
              />
            </div>
          </div>
        )}

        {transcriptionStatus === TranscriptionStatus.COMPLETED && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="w-5 h-5" />
            <span>Транскрипция завершена</span>
          </div>
        )}

        {transcriptionStatus === TranscriptionStatus.FAILED && (
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-5 h-5" />
            <span>Ошибка транскрипции: {transcriptionError || 'Неизвестная ошибка'}</span>
          </div>
        )}
      </div>

      {/* Transcription text */}
      {transcriptionText && (
        <div className="bg-background rounded-md p-4 border border-border">
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{transcriptionText}</div>
        </div>
      )}

      {/* Loading state */}
      {(transcriptionStatus === TranscriptionStatus.PENDING ||
        transcriptionStatus === TranscriptionStatus.PROCESSING) &&
        !transcriptionText && (
          <div className="bg-background rounded-md p-8 border border-border">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Пожалуйста, подождите. Это может занять несколько минут...
              </p>
            </div>
          </div>
        )}
    </div>
  )
}
