/**
 * Transcription store using Zustand
 */

import { create } from 'zustand'
import { apiService } from '../services/api.service'
import { audioRecorder, type AudioSource } from '../services/audio.service'
import type {
  TranscriptionStatus,
  FormatType,
  TranscriptionResultResponse,
  HistoryItemResponse,
} from '../types/api'

interface TranscriptionState {
  // Recording state
  isRecording: boolean
  isPaused: boolean
  recordingDuration: number
  audioSource: AudioSource

  // Transcription state
  currentJobId: string | null
  transcriptionStatus: TranscriptionStatus | null
  transcriptionProgress: number
  transcriptionText: string
  transcriptionError: string | null

  // Formatting state
  formattedText: string
  formatType: FormatType | null
  isFormatting: boolean

  // History
  history: HistoryItemResponse[]
  historyTotal: number
  historyPage: number
  historyHasMore: boolean

  // WebSocket
  ws: WebSocket | null

  // Actions
  startRecording: (source: AudioSource) => Promise<void>
  stopRecording: () => Promise<void>
  pauseRecording: () => void
  resumeRecording: () => void
  uploadAudioFile: (file: File) => Promise<void>
  formatText: (formatType: FormatType, customPrompt?: string) => Promise<void>
  loadHistory: (page?: number) => Promise<void>
  connectWebSocket: (jobId: string) => void
  disconnectWebSocket: () => void
  reset: () => void
}

const initialState = {
  isRecording: false,
  isPaused: false,
  recordingDuration: 0,
  audioSource: 'microphone' as AudioSource,
  currentJobId: null,
  transcriptionStatus: null,
  transcriptionProgress: 0,
  transcriptionText: '',
  transcriptionError: null,
  formattedText: '',
  formatType: null,
  isFormatting: false,
  history: [],
  historyTotal: 0,
  historyPage: 1,
  historyHasMore: false,
  ws: null,
}

export const useTranscriptionStore = create<TranscriptionState>((set, get) => ({
  ...initialState,

  /**
   * Start audio recording
   */
  startRecording: async (source: AudioSource) => {
    try {
      await audioRecorder.startRecording({ source })
      set({ isRecording: true, isPaused: false, audioSource: source })

      // Start duration counter
      const interval = setInterval(() => {
        const state = get()
        if (!state.isRecording) {
          clearInterval(interval)
          return
        }
        set({ recordingDuration: state.recordingDuration + 1 })
      }, 1000)
    } catch (error) {
      console.error('Failed to start recording:', error)
      throw error
    }
  },

  /**
   * Stop recording and upload to backend
   */
  stopRecording: async () => {
    try {
      const blob = await audioRecorder.stopRecording()
      const filename = `recording_${Date.now()}.wav`
      const file = audioRecorder.blobToFile(blob, filename)

      set({ isRecording: false, recordingDuration: 0 })

      // Upload to backend
      await get().uploadAudioFile(file)
    } catch (error) {
      console.error('Failed to stop recording:', error)
      set({ isRecording: false })
      throw error
    }
  },

  /**
   * Pause recording
   */
  pauseRecording: () => {
    try {
      audioRecorder.pauseRecording()
      set({ isPaused: true })
    } catch (error) {
      console.error('Failed to pause recording:', error)
      throw error
    }
  },

  /**
   * Resume recording
   */
  resumeRecording: () => {
    try {
      audioRecorder.resumeRecording()
      set({ isPaused: false })
    } catch (error) {
      console.error('Failed to resume recording:', error)
      throw error
    }
  },

  /**
   * Upload audio file for transcription
   */
  uploadAudioFile: async (file: File) => {
    try {
      set({
        transcriptionStatus: 'pending' as TranscriptionStatus,
        transcriptionProgress: 0,
        transcriptionText: '',
        transcriptionError: null,
      })

      const response = await apiService.transcribeAudio(file, {
        language: 'ru',
        response_format: 'verbose_json',
      })

      set({
        currentJobId: response.id,
        transcriptionStatus: response.status,
        transcriptionProgress: response.progress,
      })

      // Connect to WebSocket for real-time updates
      get().connectWebSocket(response.id)

      // Start polling for status (fallback if WebSocket fails)
      const pollInterval = setInterval(async () => {
        try {
          const result = await apiService.getTranscription(response.id)

          if (result.status === 'completed') {
            set({
              transcriptionStatus: result.status,
              transcriptionProgress: 100,
              transcriptionText: result.transcription_text,
            })
            clearInterval(pollInterval)
            get().disconnectWebSocket()
          } else if (result.status === 'failed') {
            set({
              transcriptionStatus: result.status,
              transcriptionError: 'Transcription failed',
            })
            clearInterval(pollInterval)
            get().disconnectWebSocket()
          } else {
            set({
              transcriptionStatus: result.status,
              transcriptionProgress: result.progress || 0,
            })
          }
        } catch (error) {
          console.error('Error polling transcription status:', error)
          clearInterval(pollInterval)
        }
      }, 2000) // Poll every 2 seconds

      // Clear polling after 5 minutes
      setTimeout(() => clearInterval(pollInterval), 300000)
    } catch (error) {
      console.error('Failed to upload audio file:', error)
      set({
        transcriptionStatus: 'failed' as TranscriptionStatus,
        transcriptionError: error instanceof Error ? error.message : 'Upload failed',
      })
      throw error
    }
  },

  /**
   * Format transcribed text
   */
  formatText: async (formatType: FormatType, customPrompt?: string) => {
    const { currentJobId } = get()
    if (!currentJobId) {
      throw new Error('No transcription to format')
    }

    try {
      set({ isFormatting: true, formatType })

      const response = await apiService.formatText({
        transcription_id: currentJobId,
        format_type: formatType,
        custom_prompt: customPrompt,
      })

      set({
        formattedText: response.formatted_text,
        isFormatting: false,
      })
    } catch (error) {
      console.error('Failed to format text:', error)
      set({ isFormatting: false })
      throw error
    }
  },

  /**
   * Load transcription history
   */
  loadHistory: async (page: number = 1) => {
    try {
      const response = await apiService.getHistory(page, 20)

      set({
        history: page === 1 ? response.items : [...get().history, ...response.items],
        historyTotal: response.total,
        historyPage: response.page,
        historyHasMore: response.has_more,
      })
    } catch (error) {
      console.error('Failed to load history:', error)
      throw error
    }
  },

  /**
   * Connect to WebSocket for real-time updates
   */
  connectWebSocket: (jobId: string) => {
    const wsUrl = apiService.getWebSocketUrl(jobId)
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      console.log('WebSocket connected for job:', jobId)
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)

        if (message.type === 'transcription_progress') {
          set({
            transcriptionProgress: message.progress,
            transcriptionStatus: message.status,
          })
        } else if (message.type === 'transcription_completed') {
          set({
            transcriptionStatus: 'completed' as TranscriptionStatus,
            transcriptionProgress: 100,
            transcriptionText: message.transcription_text,
          })
          get().disconnectWebSocket()
        } else if (message.type === 'transcription_failed') {
          set({
            transcriptionStatus: 'failed' as TranscriptionStatus,
            transcriptionError: message.error,
          })
          get().disconnectWebSocket()
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      set({ ws: null })
    }

    set({ ws })
  },

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket: () => {
    const { ws } = get()
    if (ws) {
      ws.close()
      set({ ws: null })
    }
  },

  /**
   * Reset state
   */
  reset: () => {
    get().disconnectWebSocket()
    set(initialState)
  },
}))
