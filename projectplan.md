# HeraDX Implementation Plan

## Overview
A minimal, clean medical web app for Women's Health AI-driven triage. Validates symptoms using biometric data to prevent medical dismissal and provides documentation for doctor visits.

---

## Tech Stack
- **Frontend**: React + Vite, Tailwind CSS (clinical UI)
- **Backend**: Node.js (Express)
- **AI**: Gemini API (diagnostic logic with female-specific prompts)
- **Voice**: ElevenLabs (calming therapeutic voice)
- **Biometrics**: Presage C++ SDK (via Node.js bridge) for BPM/HRV
- **Maps**: OpenStreetMap + Leaflet.js (free, no API key)
- **State**: React Context (no database for MVP)

---

## Project Structure

```
HeraDX/
├── client/                          # React + Vite Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/              # Button, Card, Modal, Spinner
│   │   │   ├── intake/              # BodyMap, LifeStageSelector
│   │   │   ├── diagnostic/          # CameraView, BiometricOverlay, VoicePlayer
│   │   │   └── report/              # BiometricProof, TriageExplanation, ClinicMap
│   │   ├── pages/
│   │   │   ├── IntakePage.tsx
│   │   │   ├── DiagnosticSessionPage.tsx
│   │   │   └── ValidationReportPage.tsx
│   │   ├── context/                 # AppContext, BiometricContext, SessionContext
│   │   ├── hooks/                   # useCamera, useBiometrics, useVoice
│   │   └── services/                # API client
│   └── package.json
│
├── server/                          # Node.js Express Backend
│   ├── src/
│   │   ├── routes/                  # biometrics, diagnosis, voice, clinics
│   │   ├── services/                # Presage, Gemini, ElevenLabs, OpenStreetMap
│   │   └── prompts/                 # Female health triage system prompts
│   └── package.json
│
└── package.json                     # Root workspace config
```

---

## App Flow (3 Pages)

### Page 1: Intake Page
- Female anatomical SVG body map with clickable regions
- Life stage selector: Menstruating, Pregnant, Postpartum, Perimenopause, Menopause, Postmenopause
- Body regions: Head, Thyroid, Chest, Breast, Abdomen, Pelvic, Back, Extremities
- Symptom details with severity (1-10)
- "Start Scan" button to proceed

### Page 2: Diagnostic Session Page
- Camera access via MediaDevices API with face guide overlay
- Presage scan runs for 30-60 seconds
- Real-time BPM/HRV display overlay
- ElevenLabs voice-over phases: welcome → positioning → scanning → midway → completing → complete
- Sends to Gemini: body parts + life stage + biometric summary

### Page 3: Validation Report Page
- Biometric proof card (avg BPM, HRV range, scan confidence)
- AI triage explanation with urgency level (Emergency/Urgent/Moderate/Low)
- Recommendations and potential conditions
- Leaflet.js map with nearby Women's Health Clinics
- Download/print report option

---

## Backend API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/biometrics/start` | Initialize scan session |
| POST | `/api/biometrics/frame` | Process video frame → return BPM/HRV |
| POST | `/api/biometrics/stop` | End scan, get summary |
| POST | `/api/diagnosis/analyze` | Send intake + biometrics to Gemini |
| POST | `/api/voice/stream` | Get ElevenLabs audio for phase |
| GET | `/api/clinics/nearby` | Find clinics via OpenStreetMap Overpass API |

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and add your API keys:
```
GEMINI_API_KEY=your_key
ELEVENLABS_API_KEY=your_key
PRESAGE_API_KEY=your_key
```

### 3. Run Development Servers
```bash
npm run dev
```

This starts:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

---

## Environment Variables Required

```
# Server
GEMINI_API_KEY=AIzaSyASblGWug29YmwapfSVHzVKAxV7HlxCrHQ
ELEVENLABS_API_KEY=sk_bb694e0a45159511a58bcfda67dd75818ba690f188ca25d7
PRESAGE_API_KEY=soccnkJ9DJ71jJa3OMME10jUQLn7FOr71cb8QsUd

# Client (VITE_ prefix)
VITE_API_BASE_URL=http://localhost:3001
```

