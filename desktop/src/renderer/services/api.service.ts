/**
 * API service for WhisperFlow backend
 */

import axios, { AxiosInstance } from 'axios'
import axiosRetry from 'axios-retry'
import type {
  TranscriptionJobResponse,
  TranscriptionResultResponse,
  FormattingCreate,
  FormattingResultResponse,
  HistoryListResponse,
} from '../types/api'

class ApiService {
  private client: AxiosInstance
  private baseURL: string

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 120000, // 2 minutes timeout for large file uploads
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Configure retry logic
    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return (
          axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          error.response?.status === 429 // Retry on rate limit
        )
      },
    })

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          // Server responded with error
          throw new Error(error.response.data?.detail || 'Server error')
        } else if (error.request) {
          // Request made but no response
          throw new Error('Network error. Please check your connection.')
        } else {
          // Something else happened
          throw new Error(error.message || 'Unknown error')
        }
      }
    )
  }

  /**
   * Upload audio file for transcription
   */
  async transcribeAudio(
    file: File,
    options?: {
      language?: string
      model?: string
      temperature?: number
      response_format?: string
    }
  ): Promise<TranscriptionJobResponse> {
    const formData = new FormData()
    formData.append('file', file)

    const params = new URLSearchParams()
    if (options?.language) params.append('language', options.language)
    if (options?.model) params.append('model', options.model)
    if (options?.temperature !== undefined) params.append('temperature', options.temperature.toString())
    if (options?.response_format) params.append('response_format', options.response_format)

    const { data } = await this.client.post<TranscriptionJobResponse>(
      '/api/v1/transcribe' + (params.toString() ? `?${params.toString()}` : ''),
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )

    return data
  }

  /**
   * Get transcription status and result
   */
  async getTranscription(transcriptionId: string): Promise<TranscriptionResultResponse> {
    const { data } = await this.client.get<TranscriptionResultResponse>(
      `/api/v1/transcribe/${transcriptionId}`
    )
    return data
  }

  /**
   * Format transcribed text
   */
  async formatText(request: FormattingCreate): Promise<FormattingResultResponse> {
    const { data } = await this.client.post<FormattingResultResponse>(
      '/api/v1/format',
      request
    )
    return data
  }

  /**
   * Get transcription history
   */
  async getHistory(
    page: number = 1,
    pageSize: number = 20,
    search?: string,
    status?: string
  ): Promise<HistoryListResponse> {
    const params: any = { page, page_size: pageSize }
    if (search) params.search = search
    if (status && status !== 'all') params.status = status

    const { data } = await this.client.get<HistoryListResponse>('/api/v1/history', { params })
    return data
  }

  /**
   * Delete a history item by ID
   */
  async deleteHistoryItem(id: string): Promise<void> {
    await this.client.delete(`/api/v1/history/${id}`)
  }

  /**
   * Get WebSocket URL for job updates
   */
  getWebSocketUrl(jobId: string): string {
    const wsProtocol = this.baseURL.startsWith('https') ? 'wss' : 'ws'
    const wsBaseUrl = this.baseURL.replace(/^https?/, wsProtocol)
    return `${wsBaseUrl}/api/v1/ws/${jobId}`
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; environment: string }> {
    const { data } = await this.client.get('/health')
    return data
  }
}

export const apiService = new ApiService()
