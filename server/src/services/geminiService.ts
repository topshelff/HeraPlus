import { GoogleGenerativeAI } from '@google/generative-ai'
import { FEMALE_HEALTH_TRIAGE_SYSTEM_PROMPT, buildDiagnosticPrompt } from '../prompts/femaleHealthTriage.js'
import type { IntakeData, BiometricSummary, DiagnosisResult } from '../types/index.js'

export class GeminiService {
  private client: GoogleGenerativeAI
  private modelId = 'gemini-2.5-flash-lite'

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey)
  }

  async analyzeDiagnosis(
    intake: IntakeData,
    biometrics: BiometricSummary | null
  ): Promise<DiagnosisResult> {
    console.log('Creating Gemini model...')
    const model = this.client.getGenerativeModel({
      model: this.modelId,
      systemInstruction: FEMALE_HEALTH_TRIAGE_SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    })

    const userPrompt = buildDiagnosticPrompt(intake, biometrics)
    console.log('Sending prompt to Gemini:', userPrompt.slice(0, 200) + '...')

    let result
    try {
      result = await model.generateContent(userPrompt)
    } catch (apiError) {
      console.error('Gemini API call failed:', apiError)
      throw apiError
    }

    const response = result.response
    let text = response.text()
    console.log('Gemini raw response:', text.slice(0, 500))

    // Extract JSON from markdown code blocks if present
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      text = jsonMatch[1].trim()
    }

    try {
      const parsed = JSON.parse(text) as DiagnosisResult

      // Ensure all required fields are present
      return {
        urgencyLevel: parsed.urgencyLevel || 'MODERATE',
        urgencyReason: parsed.urgencyReason || 'Unable to determine urgency',
        primaryAssessment: parsed.primaryAssessment || 'Assessment pending',
        differentialConsiderations: parsed.differentialConsiderations || [],
        redFlags: parsed.redFlags || [],
        recommendations: parsed.recommendations || ['Consult with a healthcare provider'],
        specialtyReferral: parsed.specialtyReferral,
        disclaimer: parsed.disclaimer || 'This is a preliminary triage assessment, not a medical diagnosis. Always consult with a qualified healthcare provider.',
      }
    } catch {
      console.error('Failed to parse Gemini response:', text)
      return {
        urgencyLevel: 'MODERATE',
        urgencyReason: 'Unable to complete full analysis',
        primaryAssessment: 'The AI was unable to provide a complete assessment. Please consult with a healthcare provider.',
        differentialConsiderations: [],
        redFlags: [],
        recommendations: ['Consult with a healthcare provider for proper evaluation'],
        disclaimer: 'This is a preliminary triage assessment, not a medical diagnosis. Always consult with a qualified healthcare provider.',
      }
    }
  }
}

let geminiService: GeminiService | null = null

export function getGeminiService(): GeminiService {
  if (!geminiService) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('GEMINI_API_KEY not configured! Please add your API key to .env file')
    }
    console.log('Initializing Gemini service with API key:', apiKey.slice(0, 8) + '...')
    geminiService = new GeminiService(apiKey)
  }
  return geminiService
}
