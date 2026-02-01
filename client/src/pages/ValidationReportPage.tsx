import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useBiometrics } from '../context/BiometricContext'
import BiometricProof from '../components/report/BiometricProof'
import TriageExplanation from '../components/report/TriageExplanation'
import ClinicMap from '../components/report/ClinicMap'
import Button from '../components/common/Button'

export default function ValidationReportPage() {
  const navigate = useNavigate()
  const {
    diagnosisResult,
    lifeStage,
    selectedBodyParts,
    symptoms,
    clinics,
    setClinics,
    userLocation,
    setUserLocation,
    resetSession,
  } = useApp()
  const { getSummary, resetBiometrics } = useBiometrics()

  const biometricSummary = getSummary()

  // Fetch user location and nearby clinics
  useEffect(() => {
    const fetchLocation = async () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords
            setUserLocation({ lat: latitude, lng: longitude })

            // Fetch nearby clinics
            try {
              const response = await fetch(
                `/api/clinics/nearby?lat=${latitude}&lng=${longitude}`
              )
              if (response.ok) {
                const data = await response.json()
                setClinics(data.clinics || [])
              }
            } catch (err) {
              console.error('Failed to fetch clinics:', err)
            }
          },
          (err) => {
            console.error('Geolocation error:', err)
          }
        )
      }
    }

    fetchLocation()
  }, [setClinics, setUserLocation])

  const handleStartNew = () => {
    resetSession()
    resetBiometrics()
    navigate('/')
  }

  const handlePrint = () => {
    window.print()
  }

  if (!diagnosisResult) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="card text-center">
          <h2 className="text-lg font-medium text-neutral-800 mb-2">
            No Report Available
          </h2>
          <p className="text-neutral-500 mb-4">
            Please complete the assessment first.
          </p>
          <Button variant="primary" onClick={() => navigate('/')}>
            Start Assessment
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 print:bg-white">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-6 py-4 print:border-b-2 print:border-black">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-clinical-800">HeraDX</h1>
            <p className="text-sm text-neutral-500">Health Assessment Report</p>
          </div>
          <div className="print:hidden flex gap-2">
            <Button variant="secondary" onClick={handlePrint}>
              Print Report
            </Button>
            <Button variant="primary" onClick={handleStartNew}>
              New Assessment
            </Button>
          </div>
        </div>
      </header>

      {/* Report Content */}
      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Patient Info Summary */}
        <div className="card">
          <h2 className="text-lg font-medium text-neutral-800 mb-4">
            Assessment Summary
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-neutral-500">Life Stage:</span>
              <span className="ml-2 font-medium capitalize">{lifeStage?.replace('-', ' ')}</span>
            </div>
            <div>
              <span className="text-neutral-500">Areas of Concern:</span>
              <span className="ml-2 font-medium capitalize">
                {(selectedBodyParts ?? []).join(', ')}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">Date:</span>
              <span className="ml-2 font-medium">
                {new Date().toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-neutral-500">Symptoms Reported:</span>
              <span className="ml-2 font-medium">{(symptoms ?? []).length}</span>
            </div>
          </div>
        </div>

        {/* Biometric Proof */}
        {biometricSummary && <BiometricProof summary={biometricSummary} />}

        {/* Triage Explanation */}
        <TriageExplanation diagnosis={diagnosisResult} />

        {/* Nearby Clinics */}
        <div className="card print:break-before-page">
          <h2 className="text-lg font-medium text-neutral-800 mb-4">
            Nearby Women's Health Clinics
          </h2>
          <ClinicMap clinics={clinics} userLocation={userLocation} />
        </div>

        {/* Disclaimer */}
        <div className="bg-warmth-50 border border-warmth-200 rounded-lg p-4 text-sm text-warmth-800">
          <strong>Important:</strong> {diagnosisResult?.disclaimer ?? 'This is a preliminary triage assessment. Always consult a qualified healthcare provider.'}
        </div>
      </main>
    </div>
  )
}