**Note**: OpenStreetMap/Leaflet.js require NO API keys - completely free to use.

---

## Presage Vitals Integration

The website sends camera frames to the server; the server uses either **simulated** vitals or **real Presage** via an external bridge.

### Client → Server flow
- On "Begin Scan": `POST /api/biometrics/start` (session ID).
- For each frame (~5 FPS): `POST /api/biometrics/frame` with base64 JPEG; server returns `{ bpm, hrv, confidence }`.
- After 30s: `POST /api/biometrics/stop`; server returns biometric summary for diagnosis.

### Server modes

| Mode | When | Behaviour |
|------|------|------------|
| **Simulated** | `PRESAGE_API_KEY` or `PRESAGE_BRIDGE_PATH` not set | In-process fake BPM/HRV (no bridge). |
| **Real (bridge)** | Both `PRESAGE_API_KEY` and `PRESAGE_BRIDGE_PATH` set | Spawns bridge process; sends frames on stdin, reads BPM/HRV from stdout. |

### Bridge contract (stdin/stdout)

The server spawns one bridge process per scan session.

- **Stdin** (JSON lines, one per frame):  
  `{"frame":"<base64 JPEG>","timestamp":<ms>}`  
  Session end: `{"end":true}` then stdin is closed.

- **Stdout** (JSON lines, one per frame):  
  `{"bpm":<number>,"hrv":<number>,"confidence":<0-1>}`  
  One line per frame sent; server blocks until it gets a line.

- **Environment**: Bridge receives `PRESAGE_API_KEY` and `SMARTSPECTRA_API_KEY` (same value).

### 1. Test with mock bridge (no C++ SDK)

To test the pipeline without the Presage C++ SDK:

```bash
# From repo root (HeraDX)
export PRESAGE_API_KEY=your_key_from_physiology.presagetech.com
export PRESAGE_BRIDGE_PATH="server/scripts/presage-mock-bridge.js"
npm run dev
```

The mock bridge (`server/scripts/presage-mock-bridge.js`) reads frames from stdin and outputs simulated BPM/HRV so you can verify start → frame → stop flow.

### 2. Real Presage (C++ SDK bridge)

Presage does not expose a public REST API for “upload image, get BPM” from a server. Vitals are computed by the **SmartSpectra C++ SDK** (or Android/iOS SDKs), which talks to Presage’s Physiology API internally.

To use **real** Presage vitals:

1. **Get an API key** at [physiology.presagetech.com](https://physiology.presagetech.com).
2. **Install the C++ SDK** (e.g. Ubuntu 22.04): see [Presage C++ docs](https://docs.physiology.presagetech.com/cpp/index.html).
3. **Build a small bridge binary** that:
   - Reads JSON lines from stdin: `{"frame":"<base64>","timestamp":<ms>}`.
   - Decodes base64 to image, feeds frames into the SmartSpectra SDK (e.g. spot or continuous mode).
   - For each frame (or when SDK returns metrics), writes one JSON line to stdout: `{"bpm":<n>,"hrv":<n>,"confidence":<0-1>}`.
   - On `{"end":true}` exits.
4. **Point the server at the bridge**:
   ```bash
   export PRESAGE_API_KEY=your_key
   export PRESAGE_BRIDGE_PATH=/path/to/your/presage-bridge
   ```

The server will spawn this binary per session, pass `PRESAGE_API_KEY`/`SMARTSPECTRA_API_KEY` in the environment, and use its stdout as the source of BPM/HRV. No changes are needed on the website or REST API.

- Presage C++ SDK: [docs.physiology.presagetech.com/cpp](https://docs.physiology.presagetech.com/cpp/index.html)  
- Samples: [SmartSpectra cpp/samples](https://github.com/Presage-Security/SmartSpectra/tree/main/cpp/samples) (e.g. `minimal_rest_spot_example`).
