import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import type { LifeStage, BodyPart, Symptom, DiagnosisResult, Clinic } from '../types'

interface AppState {
  lifeStage: LifeStage | null
  selectedBodyParts: BodyPart[]
  symptoms: Symptom[]
  additionalNotes: string
  diagnosisResult: DiagnosisResult | null
  clinics: Clinic[]
  userLocation: { lat: number; lng: number } | null
}

interface AppContextValue extends AppState {
  setLifeStage: (stage: LifeStage | null) => void
  toggleBodyPart: (part: BodyPart) => void
  addSymptom: (symptom: Omit<Symptom, 'id'>) => void
  removeSymptom: (id: string) => void
  updateSymptom: (id: string, updates: Partial<Symptom>) => void
  setAdditionalNotes: (notes: string) => void
  setDiagnosisResult: (result: DiagnosisResult | null) => void
  setClinics: (clinics: Clinic[]) => void
  setUserLocation: (location: { lat: number; lng: number } | null) => void
  resetSession: () => void
  canProceedToScan: boolean
}

const initialState: AppState = {
  lifeStage: null,
  selectedBodyParts: [],
  symptoms: [],
  additionalNotes: '',
  diagnosisResult: null,
  clinics: [],
  userLocation: null,
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState)

  const setLifeStage = useCallback((stage: LifeStage | null) => {
    setState(prev => ({ ...prev, lifeStage: stage }))
  }, [])

  const toggleBodyPart = useCallback((part: BodyPart) => {
    setState(prev => ({
      ...prev,
      selectedBodyParts: prev.selectedBodyParts.includes(part)
        ? prev.selectedBodyParts.filter(p => p !== part)
        : [...prev.selectedBodyParts, part]
    }))
  }, [])

  const addSymptom = useCallback((symptom: Omit<Symptom, 'id'>) => {
    const id = crypto.randomUUID()
    setState(prev => ({
      ...prev,
      symptoms: [...prev.symptoms, { ...symptom, id }]
    }))
  }, [])

  const removeSymptom = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      symptoms: prev.symptoms.filter(s => s.id !== id)
    }))
  }, [])

  const updateSymptom = useCallback((id: string, updates: Partial<Symptom>) => {
    setState(prev => ({
      ...prev,
      symptoms: prev.symptoms.map(s => s.id === id ? { ...s, ...updates } : s)
    }))
  }, [])

  const setAdditionalNotes = useCallback((notes: string) => {
    setState(prev => ({ ...prev, additionalNotes: notes }))
  }, [])

  const setDiagnosisResult = useCallback((result: DiagnosisResult | null) => {
    setState(prev => ({ ...prev, diagnosisResult: result }))
  }, [])

  const setClinics = useCallback((clinics: Clinic[]) => {
    setState(prev => ({ ...prev, clinics }))
  }, [])

  const setUserLocation = useCallback((location: { lat: number; lng: number } | null) => {
    setState(prev => ({ ...prev, userLocation: location }))
  }, [])

  const resetSession = useCallback(() => {
    setState(initialState)
  }, [])

  const canProceedToScan = state.lifeStage !== null && state.selectedBodyParts.length > 0

  return (
    <AppContext.Provider
      value={{
        ...state,
        setLifeStage,
        toggleBodyPart,
        addSymptom,
        removeSymptom,
        updateSymptom,
        setAdditionalNotes,
        setDiagnosisResult,
        setClinics,
        setUserLocation,
        resetSession,
        canProceedToScan,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
