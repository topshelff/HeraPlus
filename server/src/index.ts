import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { biometricsRouter } from './routes/biometrics.js'
import { diagnosisRouter } from './routes/diagnosis.js'
import { voiceRouter } from './routes/voice.js'
import { clinicsRouter } from './routes/clinics.js'

// Load .env from project root
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

console.log('Environment check:')
console.log('- GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'SET (' + process.env.GEMINI_API_KEY.slice(0,8) + '...)' : 'NOT SET')
console.log('- ELEVENLABS_API_KEY:', process.env.ELEVENLABS_API_KEY ? 'SET' : 'NOT SET')
console.log('- PRESAGE_API_KEY:', process.env.PRESAGE_API_KEY ? 'SET' : 'NOT SET')

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Routes
app.use('/api/biometrics', biometricsRouter)
app.use('/api/diagnosis', diagnosisRouter)
app.use('/api/voice', voiceRouter)
app.use('/api/clinics', clinicsRouter)

// Health check
app.get('/api/health', (_, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'
  })
})

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`HeraDX server running on http://localhost:${PORT}`)
})
