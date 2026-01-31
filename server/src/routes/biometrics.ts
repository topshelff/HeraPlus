import { Router, Request, Response } from 'express'
import { getPresageService } from '../services/presageService.js'

export const biometricsRouter = Router()

// Start a new biometric scanning session
biometricsRouter.post('/start', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body

    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' })
      return
    }

    const service = getPresageService()
    const result = await service.startSession(sessionId)

    res.json(result)
  } catch (error) {
    console.error('Biometrics start error:', error)
    res.status(500).json({ error: 'Failed to start biometric session' })
  }
})

// Process a video frame
biometricsRouter.post('/frame', async (req: Request, res: Response) => {
  try {
    const { sessionId, frame, timestamp } = req.body

    if (!sessionId || !frame) {
      res.status(400).json({ error: 'sessionId and frame are required' })
      return
    }

    const service = getPresageService()
    const reading = await service.processFrame(
      sessionId,
      frame,
      timestamp || Date.now()
    )

    res.json(reading)
  } catch (error) {
    console.error('Biometrics frame error:', error)
    res.status(500).json({ error: 'Failed to process frame' })
  }
})

// Stop session and get summary
biometricsRouter.post('/stop', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body

    if (!sessionId) {
      res.status(400).json({ error: 'sessionId is required' })
      return
    }

    const service = getPresageService()
    const summary = await service.stopSession(sessionId)

    res.json(summary)
  } catch (error) {
    console.error('Biometrics stop error:', error)
    res.status(500).json({ error: 'Failed to stop biometric session' })
  }
})
