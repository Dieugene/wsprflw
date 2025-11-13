/**
 * Audio recording service using RecordRTC
 */

import RecordRTC, { StereoAudioRecorder } from 'recordrtc'

export type AudioSource = 'microphone' | 'system' | 'both'

export interface AudioRecorderOptions {
  source: AudioSource
  mimeType?: string
  bitrate?: number
}

export class AudioRecorder {
  private recorder: RecordRTC | null = null
  private stream: MediaStream | null = null
  private isRecording: boolean = false
  private isPaused: boolean = false

  /**
   * Start recording audio
   */
  async startRecording(options: AudioRecorderOptions = { source: 'microphone' }): Promise<void> {
    if (this.isRecording) {
      throw new Error('Recording already in progress')
    }

    try {
      // Get media stream based on source
      this.stream = await this.getMediaStream(options.source)

      // Create RecordRTC instance
      this.recorder = new RecordRTC(this.stream, {
        type: 'audio',
        mimeType: options.mimeType || 'audio/wav',
        recorderType: StereoAudioRecorder,
        numberOfAudioChannels: 2,
        desiredSampRate: 16000, // Whisper expects 16kHz
        timeSlice: 1000, // Get data every second
        ondataavailable: (blob) => {
          // Can be used for real-time processing
          console.log('Audio data available:', blob.size)
        },
      })

      this.recorder.startRecording()
      this.isRecording = true
      this.isPaused = false

      console.log('Recording started with source:', options.source)
    } catch (error) {
      console.error('Error starting recording:', error)
      throw new Error('Failed to start recording. Please check microphone permissions.')
    }
  }

  /**
   * Stop recording and get the audio blob
   */
  async stopRecording(): Promise<Blob> {
    if (!this.isRecording || !this.recorder) {
      throw new Error('No recording in progress')
    }

    return new Promise((resolve, reject) => {
      this.recorder!.stopRecording(() => {
        const blob = this.recorder!.getBlob()
        this.cleanup()
        resolve(blob)
      })
    })
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    if (!this.isRecording || !this.recorder || this.isPaused) {
      throw new Error('Cannot pause recording')
    }

    this.recorder.pauseRecording()
    this.isPaused = true
    console.log('Recording paused')
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    if (!this.isRecording || !this.recorder || !this.isPaused) {
      throw new Error('Cannot resume recording')
    }

    this.recorder.resumeRecording()
    this.isPaused = false
    console.log('Recording resumed')
  }

  /**
   * Get media stream based on audio source
   */
  private async getMediaStream(source: AudioSource): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: true,
      video: false,
    }

    switch (source) {
      case 'microphone':
        // Standard microphone input
        return await navigator.mediaDevices.getUserMedia(constraints)

      case 'system':
        // System audio (desktop capture)
        // Note: This requires specific permissions and may not work in all contexts
        return await navigator.mediaDevices.getDisplayMedia({
          video: false,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          } as any,
        })

      case 'both':
        // Combine microphone and system audio
        const micStream = await navigator.mediaDevices.getUserMedia(constraints)
        const sysStream = await navigator.mediaDevices.getDisplayMedia({
          video: false,
          audio: true as any,
        })

        // Create an AudioContext to mix the streams
        const audioContext = new AudioContext()
        const micSource = audioContext.createMediaStreamSource(micStream)
        const sysSource = audioContext.createMediaStreamSource(sysStream)
        const destination = audioContext.createMediaStreamDestination()

        micSource.connect(destination)
        sysSource.connect(destination)

        return destination.stream

      default:
        throw new Error(`Unknown audio source: ${source}`)
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }

    this.recorder = null
    this.isRecording = false
    this.isPaused = false

    console.log('Recording resources cleaned up')
  }

  /**
   * Get recording state
   */
  getState(): { isRecording: boolean; isPaused: boolean } {
    return {
      isRecording: this.isRecording,
      isPaused: this.isPaused,
    }
  }

  /**
   * Convert blob to File object
   */
  blobToFile(blob: Blob, filename: string): File {
    return new File([blob], filename, { type: blob.type })
  }
}

// Export singleton instance
export const audioRecorder = new AudioRecorder()
