import { useState, useRef, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import type { BodyPart } from '../../types'
import Button from '../common/Button'
import { voiceApi } from '../../services/api'

const bodyPartLabels: Record<BodyPart, string> = {
  head: 'Head',
  thyroid: 'Thyroid/Neck',
  chest: 'Chest',
  breast: 'Breast',
  abdomen: 'Abdomen',
  pelvic: 'Pelvic',
  back: 'Back',
  extremities: 'Arms & Legs',
}

export default function SymptomPanel() {
  const { selectedBodyParts, symptoms, addSymptom, removeSymptom, additionalNotes, setAdditionalNotes } = useApp()
  const [currentPart, setCurrentPart] = useState<BodyPart | null>(null)
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState(5)
  const [isRecording, setIsRecording] = useState(false)
  const [isRecordingNotes, setIsRecordingNotes] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [recordError, setRecordError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingTargetRef = useRef<'symptom' | 'notes'>('symptom')

  const handleAddSymptom = () => {
    if (currentPart && description.trim()) {
      addSymptom({
        bodyPart: currentPart,
        description: description.trim(),
        severity,
      })
      setDescription('')
      setSeverity(5)
      setCurrentPart(null)
    }
  }

  const handleMicClick = useCallback(
    async (target: 'symptom' | 'notes') => {
      if (isTranscribing) return

      if (isRecording || isRecordingNotes) {
        const mr = mediaRecorderRef.current
        if (mr && mr.state !== 'inactive') {
          mr.stop()
          setIsRecording(false)
          setIsRecordingNotes(false)
          setIsTranscribing(true)
        }
        return
      }

      setRecordError(null)
      recordingTargetRef.current = target
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
        const recorder = new MediaRecorder(stream)
        chunksRef.current = []
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }
        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop())
          const blob = new Blob(chunksRef.current, { type: mimeType })
          const targetField = recordingTargetRef.current
          if (blob.size === 0) {
            setRecordError('No audio recorded')
            setIsRecording(false)
            setIsRecordingNotes(false)
            return
          }
          setIsTranscribing(true)
          try {
            const text = await voiceApi.transcribe(blob)
            if (targetField === 'symptom') {
              setDescription((prev) => (prev ? `${prev} ${text}` : text))
            } else {
              setAdditionalNotes((prev) => (prev ? `${prev} ${text}` : text))
            }
          } catch (err) {
            setRecordError(err instanceof Error ? err.message : 'Transcription failed')
          } finally {
            setIsTranscribing(false)
            setIsRecording(false)
            setIsRecordingNotes(false)
          }
        }
        recorder.start(200)
        mediaRecorderRef.current = recorder
        if (target === 'symptom') setIsRecording(true)
        else setIsRecordingNotes(true)
      } catch (err) {
        setRecordError(
          err instanceof Error ? err.message : 'Microphone access denied or not supported'
        )
      }
    },
    [isRecording, isRecordingNotes, isTranscribing, setAdditionalNotes]
  )

  if (selectedBodyParts.length === 0) {
    return (
      <p className="text-sm text-neutral-500 italic">
        Select body areas on the map to add symptoms
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Symptom form */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Body Area
          </label>
          <select
            value={currentPart || ''}
            onChange={(e) => setCurrentPart(e.target.value as BodyPart)}
            className="input"
          >
            <option value="">Select area...</option>
            {selectedBodyParts.map((part) => (
              <option key={part} value={part}>
                {bodyPartLabels[part]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Describe your symptom
          </label>
          <div className="flex gap-2">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Sharp pain when breathing, dull ache..."
              className="input min-h-[80px] flex-1"
            />
            <button
              type="button"
              onClick={() => handleMicClick('symptom')}
              disabled={isTranscribing}
              title={isRecording ? 'Stop recording' : 'Record with microphone'}
              className={`flex-shrink-0 self-start p-3 rounded-lg border transition-colors ${
                isRecording
                  ? 'bg-red-100 border-red-300 text-red-700 hover:bg-red-200'
                  : isTranscribing
                    ? 'bg-neutral-100 border-neutral-300 text-neutral-500 cursor-wait'
                    : 'bg-white border-neutral-300 text-clinical-600 hover:bg-clinical-50'
              }`}
            >
              {isRecording ? (
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                  </span>
                  <span className="text-xs font-medium">Stop</span>
                </span>
              ) : isTranscribing && recordingTargetRef.current === 'symptom' ? (
                <span className="text-xs font-medium">...</span>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              )}
            </button>
          </div>
          {recordError && (
            <p className="mt-1 text-sm text-red-600">{recordError}</p>
          )}
          {(isRecording || (isTranscribing && recordingTargetRef.current === 'symptom')) && (
            <p className="mt-1 text-xs text-neutral-500">
              {isRecording ? 'Recording... Click the mic again to stop and transcribe.' : 'Transcribing...'}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Severity (1-10): {severity}
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={severity}
            onChange={(e) => setSeverity(Number(e.target.value))}
            className="w-full accent-clinical-600"
          />
          <div className="flex justify-between text-xs text-neutral-400">
            <span>Mild</span>
            <span>Severe</span>
          </div>
        </div>

        <Button
          onClick={handleAddSymptom}
          disabled={!currentPart || !description.trim()}
          size="sm"
          className="w-full"
        >
          Add Symptom
        </Button>
      </div>

      {/* Symptom list */}
      {symptoms.length > 0 && (
        <div className="border-t border-neutral-200 pt-4">
          <h3 className="text-sm font-medium text-neutral-700 mb-2">
            Reported Symptoms
          </h3>
          <ul className="space-y-2">
            {symptoms.map((symptom) => (
              <li
                key={symptom.id}
                className="flex items-start justify-between bg-neutral-50 rounded-lg p-3"
              >
                <div>
                  <span className="text-xs font-medium text-clinical-600 uppercase">
                    {bodyPartLabels[symptom.bodyPart]}
                  </span>
                  <p className="text-sm text-neutral-800">{symptom.description}</p>
                  <span className="text-xs text-neutral-500">
                    Severity: {symptom.severity}/10
                  </span>
                </div>
                <button
                  onClick={() => removeSymptom(symptom.id)}
                  className="text-neutral-400 hover:text-red-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Additional notes */}
      <div className="border-t border-neutral-200 pt-4">
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          Additional Notes (optional)
        </label>
        <div className="flex gap-2">
          <textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Any other information you'd like to share..."
            className="input min-h-[60px] flex-1"
          />
          <button
            type="button"
            onClick={() => handleMicClick('notes')}
            disabled={isTranscribing}
            title={isRecordingNotes ? 'Stop recording' : 'Record with microphone'}
            className={`flex-shrink-0 self-start p-3 rounded-lg border transition-colors ${
              isRecordingNotes
                ? 'bg-red-100 border-red-300 text-red-700 hover:bg-red-200'
                : isTranscribing && recordingTargetRef.current === 'notes'
                  ? 'bg-neutral-100 border-neutral-300 text-neutral-500 cursor-wait'
                  : 'bg-white border-neutral-300 text-clinical-600 hover:bg-clinical-50'
            }`}
          >
            {isRecordingNotes ? (
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
                <span className="text-xs font-medium">Stop</span>
              </span>
            ) : isTranscribing && recordingTargetRef.current === 'notes' ? (
              <span className="text-xs font-medium">...</span>
            ) : (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
