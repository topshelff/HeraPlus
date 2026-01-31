#!/usr/bin/env bash
# Install Presage SmartSpectra C++ SDK on Ubuntu 22.04 / Linux Mint 21 (amd64).
# Run from HeraDX project root: ./scripts/install-presage-sdk.sh

set -e

echo "Installing Presage SmartSpectra SDK..."

# Detect Linux
if [[ "$(uname)" != "Linux" ]]; then
  echo "This script is for Linux (Ubuntu 22.04 / Mint 21)."
  echo "On macOS/Windows, see docs/PRESAGE_SDK.md for alternatives."
  exit 1
fi

# Add Presage PPA
echo "Adding Presage PPA..."
curl -s "https://presage-security.github.io/PPA/KEY.gpg" | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/presage-technologies.gpg >/dev/null
sudo curl -s --compressed -o /etc/apt/sources.list.d/presage-technologies.list \
  "https://presage-security.github.io/PPA/presage-technologies.list"

# Install SDK and build deps
echo "Installing libsmartspectra-dev and build tools..."
sudo apt update
sudo apt install -y \
  libsmartspectra-dev \
  build-essential \
  cmake \
  libcurl4-openssl-dev \
  libssl-dev \
  pkg-config \
  libv4l-dev \
  libgles2-mesa-dev \
  libunwind-dev

echo "Done. SDK is installed on the system."
echo "Next: build a bridge binary that uses the SDK, then set PRESAGE_BRIDGE_PATH."
echo "See docs/PRESAGE_SDK.md for details."
