/**
 * Recording panel component
 */

import { useState } from 'react'
import { Mic, Square, Pause, Play, Upload } from 'lucide-react'
import { useTranscriptionStore } from '../store/transcription.store'
import type { AudioSource } from '../services/audio.service'
import { toast } from 'sonner'

export function RecordingPanel() {
  const {
    isRecording,
    isPaused,
    recordingDuration,
    audioSource,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    uploadAudioFile,
  } = useTranscriptionStore()

  const [selectedSource, setSelectedSource] = useState<AudioSource>('microphone')

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleStartRecording = async () => {
    try {
      await startRecording(selectedSource)
      toast.success('Запись началась')
    } catch (error) {
      toast.error('Не удалось начать запись. Проверьте разрешения микрофона.')
      console.error(error)
    }
  }

  const handleStopRecording = async () => {
    try {
      await stopRecording()
      toast.success('Запись остановлена и отправлена на транскрипцию')
    } catch (error) {
      toast.error('Не удалось остановить запись')
      console.error(error)
    }
  }

  const handlePauseResume = () => {
    try {
      if (isPaused) {
        resumeRecording()
        toast.info('Запись возобновлена')
      } else {
        pauseRecording()
        toast.info('Запись приостановлена')
      }
    } catch (error) {
      toast.error('Ошибка при изменении статуса записи')
      console.error(error)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      toast.info('Загрузка аудио файла...')
      await uploadAudioFile(file)
      toast.success('Файл загружен и отправлен на транскрипцию')
    } catch (error) {
      toast.error('Не удалось загрузить файл')
      console.error(error)
    }

    // Reset input
    event.target.value = ''
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-xl font-semibold mb-4">Запись аудио</h2>

      {/* Audio source selector */}
      {!isRecording && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Источник аудио</label>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value as AudioSource)}
            className="w-full px-3 py-2 rounded-md border border-border bg-background"
          >
            <option value="microphone">Микрофон</option>
            <option value="system">Системный звук</option>
            <option value="both">Микрофон + Системный звук</option>
          </select>
        </div>
      )}

      {/* Recording controls */}
      <div className="flex items-center justify-center gap-4 mb-6">
        {!isRecording ? (
          <>
            <button
              onClick={handleStartRecording}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              <Mic className="w-5 h-5" />
              Начать запись
            </button>

            <label className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors cursor-pointer">
              <Upload className="w-5 h-5" />
              Загрузить файл
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </>
        ) : (
          <>
            <button
              onClick={handlePauseResume}
              className="flex items-center gap-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors"
            >
              {isPaused ? (
                <>
                  <Play className="w-5 h-5" />
                  Продолжить
                </>
              ) : (
                <>
                  <Pause className="w-5 h-5" />
                  Пауза
                </>
              )}
            </button>

            <button
              onClick={handleStopRecording}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              <Square className="w-5 h-5" />
              Остановить
            </button>
          </>
        )}
      </div>

      {/* Recording status */}
      {isRecording && (
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
            <span className="text-lg font-medium">
              {isPaused ? 'Приостановлено' : 'Идет запись'}
            </span>
          </div>
          <div className="text-2xl font-mono font-bold">{formatDuration(recordingDuration)}</div>
          <div className="text-sm text-muted-foreground mt-1">
            Источник: {audioSource === 'microphone' ? 'Микрофон' : audioSource === 'system' ? 'Системный звук' : 'Микрофон + Системный звук'}
          </div>
        </div>
      )}

      {/* Supported formats */}
      {!isRecording && (
        <div className="mt-4 text-sm text-muted-foreground">
          <p>Поддерживаемые форматы: mp3, mp4, mpeg, mpga, m4a, wav, webm</p>
          <p>Максимальный размер файла: 25 MB</p>
        </div>
      )}
    </div>
  )
}
