const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  }

  if (body) {
    config.body = JSON.stringify(body)
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

// Biometrics API
export const biometricsApi = {
  getMode: () =>
    apiRequest<{ mode: 'video_api' | 'api' | 'bridge' | 'simulation'; realPresage: boolean }>(
      '/api/biometrics/mode'
    ),

  start: (sessionId: string) =>
    apiRequest<{ status: string }>('/api/biometrics/start', {
      method: 'POST',
      body: { sessionId },
    }),

  processFrame: (sessionId: string, frame: string, timestamp: number) =>
    apiRequest<{ bpm: number; hrv: number; confidence: number; timestamp: number }>(
      '/api/biometrics/frame',
      {
        method: 'POST',
        body: { sessionId, frame, timestamp },
      }
    ),

  stop: (sessionId: string) =>
    apiRequest<{
      avgBpm: number
      avgHrv: number
      minBpm: number
      maxBpm: number
      scanDuration: number
      totalReadings: number
      validReadings: number
      source?: 'presage' | 'fallback'
    }>('/api/biometrics/stop', {
      method: 'POST',
      body: { sessionId },
    }),
}

// Diagnosis API
export const diagnosisApi = {
  analyze: (intake: unknown, biometrics: unknown) =>
    apiRequest<{
      urgencyLevel: string
      urgencyReason: string
      primaryAssessment: string
      differentialConsiderations: string[]
      redFlags: string[]
      recommendations: string[]
      specialtyReferral?: string
      disclaimer: string
    }>('/api/diagnosis/analyze', {
      method: 'POST',
      body: { intake, biometrics },
    }),
}

// Voice API
export const voiceApi = {
  getAudioUrl: async (text: string): Promise<string> => {
    const response = await fetch(`${API_BASE}/api/voice/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      throw new Error('Failed to generate speech')
    }

    const blob = await response.blob()
    return URL.createObjectURL(blob)
  },

  getScripts: () =>
    apiRequest<{ phases: string[]; scripts: Record<string, string> }>('/api/voice/scripts'),

  /** Speech-to-text: transcribe audio blob (ElevenLabs Scribe). */
  transcribe: async (audioBlob: Blob): Promise<string> => {
    const response = await fetch(`${API_BASE}/api/voice/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': audioBlob.type || 'audio/webm' },
      body: audioBlob,
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Transcription failed' }))
      throw new Error(err.error || 'Transcription failed')
    }

    const data = (await response.json()) as { text: string }
    return data.text ?? ''
  },
}

// Clinics API
export const clinicsApi = {
  findNearby: (lat: number, lng: number, radius?: number) =>
    apiRequest<{
      clinics: Array<{
        id: string
        name: string
        address: string
        location: { lat: number; lng: number }
        phone?: string
        website?: string
        distance?: number
      }>
    }>(`/api/clinics/nearby?lat=${lat}&lng=${lng}${radius ? `&radius=${radius}` : ''}`),
}
