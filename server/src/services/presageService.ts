import { spawn, type ChildProcess } from 'child_process'
import { createInterface } from 'readline'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'
import os from 'os'
import type { BiometricReading, BiometricSummary } from '../types/index.js'

/**
 * Biometric Service – Presage vitals
 *
 * Modes (in order of precedence):
 * 1. PRESAGE_VIDEO_API_URL set → batch: collect frames, build video, POST to Presage Engine (e.g. Docker).
 * 2. PRESAGE_API_URL set → per-frame API: POST frame, get { bpm, hrv, confidence }.
 * 3. PRESAGE_BRIDGE_PATH set → bridge process (mock default or real C++ bridge).
 * 4. Otherwise → in-process simulation.
 *
 * Presage Engine (Docker): https://github.com/seifotefa/deltahacks-12/tree/main/presage-engine
 * Expects POST /process-video with raw video body; returns vitals summary.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_MOCK_BRIDGE_PATH = path.resolve(__dirname, '..', '..', 'scripts', 'presage-mock-bridge.js')

const PRESAGE_API_KEY = process.env.PRESAGE_API_KEY ?? ''
const PRESAGE_API_URL = (process.env.PRESAGE_API_URL ?? '').trim()
const PRESAGE_VIDEO_API_URL = (process.env.PRESAGE_VIDEO_API_URL ?? '').trim()

/** Bridge path: default mock when unset; set to "" to force in-process simulation when no API URL. */
const PRESAGE_BRIDGE_PATH =
  process.env.PRESAGE_BRIDGE_PATH !== undefined
    ? process.env.PRESAGE_BRIDGE_PATH.trim()
    : DEFAULT_MOCK_BRIDGE_PATH

/** Using Presage Engine (Docker) – upload full video, get summary. */
const usePresageVideoApi = PRESAGE_VIDEO_API_URL.length > 0
/** Using a direct per-frame Presage (or compatible) HTTP API. */
const usePresageApi = !usePresageVideoApi && PRESAGE_API_URL.length > 0
/** Using a bridge (mock or real C++). Mock = default bridge path. */
const useBridge = !usePresageVideoApi && !usePresageApi && PRESAGE_BRIDGE_PATH.length > 0
const isMockBridge = useBridge && path.basename(PRESAGE_BRIDGE_PATH) === 'presage-mock-bridge.js'

export type PresageMode = 'video_api' | 'api' | 'bridge' | 'simulation'
export function getPresageMode(): PresageMode {
  if (usePresageVideoApi) return 'video_api'
  if (usePresageApi) return 'api'
  if (useBridge) return 'bridge'
  return 'simulation'
}
/** True only when using real Presage (video API, per-frame API, or non-mock bridge). */
export function isRealPresage(): boolean {
  return usePresageVideoApi || usePresageApi || (useBridge && !isMockBridge)
}

interface BiometricSession {
  id: string
  startTime: number
  readings: BiometricReading[]
  baselineBpm: number
  baselineHrv: number
  /** When using bridge: child process and pending read promise */
  bridgeProcess?: ChildProcess
  pendingRead?: { resolve: (r: BiometricReading) => void; reject: (e: Error) => void }
  /** When using video API: collect frames for batch upload */
  storedFrames?: string[]
}

const activeSessions = new Map<string, BiometricSession>()

function parseBridgeReading(line: string, timestamp: number): BiometricReading {
  const raw = JSON.parse(line) as { bpm?: number; hrv?: number; confidence?: number }
  const bpm = Math.max(50, Math.min(120, Number(raw.bpm) || 72))
  const hrv = Math.max(10, Math.min(80, Number(raw.hrv) || 45))
  const confidence = Math.max(0, Math.min(1, Number(raw.confidence) ?? 0.8))
  return { bpm, hrv, confidence, timestamp }
}

