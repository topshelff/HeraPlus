import type { BiometricReading, BiometricSummary } from '../types/index.js'

/**
 * Biometric Service
 *
 * Generates realistic biometric data for the health assessment.
 * This simulates what a real PPG (photoplethysmography) sensor would provide.
 */

interface BiometricSession {
  id: string
  startTime: number
  readings: BiometricReading[]
  baselineBpm: number
  baselineHrv: number
}

const activeSessions = new Map<string, BiometricSession>()

export class PresageService {
  constructor() {}

  async startSession(sessionId: string): Promise<{ status: string }> {
    const session: BiometricSession = {
      id: sessionId,
      startTime: Date.now(),
      readings: [],
      baselineBpm: 68 + Math.random() * 15,
      baselineHrv: 35 + Math.random() * 25,
    }

    activeSessions.set(sessionId, session)
    return { status: 'ready' }
  }

  async processFrame(
    sessionId: string,
    _frameBase64: string,
    timestamp: number
  ): Promise<BiometricReading> {
    const session = activeSessions.get(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    const elapsed = (timestamp - session.startTime) / 1000
    const reading = this.generateReading(session, elapsed)
    session.readings.push(reading)

    return reading
  }

  async stopSession(sessionId: string): Promise<BiometricSummary> {
    const session = activeSessions.get(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    const summary = this.calculateSummary(session)
    activeSessions.delete(sessionId)

    return summary
  }

  private generateReading(session: BiometricSession, elapsed: number): BiometricReading {
    // Realistic physiological variations
    const breathingCycle = Math.sin(elapsed * 0.3) * 3
    const naturalVariation = Math.sin(elapsed * 0.1) * 2
    const noise = (Math.random() - 0.5) * 4

    const bpm = Math.round(session.baselineBpm + breathingCycle + naturalVariation + noise)

    const hrvVariation = Math.sin(elapsed * 0.2) * 8
    const hrv = Math.round(session.baselineHrv + hrvVariation + (Math.random() - 0.5) * 6)

    // Confidence improves as the scan progresses
    const baseConfidence = 0.6
    const calibrationBonus = Math.min(elapsed / 30, 0.3)
    const confidence = Math.min(baseConfidence + calibrationBonus + (Math.random() - 0.5) * 0.1, 1.0)

    return {
      bpm: Math.max(50, Math.min(120, bpm)),
      hrv: Math.max(10, Math.min(80, hrv)),
      confidence: Math.max(0, confidence),
      timestamp: Date.now(),
    }
  }

  private calculateSummary(session: BiometricSession): BiometricSummary {
    const readings = session.readings
    const validReadings = readings.filter((r) => r.confidence > 0.7)

    if (validReadings.length === 0) {
      return {
        avgBpm: 0,
        avgHrv: 0,
        minBpm: 0,
        maxBpm: 0,
        scanDuration: Math.round((Date.now() - session.startTime) / 1000),
        totalReadings: readings.length,
        validReadings: 0,
      }
    }

    const bpmValues = validReadings.map((r) => r.bpm)
    const hrvValues = validReadings.map((r) => r.hrv)

    return {
      avgBpm: Math.round(bpmValues.reduce((a, b) => a + b, 0) / bpmValues.length),
      avgHrv: Math.round(hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length),
      minBpm: Math.min(...bpmValues),
      maxBpm: Math.max(...bpmValues),
      scanDuration: Math.round((Date.now() - session.startTime) / 1000),
      totalReadings: readings.length,
      validReadings: validReadings.length,
    }
  }
}

let presageService: PresageService | null = null

export function getPresageService(): PresageService {
  if (!presageService) {
    presageService = new PresageService()
  }
  return presageService
}
