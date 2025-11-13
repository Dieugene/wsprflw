/**
 * Text formatting panel component
 */

import { useState } from 'react'
import { Sparkles, Copy, Download, Loader2 } from 'lucide-react'
import { useTranscriptionStore } from '../store/transcription.store'
import { FormatType, TranscriptionStatus } from '../types/api'
import { toast } from 'sonner'

const FORMAT_OPTIONS = [
  { value: FormatType.SUMMARY, label: 'Краткое резюме', description: 'Сжатая версия с ключевыми моментами' },
  { value: FormatType.BULLETS, label: 'Список пунктов', description: 'Структурированный список основных идей' },
  { value: FormatType.STRUCTURED, label: 'Структурированный текст', description: 'С заголовками и разделами' },
  { value: FormatType.EMAIL, label: 'Деловое письмо', description: 'Формальное деловое письмо' },
  { value: FormatType.NOTES, label: 'Заметки', description: 'Структурированные заметки' },
]

export function FormattingPanel() {
  const {
    transcriptionStatus,
    transcriptionText,
    formattedText,
    formatType,
    isFormatting,
    formatText,
  } = useTranscriptionStore()

  const [selectedFormat, setSelectedFormat] = useState<FormatType>(FormatType.SUMMARY)

  const canFormat = transcriptionStatus === TranscriptionStatus.COMPLETED && transcriptionText

  const handleFormat = async () => {
    if (!canFormat) return

    try {
      await formatText(selectedFormat)
      toast.success('Текст успешно отформатирован')
    } catch (error) {
      toast.error('Не удалось отформатировать текст')
      console.error(error)
    }
  }

  const handleCopy = () => {
    if (formattedText) {
      navigator.clipboard.writeText(formattedText)
      toast.success('Отформатированный текст скопирован в буфер обмена')
    }
  }

  const handleDownload = () => {
    if (formattedText) {
      const blob = new Blob([formattedText], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `formatted_${selectedFormat}_${Date.now()}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Файл загружен')
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-xl font-semibold mb-4">Форматирование текста</h2>

      {/* Format selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Выберите формат</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {FORMAT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedFormat(option.value)}
              disabled={!canFormat}
              className={`
                p-3 rounded-md border-2 text-left transition-all
                ${
                  selectedFormat === option.value
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                    : 'border-border bg-background hover:border-blue-400'
                }
                ${!canFormat ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="font-medium text-sm">{option.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Format button */}
      <button
        onClick={handleFormat}
        disabled={!canFormat || isFormatting}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isFormatting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Форматируется...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Отформатировать
          </>
        )}
      </button>

      {/* Status message */}
      {!canFormat && (
        <p className="mt-3 text-sm text-muted-foreground text-center">
          Дождитесь завершения транскрипции для форматирования текста
        </p>
      )}

      {/* Formatted text output */}
      {formattedText && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">
              Результат ({FORMAT_OPTIONS.find((o) => o.value === formatType)?.label})
            </h3>
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
          </div>

          <div className="bg-background rounded-md p-4 border border-border">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{formattedText}</div>
          </div>
        </div>
      )}
    </div>
  )
}
