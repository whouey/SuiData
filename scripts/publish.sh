#!/usr/bin/env bash
# Publish the OtterProof Move package to the active Sui network.
#
# Prereqs:
#   - `sui` CLI installed and `sui client` configured with a funded address
#     (testnet: `sui client faucet`).
#
# Usage:
#   ./scripts/publish.sh
#
# After publishing, copy the package id into:
#   - CLAUDE.md  (PACKAGE_ID)
#   - frontend/.env  as VITE_PACKAGE_ID=0x...
set -euo pipefail

cd "$(dirname "$0")/../move"

echo "Building + publishing otterproof package..."
sui client publish --gas-budget 200000000

# TODO: parse the resulting packageId out of the JSON output and write it to
# frontend/.env automatically.
