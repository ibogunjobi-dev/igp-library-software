#!/bin/bash
# ============================================================================
# Izy Global Partners LLP — Library
# Double-click this file to start the Library and open it in your browser.
#
# This runs exactly the same as "npm run dev": the API server plus the Vite
# dev server, with the app served on http://localhost:5173. Keep the Terminal
# window that opens — closing it stops the Library (or press Ctrl-C in it).
# ============================================================================

cd "$(dirname "$0")" || exit 1

clear
echo "Izy Global Partners LLP — Legal & Knowledge Resources Centre"
echo "Starting the Library…"
echo

# 1. Node.js must be installed.
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Please install it from https://nodejs.org and try again."
  echo
  read -r -p "Press Return to close." _
  exit 1
fi

# 2. Install dependencies on first run.
if [ ! -d node_modules ]; then
  echo "First-time setup: installing components (this can take a few minutes)…"
  npm install || { echo "Setup failed."; read -r -p "Press Return to close." _; exit 1; }
fi

echo "The Library will open automatically at http://localhost:5173"
echo "Leave this window open while you use it. Close it to stop the Library."
echo

# 3. Run exactly the same processes as "npm run dev" (API + Vite). Vite opens
#    the browser at http://localhost:5173 itself (server.open is enabled).
npm run dev
