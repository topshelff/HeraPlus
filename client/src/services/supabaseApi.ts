import { supabase } from '../lib/supabase'
import type { Symptom, BiometricSummary, DiagnosisResult } from '../types'

// Session API
export const sessionsApi = {
  create: async (data: {
    lifeStage: string
    selectedBodyParts: string[]
    additionalNotes?: string
  }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: session, error } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        life_stage: data.lifeStage,
        selected_body_parts: data.selectedBodyParts,
        additional_notes: data.additionalNotes || null,
      })
      .select()
      .single()

    if (error) throw error
    return session
  },

  getAll: async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        symptoms (*),
        biometric_summaries (*),
        diagnosis_results (*)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        symptoms (*),
        biometric_summaries (*),
        diagnosis_results (*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },
}

// Symptoms API
export const symptomsApi = {
  createBatch: async (sessionId: string, symptoms: Symptom[]) => {
    if (symptoms.length === 0) return

    const { error } = await supabase
      .from('symptoms')
      .insert(
        symptoms.map((s) => ({
          session_id: sessionId,
          body_part: s.bodyPart,
          description: s.description,
          severity: s.severity,
          duration: s.duration || null,
        }))
      )

    if (error) throw error
  },
}

// Biometrics API
export const biometricsApi = {
  saveSummary: async (sessionId: string, summary: BiometricSummary) => {
    const { error } = await supabase
      .from('biometric_summaries')
      .insert({
        session_id: sessionId,
        avg_bpm: summary.avgBpm,
        avg_hrv: summary.avgHrv,
        min_bpm: summary.minBpm,
        max_bpm: summary.maxBpm,
        scan_duration: summary.scanDuration,
      })

    if (error) throw error
  },
}

// Diagnosis API
export const diagnosisApi = {
  save: async (sessionId: string, result: DiagnosisResult) => {
    const { error } = await supabase
      .from('diagnosis_results')
      .insert({
        session_id: sessionId,
        urgency_level: result.urgencyLevel,
        urgency_reason: result.urgencyReason,
        primary_assessment: result.primaryAssessment,
        recommendations: result.recommendations,
      })

    if (error) throw error
  },
}

// Analytics API for charts
export const analyticsApi = {
  getBiometricTrends: async (limit = 10) => {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        id,
        created_at,
        biometric_summaries (avg_bpm, avg_hrv)
      `)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) throw error
    return data
  },

  getUrgencyDistribution: async () => {
    const { data, error } = await supabase
      .from('diagnosis_results')
      .select('urgency_level')

    if (error) throw error
    return data
  },
}
