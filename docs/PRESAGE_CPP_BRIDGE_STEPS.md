# Steps: Install Presage C++ SDK and Use It Via a Bridge

Follow these steps to use **real** Presage vitals in HeraDX via the C++ SDK and a bridge binary.

---

## Prerequisites

- **OS**: Ubuntu 22.04 or Linux Mint 21 (amd64). Other systems: see [Presage C++ docs](https://docs.physiology.presagetech.com/cpp/index.html).
- **API key**: You need a free key from [physiology.presagetech.com](https://physiology.presagetech.com) (register if needed).

---

## Step 1: Get your Presage API key

1. Go to [physiology.presagetech.com](https://physiology.presagetech.com).
2. Register or log in.
3. Create or copy an API key. You will use it as `PRESAGE_API_KEY` and the bridge will use it to talk to Presage’s backend.

---

## Step 2: Install the Presage C++ SDK

From the **HeraDX project root**:

```bash
./scripts/install-presage-sdk.sh
```

This adds the Presage PPA and installs:

- `libsmartspectra-dev` (Presage SmartSpectra C++ SDK)
- Build tools: `build-essential`, `cmake`, and dependencies

**If you prefer to install manually (Ubuntu 22.04 / Mint 21):**

```bash
# Add Presage PPA
curl -s "https://presage-security.github.io/PPA/KEY.gpg" | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/presage-technologies.gpg >/dev/null
sudo curl -s --compressed -o /etc/apt/sources.list.d/presage-technologies.list \
  "https://presage-security.github.io/PPA/presage-technologies.list"

# Install SDK and build tools
sudo apt update
sudo apt install -y libsmartspectra-dev build-essential cmake \
  libcurl4-openssl-dev libssl-dev pkg-config libv4l-dev libgles2-mesa-dev libunwind-dev
```

**Check:** `pkg-config --exists smartspectra` should succeed (no output).

---

## Step 3: Build a bridge binary

The HeraDX server spawns a **bridge** process per scan. It sends frames on **stdin** and reads BPM/HRV on **stdout**. The bridge must use the Presage C++ SDK to turn frames into vitals.

### Bridge contract (what the server expects)

- **Stdin** (one JSON line per frame):
  - `{"frame":"<base64 JPEG>","timestamp":<ms>}`
  - Session end: `{"end":true}` then stdin is closed.
- **Stdout** (one JSON line per frame):  
  `{"bpm":<number>,"hrv":<number>,"confidence":<0-1>}`  
  One line per frame received. The server blocks until it gets a line.

- **Environment:** The server passes `PRESAGE_API_KEY` and `SMARTSPECTRA_API_KEY` (same value) to the bridge process.

### How to implement the bridge

The SmartSpectra C++ SDK is built around **video input** (camera or file), not raw stdin frames. So the bridge has to:

1. Read JSON lines from stdin.
2. Decode the `frame` base64 to an image (e.g. with OpenCV or another library).
3. Feed frames into the SDK (e.g. by writing to a temporary video file and running the SDK on it, or by using any SDK API that accepts frame buffers).
4. For each frame (or when the SDK returns metrics), write one JSON line to stdout: `{"bpm":...,"hrv":...,"confidence":...}`.
5. On `{"end":true}`, exit.

**Starting point:** Use Presage’s C++ samples as reference:

- [SmartSpectra C++ samples](https://github.com/Presage-Security/SmartSpectra/tree/main/cpp/samples)
- [minimal_rest_spot_example](https://github.com/Presage-Security/SmartSpectra/tree/main/cpp/samples/minimal_rest_spot_example) – minimal Rest/spot usage
- [Rest continuous example](https://github.com/Presage-Security/SmartSpectra/tree/main/cpp/samples/rest_continuous_example) – continuous video and metrics

You will need to adapt one of these so that:

- Input comes from **stdin** (your JSON lines) instead of camera/file.
- Output goes to **stdout** (your JSON lines) instead of (or in addition to) their example output.

**Build:** Use CMake and link against SmartSpectra (see the samples’ `CMakeLists.txt`). After building, you get a single executable (e.g. `presage-bridge` or `heradx-presage-bridge`).

**Example layout (you can put the bridge outside HeraDX):**

```
your-presage-bridge/
  CMakeLists.txt   # find_package(SmartSpectra), add_executable, target_link_libraries
  main.cc          # stdin → decode frame → SDK → stdout
  build/
  presage-bridge   # built binary
```

There is no pre-written bridge in the HeraDX repo; you build one that follows the contract above and uses the SDK.

---

## Step 4: Point HeraDX at the bridge

1. Set the **absolute path** to your bridge binary and your API key. For example, if the binary is at `/home/you/presage-bridge/build/presage-bridge`:

   ```bash
   export PRESAGE_API_KEY=your_key_from_physiology.presagetech.com
   export PRESAGE_BRIDGE_PATH=/home/you/presage-bridge/build/presage-bridge
   ```

2. From the **HeraDX project root**, start the app:

   ```bash
   npm run dev
   ```

3. In the server log you should see something like:  
   `Presage vitals: bridge (real Presage)`  
   (and not “bridge (mock)”).

---

## Step 5: Verify in the UI

1. Open the app in the browser (e.g. http://localhost:5173).
2. Go through intake and start a **diagnostic session**.
3. Start a vitals scan (camera on).
4. On the diagnostic screen you should see **“Vitals: Presage”** (not “Vitals: Simulated”).  
   That indicates the server is using your bridge and thus the C++ SDK.

---

## Quick reference

| Step | Action |
|------|--------|
| 1 | Get API key from [physiology.presagetech.com](https://physiology.presagetech.com) |
| 2 | From HeraDX root: `./scripts/install-presage-sdk.sh` (or manual `apt` steps above) |
| 3 | Build a C++ bridge that reads stdin (JSON frames), uses SmartSpectra SDK, writes stdout (JSON bpm/hrv/confidence). Use [Presage C++ samples](https://github.com/Presage-Security/SmartSpectra/tree/main/cpp/samples) as reference. |
| 4 | `export PRESAGE_API_KEY=...` and `export PRESAGE_BRIDGE_PATH=/absolute/path/to/bridge` then `npm run dev` |
| 5 | Run a scan and confirm the UI shows **“Vitals: Presage”** |

- **API key:** [physiology.presagetech.com](https://physiology.presagetech.com)  
- **C++ SDK docs:** [docs.physiology.presagetech.com/cpp](https://docs.physiology.presagetech.com/cpp/index.html)  
- **C++ samples:** [SmartSpectra cpp/samples](https://github.com/Presage-Security/SmartSpectra/tree/main/cpp/samples)
