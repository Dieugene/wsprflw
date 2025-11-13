// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Transcription types
export interface TranscriptionJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  createdAt: string
  completedAt?: string
  error?: string
}

export interface TranscriptionResult {
  id: string
  jobId: string
  text: string
  language: string
  duration: number
  timestamps?: TranscriptionSegment[]
  createdAt: string
}

export interface TranscriptionSegment {
  id: number
  start: number
  end: number
  text: string
}

// Formatting types
export type FormatType = 'summary' | 'bullets' | 'structured' | 'email' | 'notes' | 'custom'

export interface FormattingOptions {
  type: FormatType
  customPrompt?: string
}

export interface FormattedResult {
  id: string
  transcriptionId: string
  originalText: string
  formattedText: string
  formatType: FormatType
  createdAt: string
}

// Audio types
export interface AudioRecording {
  id: string
  blob: Blob
  duration: number
  size: number
  format: string
  createdAt: string
}

export interface AudioDevice {
  deviceId: string
  label: string
  kind: 'audioinput' | 'audiooutput'
}

// Settings types
export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  language: 'ru' | 'en'
  apiUrl: string
  autoFormat: boolean
  defaultFormatType: FormatType
  audioQuality: 'low' | 'medium' | 'high'
  saveHistory: boolean
}

// History types
export interface HistoryItem {
  id: string
  audioId: string
  transcriptionId: string
  formattedId?: string
  title: string
  preview: string
  duration: number
  createdAt: string
  tags?: string[]
}

// WebSocket message types
export type WsMessageType =
  | 'transcription_started'
  | 'transcription_progress'
  | 'transcription_completed'
  | 'transcription_failed'
  | 'formatting_started'
  | 'formatting_completed'
  | 'formatting_failed'

export interface WsMessage<T = any> {
  type: WsMessageType
  data: T
  timestamp: string
}

// Store types
export interface AudioState {
  isRecording: boolean
  isPaused: boolean
  duration: number
  currentRecording: AudioRecording | null
  devices: AudioDevice[]
  selectedDeviceId: string | null
}

export interface TranscriptionState {
  currentJob: TranscriptionJob | null
  result: TranscriptionResult | null
  isLoading: boolean
  error: string | null
}

export interface FormattingState {
  result: FormattedResult | null
  isLoading: boolean
  error: string | null
}

export interface HistoryState {
  items: HistoryItem[]
  isLoading: boolean
  error: string | null
}

export interface SettingsState {
  settings: AppSettings
  isLoading: boolean
  error: string | null
}