function spawnBridge(): ChildProcess {
  const apiKey = PRESAGE_API_KEY
  const bridgePath = PRESAGE_BRIDGE_PATH.trim()
  const isNodeScript =
    bridgePath.endsWith('.js') || bridgePath.endsWith('.mjs') || bridgePath.endsWith('.cjs')
  const cmd = isNodeScript ? 'node' : bridgePath
  const args = isNodeScript ? [bridgePath] : []

  const child = spawn(cmd, args, {
    env: {
      ...process.env,
      PRESAGE_API_KEY: apiKey,
      SMARTSPECTRA_API_KEY: apiKey,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  child.on('error', (err) => {
    console.error('Presage bridge spawn error:', err)
  })
  child.stderr?.on('data', (chunk) => {
    process.stderr.write('[presage-bridge] ')
    process.stderr.write(chunk)
  })

  return child
}

async function callPresageApi(frameBase64: string, timestamp: number): Promise<BiometricReading> {
  const url = PRESAGE_API_URL
  const body = JSON.stringify({ frame: frameBase64, timestamp })
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (PRESAGE_API_KEY) headers['Authorization'] = `Bearer ${PRESAGE_API_KEY}`

  const res = await fetch(url, { method: 'POST', headers, body })
  if (!res.ok) throw new Error(`Presage API ${res.status}: ${await res.text()}`)
  const raw = (await res.json()) as { bpm?: number; hrv?: number; confidence?: number }
  return parseBridgeReading(JSON.stringify(raw), timestamp)
}

/** Build MP4 from base64 JPEG frames using ffmpeg; return path to temp file. */
async function buildMp4FromFrames(frames: string[], framerate = 5): Promise<string> {
  const tmpDir = path.join(os.tmpdir(), `heradx-presage-${Date.now()}`)
  await fs.mkdir(tmpDir, { recursive: true })
  try {
    for (let i = 0; i < frames.length; i++) {
      const buf = Buffer.from(frames[i]!, 'base64')
      await fs.writeFile(path.join(tmpDir, `frame_${String(i).padStart(4, '0')}.jpg`), buf)
    }
    const outPath = path.join(tmpDir, 'out.mp4')
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        'ffmpeg',
        [
          '-y',
          '-framerate',
          String(framerate),
          '-i',
          path.join(tmpDir, 'frame_%04d.jpg'),
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          outPath,
        ],
        { stdio: 'ignore' }
      )
      proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))))
    })
    return outPath
  } catch (e) {
    await fs.rm(tmpDir, { recursive: true, force: true })
    throw e
  }
}

