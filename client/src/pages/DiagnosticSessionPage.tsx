import { useEffect, useCallback, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { useBiometrics } from '../context/BiometricContext'
import { useApp } from '../context/AppContext'
import CameraView from '../components/diagnostic/CameraView'
import BiometricOverlay from '../components/diagnostic/BiometricOverlay'
import VoicePlayer from '../components/diagnostic/VoicePlayer'
import ScanProgress from '../components/diagnostic/ScanProgress'
import Button from '../components/common/Button'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { biometricsApi } from '../services/api'
import type { BiometricSummary } from '../types'

const SCAN_DURATION_SECONDS = 30
const FRAME_CAPTURE_INTERVAL_MS = 200 // ~5 FPS for Presage-style processing

export default function DiagnosticSessionPage() {
  const navigate = useNavigate()
  const { lifeStage, selectedBodyParts, symptoms, setDiagnosisResult } = useApp()
  const {
    scanPhase,
    setScanPhase,
    initializeCamera,
    stopCamera,
    processingDiagnosis,
    setProcessingDiagnosis,
    error,
    cameraStream,
  } = useSession()
  const { startScan, stopScan, addReading, getSummary, scanDuration, isScanning } = useBiometrics()
  const [isInitializing, setIsInitializing] = useState(true)
  const [lastServerSummary, setLastServerSummary] = useState<BiometricSummary | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const captureVideoRef = useRef<HTMLVideoElement | null>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameIntervalRef = useRef<number | null>(null)

  // Initialize camera on mount
  useEffect(() => {
    const init = async () => {
      try {
        await initializeCamera()
        setIsInitializing(false)
        setScanPhase('welcome')
      } catch {
        setIsInitializing(false)
      }
    }
    init()

    return () => {
      stopCamera()
      stopScan()
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current)
      }
      const sid = sessionIdRef.current
      if (sid) {
        biometricsApi.stop(sid).catch(() => {})
        sessionIdRef.current = null
      }
    }
  }, [initializeCamera, stopCamera, stopScan, setScanPhase])

  // Presage-style vitals: capture camera frames and send to server for BPM/HRV
  useEffect(() => {
    if (!isScanning || !cameraStream || !sessionIdRef.current) return

    const video = captureVideoRef.current
    const canvas = captureCanvasRef.current
    if (!video || !canvas) return

    video.srcObject = cameraStream
    video.play().catch(() => {})

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const sessionId = sessionIdRef.current

    const captureAndSendFrame = async () => {
      if (video.readyState < 2 || video.videoWidth === 0) return
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      const base64 = dataUrl.split(',')[1]
      if (!base64) return
      try {
        const reading = await biometricsApi.processFrame(sessionId, base64, Date.now())
        addReading(reading)
      } catch (e) {
        console.warn('Frame processing error:', e)
      }
    }

    const onCanPlay = () => {
      frameIntervalRef.current = window.setInterval(
        captureAndSendFrame,
        FRAME_CAPTURE_INTERVAL_MS
      )
    }

    if (video.readyState >= 2) {
      onCanPlay()
    } else {
      video.addEventListener('canplay', onCanPlay, { once: true })
    }

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current)
        frameIntervalRef.current = null
      }
      video.removeEventListener('canplay', onCanPlay)
    }
  }, [isScanning, cameraStream, addReading])

  // Handle scan phases and completion
  useEffect(() => {
    if (isScanning) {
      if (scanDuration >= SCAN_DURATION_SECONDS) {
        const sid = sessionIdRef.current
        if (sid && frameIntervalRef.current) {
          clearInterval(frameIntervalRef.current)
          frameIntervalRef.current = null
          biometricsApi
            .stop(sid)
            .then((summary) => {
              setLastServerSummary(summary)
              sessionIdRef.current = null
            })
            .catch((e) => console.warn('Biometrics stop error:', e))
        }
        stopScan()
        setScanPhase('complete')
      } else if (scanDuration >= SCAN_DURATION_SECONDS * 0.75) {
        setScanPhase('completing')
      } else if (scanDuration >= SCAN_DURATION_SECONDS * 0.5) {
        setScanPhase('midway')
      } else if (scanDuration > 2) {
        setScanPhase('scanning')
      }
    }
  }, [isScanning, scanDuration, stopScan, setScanPhase])

  const handleStartScanning = useCallback(async () => {
    const sessionId = crypto.randomUUID()
    sessionIdRef.current = sessionId
    setLastServerSummary(null)
    try {
      await biometricsApi.start(sessionId)
      startScan()
      setScanPhase('scanning')
    } catch (e) {
      console.error('Failed to start biometric session:', e)
      sessionIdRef.current = null
      alert('Could not start vitals scan. Please try again.')
    }
  }, [startScan, setScanPhase])

  // Quick test bypass - skip scanning and use sample data
  const handleQuickTest = useCallback(async () => {
    setProcessingDiagnosis(true)
    setScanPhase('analyzing')

    const sampleBiometrics = {
      averageBpm: 72,
      bpmRange: { min: 68, max: 78 },
      averageHrv: 45,
      hrvRange: { min: 38, max: 52 },
      averageConfidence: 0.85,
      readingCount: 30,
      durationSeconds: 30,
    }

    try {
      console.log('Quick test - sending sample data to Gemini')
      const response = await fetch('/api/diagnosis/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intake: { lifeStage, selectedBodyParts, symptoms },
          biometrics: sampleBiometrics,
        }),
      })

      const result = await response.json()
      console.log('API result:', result)

      if (result && result.urgencyLevel) {
        setDiagnosisResult(result)
        navigate('/report')
      } else {
        throw new Error('Invalid response')
      }
    } catch (err) {
      console.error('Quick test error:', err)
      alert(`Error: ${err instanceof Error ? err.message : 'Failed'}`)
      setProcessingDiagnosis(false)
    }
  }, [lifeStage, selectedBodyParts, symptoms, setDiagnosisResult, setProcessingDiagnosis, setScanPhase, navigate])

  const handleAnalyze = useCallback(async () => {
    setProcessingDiagnosis(true)
    setScanPhase('analyzing')

    const biometricSummary = lastServerSummary ?? getSummary()

    try {
      console.log('Sending to Gemini:', {
        intake: { lifeStage, selectedBodyParts, symptoms },
        biometrics: biometricSummary,
      })

      const response = await fetch('/api/diagnosis/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intake: {
            lifeStage,
            selectedBodyParts,
            symptoms,
          },
          biometrics: biometricSummary,
        }),
      })

      console.log('Response status:', response.status)

      const result = await response.json()
      console.log('API result:', result)

      // Even if status is 500, we might have a fallback result we can use
      if (result && result.urgencyLevel) {
        console.log('Using result (fallback or success)')
      } else if (!response.ok) {
        throw new Error(`Failed to analyze: ${response.status}`)
      }

      setDiagnosisResult(result)
      navigate('/report')
    } catch (err) {
      console.error('Diagnosis error:', err)
      alert(`Error: ${err instanceof Error ? err.message : 'Failed to analyze'}. Check console for details.`)
      setProcessingDiagnosis(false)
    }
  }, [
    lastServerSummary,
    getSummary,
    lifeStage,
    selectedBodyParts,
    symptoms,
    setDiagnosisResult,
    setProcessingDiagnosis,
    setScanPhase,
    navigate,
  ])

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-white">Initializing camera...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="card max-w-md text-center">
          <h2 className="text-lg font-medium text-red-600 mb-2">Camera Error</h2>
          <p className="text-neutral-600 mb-4">{error}</p>
          <Button variant="secondary" onClick={() => navigate('/')}>
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-900 relative">
      {/* Hidden video/canvas for Presage-style frame capture (BPM/HRV via server) */}
      {isScanning && (
        <>
          <video
            ref={captureVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute w-0 h-0 opacity-0 pointer-events-none overflow-hidden"
          />
          <canvas ref={captureCanvasRef} className="absolute w-0 h-0 opacity-0 pointer-events-none" />
        </>
      )}

      {/* Camera View */}
      <CameraView />

      {/* Biometric Overlay */}
      <BiometricOverlay />

      {/* Voice Player */}
      <VoicePlayer />

      {/* Scan Progress */}
      {isScanning && (
        <ScanProgress
          duration={SCAN_DURATION_SECONDS}
          elapsed={scanDuration}
        />
      )}

      {/* Control Panel */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="max-w-md mx-auto">
          {scanPhase === 'welcome' && (
            <div className="text-center">
              <p className="text-white mb-4">
                Position your face in the center of the screen and remain still
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="primary" size="lg" onClick={handleStartScanning}>
                  Begin Scan
                </Button>
                <Button variant="secondary" size="lg" onClick={handleQuickTest}>
                  Quick Test (Skip Scan)
                </Button>
              </div>
            </div>
          )}

          {scanPhase === 'complete' && !processingDiagnosis && (
            <div className="text-center">
              <p className="text-healing-400 mb-4">
                Scan complete! Ready to analyze your results.
              </p>
              <Button variant="primary" size="lg" onClick={handleAnalyze}>
                Analyze Results
              </Button>
            </div>
          )}

          {processingDiagnosis && (
            <div className="text-center">
              <LoadingSpinner />
              <p className="text-white mt-4">Analyzing your health data...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
