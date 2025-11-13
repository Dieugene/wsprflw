/**
 * API types for WhisperFlow
 */

export enum TranscriptionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum FormatType {
  SUMMARY = 'summary',
  BULLETS = 'bullets',
  STRUCTURED = 'structured',
  EMAIL = 'email',
  NOTES = 'notes',
  CUSTOM = 'custom',
}

export interface TranscriptionSegment {
  id: number
  start: number
  end: number
  text: string
}

export interface TranscriptionJobResponse {
  id: string
  status: TranscriptionStatus
  progress: number
  created_at: string
  message: string
}

export interface TranscriptionStatusResponse {
  id: string
  status: TranscriptionStatus
  progress: number
  created_at: string
  updated_at: string
  audio_duration?: number
  error_message?: string
}

export interface TranscriptionResultResponse {
  id: string
  status: TranscriptionStatus
  transcription_text: string
  language: string
  audio_duration?: number
  segments?: any[]
  created_at: string
  completed_at: string
}

export interface FormattingCreate {
  transcription_id: string
  format_type: FormatType
  custom_prompt?: string
}

export interface FormattingResultResponse {
  id: string
  transcription_id: string
  format_type: FormatType
  formatted_text: string
  created_at: string
}

export interface HistoryItemResponse {
  id: string
  audio_filename?: string
  audio_duration?: number
  status: TranscriptionStatus
  transcription_preview?: string
  formatted_preview?: string
  format_type?: FormatType
  created_at: string
  updated_at: string
}

export interface HistoryListResponse {
  items: HistoryItemResponse[]
  total: number
  page: number
  page_size: number
  has_more: boolean
}

export interface WsMessage {
  type: 'transcription_progress' | 'transcription_completed' | 'transcription_failed' | 'pong'
  job_id?: string
  progress?: number
  status?: TranscriptionStatus
  message?: string
  transcription_text?: string
  duration?: number
  error?: string
  data?: any
}

export interface ErrorResponse {
  detail: string
  error_code?: string
  timestamp: string
}
