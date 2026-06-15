#!/bin/bash
# ============================================================================
# Izy Global Partners LLP — Library
# Double-click this file to start the Library and open it in your browser.
#
# It runs one local server that serves both the application and its data on
# http://localhost:4000. Keep the Terminal window that opens — closing it
# stops the Library. To stop, close that window or press Ctrl-C in it.
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

# 3. Build the application if it has not been built yet.
if [ ! -d dist ]; then
  echo "Preparing the application…"
  npm run build || { echo "Build failed."; read -r -p "Press Return to close." _; exit 1; }
fi

# 4. Start the server (serves the app + data on port 4000).
export IGP_API_PORT=4000
node server/index.js &
SERVER_PID=$!

# 5. Wait until it is ready, then open the browser.
echo "Waiting for the Library to be ready…"
for _ in $(seq 1 60); do
  if curl -s "http://localhost:4000/" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
open "http://localhost:4000"

echo
echo "The Library is running at http://localhost:4000"
echo "Leave this window open while you use it. Close it to stop the Library."
echo

# Keep the server in the foreground so the window stays open.
wait "$SERVER_PID"
