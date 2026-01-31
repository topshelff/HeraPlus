import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useBiometrics } from '../context/BiometricContext'
import { useAuth } from '../context/AuthContext'
import BiometricProof from '../components/report/BiometricProof'
import TriageExplanation from '../components/report/TriageExplanation'
import ClinicMap from '../components/report/ClinicMap'
import Button from '../components/common/Button'

// Logo component matching the H+ design
function Logo() {
  return (
    <div className="w-12 h-12 bg-healing-800 rounded-xl flex items-center justify-center shadow-md">
      <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
        <path
          d="M8 8V24M8 16H16M16 8V24"
          stroke="#9cb99c"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M24 12V20M20 16H28"
          stroke="#9cb99c"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

// Navigation component
function Navigation({
  activeTab,
  onTabChange,
  onLogout
}: {
  activeTab: string
  onTabChange: (tab: string) => void
  onLogout: () => void
}) {
  const tabs = [
    { id: 'analyze', label: 'Analyze Report' },
    { id: 'new', label: 'New Scan' },
    { id: 'history', label: 'View Past Scans' },
  ]

  return (
    <nav className="flex items-center justify-between px-6 py-4 print:hidden">
      <div className="flex items-center gap-8">
        <Logo />
        <div className="flex items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                px-4 py-2 rounded-full font-medium text-sm transition-all duration-300
                ${activeTab === tab.id
                  ? 'bg-healing-800 text-white shadow-lg shadow-healing-800/25 scale-105'
                  : 'text-healing-800 hover:bg-healing-100'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={onLogout}
        className="flex items-center gap-2 px-4 py-2 bg-healing-800 text-white rounded-lg font-medium text-sm hover:bg-healing-900 transition-all duration-300 hover:shadow-lg hover:shadow-healing-800/25"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Logout
      </button>
    </nav>
  )
}

export default function ValidationReportPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
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

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  const handleTabChange = (tab: string) => {
    if (tab === 'new') {
      handleStartNew()
    } else if (tab === 'history') {
      navigate('/history')
    }
  }

  if (!diagnosisResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-healing-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 bg-healing-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-healing-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-neutral-800 mb-2">
            No Report Available
          </h2>
          <p className="text-neutral-500 mb-6">
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
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-healing-50 print:bg-white">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden animate-fade-in print:shadow-none print:rounded-none">
          {/* Navigation */}
          <Navigation
            activeTab="analyze"
            onTabChange={handleTabChange}
            onLogout={handleSignOut}
          />

          {/* Print Header (only visible when printing) */}
          <div className="hidden print:block px-6 py-4 border-b-2 border-black">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-neutral-800 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">H+</span>
                </div>
                <h1 className="text-2xl font-bold">HeraDX Report</h1>
              </div>
              <p className="text-sm text-neutral-500">
                Generated: {new Date().toLocaleString()}
              </p>
            </div>
          </div>

          {/* Report Actions (print button) */}
          <div className="px-6 py-4 border-b border-neutral-100 print:hidden">
            <div className="flex justify-end">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 text-healing-700 hover:bg-healing-50 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Report
              </button>
            </div>
          </div>

          {/* Report Content */}
          <main className="px-6 py-8 space-y-8">
            {/* Patient Info Summary */}
            <div className="bg-healing-50 rounded-2xl p-6 border border-healing-100">
              <h2 className="text-lg font-semibold text-healing-800 mb-4">
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
                    {selectedBodyParts.join(', ')}
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
                  <span className="ml-2 font-medium">{symptoms.length}</span>
                </div>
              </div>
            </div>

            {/* Biometric Proof */}
            {biometricSummary && <BiometricProof summary={biometricSummary} />}

            {/* Triage Explanation */}
            <TriageExplanation diagnosis={diagnosisResult} />

            {/* Nearby Clinics */}
            <div className="bg-white rounded-2xl shadow-md p-6 border border-neutral-100 print:break-before-page">
              <h2 className="text-lg font-semibold text-healing-800 mb-4">
                Nearby Women's Health Clinics
              </h2>
              <ClinicMap clinics={clinics} userLocation={userLocation} />
            </div>

            {/* Disclaimer */}
            <div className="bg-warmth-50 border border-warmth-200 rounded-xl p-4 text-sm text-warmth-800">
              <strong>Important:</strong> {diagnosisResult.disclaimer}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
