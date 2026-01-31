import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import LifeStageSelector from '../components/intake/LifeStageSelector'
import BodyMap from '../components/intake/BodyMap'
import SymptomPanel from '../components/intake/SymptomPanel'
import Button from '../components/common/Button'

export default function IntakePage() {
  const navigate = useNavigate()
  const { canProceedToScan, lifeStage, selectedBodyParts } = useApp()

  const handleStartScan = () => {
    if (canProceedToScan) {
      navigate('/diagnostic')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-clinical-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-semibold text-clinical-800">HeraDX</h1>
          <p className="text-sm text-neutral-500">Women's Health Triage Assessment</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Body Map */}
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-lg font-medium text-neutral-800 mb-4">
                Select Affected Areas
              </h2>
              <p className="text-sm text-neutral-500 mb-6">
                Click on the body regions where you are experiencing symptoms
              </p>
              <BodyMap />
            </div>
          </div>

          {/* Right Column - Life Stage & Symptoms */}
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-lg font-medium text-neutral-800 mb-4">
                Life Stage
              </h2>
              <p className="text-sm text-neutral-500 mb-4">
                Select your current life stage for more accurate assessment
              </p>
              <LifeStageSelector />
            </div>

            <div className="card">
              <h2 className="text-lg font-medium text-neutral-800 mb-4">
                Symptom Details
              </h2>
              <SymptomPanel />
            </div>

            {/* Proceed Button */}
            <Button
              onClick={handleStartScan}
              disabled={!canProceedToScan}
              variant="primary"
              size="lg"
              className="w-full"
            >
              {canProceedToScan
                ? 'Start Biometric Scan'
                : `Select ${!lifeStage ? 'life stage' : ''}${!lifeStage && selectedBodyParts.length === 0 ? ' and ' : ''}${selectedBodyParts.length === 0 ? 'body areas' : ''}`}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
