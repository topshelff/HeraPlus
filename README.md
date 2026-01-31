# HeraDX

Women's health AI triage with biometric vitals (Presage-style).

## Presage SDK (vitals)

Presage SmartSpectra is a **C++ SDK**, not an npm package. To use real Presage vitals:

- **Docker (any OS):** run the Presage Engine in Docker – see [docs/PRESAGE_DOCKER.md](docs/PRESAGE_DOCKER.md). Then set `PRESAGE_VIDEO_API_URL=http://localhost:8080/process-video` and install **ffmpeg** on the server machine.
- **Test without the SDK:** use the mock bridge – see [docs/PRESAGE_SDK.md](docs/PRESAGE_SDK.md).
- **Install the C++ SDK (Linux):** run `./scripts/install-presage-sdk.sh` from the project root, or follow [docs/PRESAGE_CPP_BRIDGE_STEPS.md](docs/PRESAGE_CPP_BRIDGE_STEPS.md).