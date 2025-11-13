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
  isLoadingHistory: boolean
  selectedHistoryItem: string | null
  historySearch: string
  historyStatusFilter: string

  // WebSocket
  ws: WebSocket | null

  // Actions
  startRecording: (source: AudioSource) => Promise<void>
  stopRecording: () => Promise<void>
  pauseRecording: () => void
  resumeRecording: () => void
  uploadAudioFile: (file: File) => Promise<void>
  formatText: (formatType: FormatType, customPrompt?: string) => Promise<void>
  loadHistory: (page?: number, search?: string, statusFilter?: string) => Promise<void>
  loadTranscriptionById: (id: string) => Promise<void>
  deleteHistoryItem: (id: string) => Promise<void>
  setHistorySearch: (search: string) => void
  setHistoryStatusFilter: (filter: string) => void
  refreshHistoryOnComplete: () => void
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
  isLoadingHistory: false,
  selectedHistoryItem: null,
  historySearch: '',
  historyStatusFilter: 'all',
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
            get().refreshHistoryOnComplete()
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
  loadHistory: async (page: number = 1, search?: string, statusFilter?: string) => {
    try {
      set({ isLoadingHistory: true })

      // Use parameters or fall back to store state
      const searchQuery = search !== undefined ? search : get().historySearch
      const filter = statusFilter !== undefined ? statusFilter : get().historyStatusFilter

      const response = await apiService.getHistory(page, 20, searchQuery, filter)

      set({
        history: page === 1 ? response.items : [...get().history, ...response.items],
        historyTotal: response.total,
        historyPage: response.page,
        historyHasMore: response.has_more,
        isLoadingHistory: false,
      })
    } catch (error) {
      console.error('Failed to load history:', error)
      set({ isLoadingHistory: false })
      throw error
    }
  },

  /**
   * Load transcription by ID and display in main view
   */
  loadTranscriptionById: async (id: string) => {
    try {
      const result = await apiService.getTranscription(id)

      // Check if transcription is completed
      if (result.status !== 'completed') {
        throw new Error('Транскрипция еще не завершена. Пожалуйста, подождите.')
      }

      set({
        currentJobId: result.id,
        transcriptionStatus: result.status,
        transcriptionText: result.transcription_text,
        selectedHistoryItem: id,
      })

      // Load formatted text if available
      if (result.formatted_text && result.format_type) {
        set({
          formattedText: result.formatted_text,
          formatType: result.format_type,
        })
      } else {
        // Clear formatted text if not available
        set({
          formattedText: '',
          formatType: null,
        })
      }
    } catch (error) {
      console.error('Failed to load transcription:', error)
      throw error
    }
  },

  /**
   * Delete a history item
   */
  deleteHistoryItem: async (id: string) => {
    try {
      await apiService.deleteHistoryItem(id)

      // Remove from local state
      const { history, historyTotal, historyPage } = get()
      const updatedHistory = history.filter((item) => item.id !== id)

      set({
        history: updatedHistory,
        historyTotal: historyTotal - 1,
      })

      // Reload page if list is now empty and we're not on page 1
      if (updatedHistory.length === 0 && historyPage > 1) {
        get().loadHistory(historyPage - 1)
      }
    } catch (error) {
      console.error('Failed to delete history item:', error)
      throw error
    }
  },

  /**
   * Set history search query
   */
  setHistorySearch: (search: string) => {
    set({ historySearch: search })
  },

  /**
   * Set history status filter
   */
  setHistoryStatusFilter: (filter: string) => {
    set({ historyStatusFilter: filter })
  },

  /**
   * Refresh history when a new transcription completes
   */
  refreshHistoryOnComplete: () => {
    const { historyPage } = get()

    // Only auto-refresh if on page 1
    // Otherwise, just increment the total count
    if (historyPage === 1) {
      get().loadHistory(1)
    } else {
      set({ historyTotal: get().historyTotal + 1 })
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
          get().refreshHistoryOnComplete()
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