/** POST video to Presage Engine (deltahacks-12 style); return BiometricSummary. */
async function callPresageVideoApi(
  videoPath: string,
  sessionStartTime: number
): Promise<BiometricSummary> {
  const videoBuf = await fs.readFile(videoPath)
  await fs.rm(path.dirname(videoPath), { recursive: true, force: true })
  const url = PRESAGE_VIDEO_API_URL
  const headers: Record<string, string> = { 'Content-Type': 'video/mp4' }
  if (PRESAGE_API_KEY) headers['Authorization'] = `Bearer ${PRESAGE_API_KEY}`

  const res = await fetch(url, { method: 'POST', headers, body: videoBuf })
  if (!res.ok) throw new Error(`Presage Video API ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as {
    success?: boolean
    vitals?: {
      heart_rate?: { avg?: number; min?: number; max?: number; count?: number }
      breathing_rate?: { avg?: number; min?: number; max?: number; count?: number }
      readings_count?: number
    }
  }
  const vitals = data.vitals
  const hr = vitals?.heart_rate
  const br = vitals?.breathing_rate
  const count = vitals?.readings_count ?? hr?.count ?? 0
  const scanDuration = Math.round((Date.now() - sessionStartTime) / 1000)
  return {
    avgBpm: Math.round(hr?.avg ?? 0),
    avgHrv: Math.round(br?.avg ?? 0),
    minBpm: Math.round(hr?.min ?? 0),
    maxBpm: Math.round(hr?.max ?? 0),
    scanDuration,
    totalReadings: count,
    validReadings: count,
  }
}

export class PresageService {
  constructor() {}

  getMode(): PresageMode {
    return getPresageMode()
  }

  isUsingRealPresage(): boolean {
    return isRealPresage()
  }

  async startSession(sessionId: string): Promise<{ status: string }> {
    const session: BiometricSession = {
      id: sessionId,
      startTime: Date.now(),
      readings: [],
      baselineBpm: 68 + Math.random() * 15,
      baselineHrv: 35 + Math.random() * 25,
    }
    if (usePresageVideoApi) {
      session.storedFrames = []
    }

    if (useBridge) {
      try {
        const child = spawnBridge()
        session.bridgeProcess = child

        const rl = createInterface({ input: child.stdout!, crlfDelay: Infinity })
        rl.on('line', (line) => {
          const pending = session.pendingRead
          if (pending) {
            session.pendingRead = undefined
            try {
              const reading = parseBridgeReading(line.trim(), Date.now())
              pending.resolve(reading)
            } catch (e) {
              pending.reject(e instanceof Error ? e : new Error(String(e)))
            }
          }
        })

        child.on('close', (code, signal) => {
          const pending = session.pendingRead
          if (pending) {
            session.pendingRead = undefined
            pending.reject(new Error(`Bridge exited: code=${code} signal=${signal}`))
          }
        })
      } catch (e) {
        activeSessions.delete(sessionId)
        throw new Error(
          `Failed to start Presage bridge (PRESAGE_BRIDGE_PATH=${PRESAGE_BRIDGE_PATH}): ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }

    activeSessions.set(sessionId, session)
    return { status: 'ready' }
  }

  async processFrame(
    sessionId: string,
    frameBase64: string,
    timestamp: number
  ): Promise<BiometricReading> {
    const session = activeSessions.get(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    if (usePresageVideoApi && session.storedFrames) {
      session.storedFrames.push(frameBase64)
      const elapsed = (timestamp - session.startTime) / 1000
      const reading = this.generateReading(session, elapsed)
      session.readings.push(reading)
      return reading
    }

    if (usePresageApi) {
      const reading = await callPresageApi(frameBase64, timestamp)
      session.readings.push(reading)
      return reading
    }

    if (session.bridgeProcess?.stdin) {
      const BRIDGE_READ_TIMEOUT_MS = 20000
      return new Promise<BiometricReading>((resolve, reject) => {
        const timeout = setTimeout(() => {
          if (session.pendingRead) {
            session.pendingRead = undefined
            reject(new Error('Presage bridge read timeout'))
          }
        }, BRIDGE_READ_TIMEOUT_MS)
        session.pendingRead = {
          resolve: (r) => {
            clearTimeout(timeout)
            resolve(r)
          },
          reject: (e) => {
            clearTimeout(timeout)
            reject(e)
          },
        }
        const payload = JSON.stringify({ frame: frameBase64, timestamp }) + '\n'
        session.bridgeProcess!.stdin!.write(payload, (err) => {
          if (err) {
            clearTimeout(timeout)
            session.pendingRead = undefined
            reject(err)
          }
        })
      }).then((reading) => {
        session.readings.push(reading)
        return reading
      })
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

    if (usePresageVideoApi && session.storedFrames && session.storedFrames.length > 0) {
      const videoPath = await buildMp4FromFrames(session.storedFrames, 5)
      const summary = await callPresageVideoApi(videoPath, session.startTime)
      activeSessions.delete(sessionId)
      return summary
    }

    if (session.bridgeProcess?.stdin) {
      try {
        session.bridgeProcess.stdin.write(JSON.stringify({ end: true }) + '\n')
        session.bridgeProcess.stdin.end()
      } catch (_) {}
      session.bridgeProcess.kill('SIGTERM')
      session.bridgeProcess = undefined
    }

    const summary = this.calculateSummary(session)
    activeSessions.delete(sessionId)
    return summary
  }

  private generateReading(session: BiometricSession, elapsed: number): BiometricReading {
    const breathingCycle = Math.sin(elapsed * 0.3) * 3
    const naturalVariation = Math.sin(elapsed * 0.1) * 2
    const noise = (Math.random() - 0.5) * 4
    const bpm = Math.round(session.baselineBpm + breathingCycle + naturalVariation + noise)
    const hrvVariation = Math.sin(elapsed * 0.2) * 8
    const hrv = Math.round(session.baselineHrv + hrvVariation + (Math.random() - 0.5) * 6)
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
