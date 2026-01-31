import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import type { BodyPart } from '../../types'
import Button from '../common/Button'

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
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Sharp pain when breathing, dull ache..."
            className="input min-h-[80px]"
          />
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
        <textarea
          value={additionalNotes}
          onChange={(e) => setAdditionalNotes(e.target.value)}
          placeholder="Any other information you'd like to share..."
          className="input min-h-[60px]"
        />
      </div>
    </div>
  )
}
