#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
# Homebrew installs Go outside PATH on the macOS machine this helper targets.
GO=/opt/homebrew/bin/go

echo "Building NEO Tracker backend..."
cd "$ROOT/backend"
$GO build -o neo-tracker-server .
./neo-tracker-server &
BACKEND_PID=$!
echo "  Backend started on :7777 (PID $BACKEND_PID)"

echo "Starting frontend dev server..."
cd "$ROOT/frontend"
npm run dev -- --port 5174 &
FRONTEND_PID=$!
echo "  Frontend starting on :5174 (PID $FRONTEND_PID)"

echo ""
echo "  Open: http://localhost:5174"
echo ""
echo "Press Ctrl+C to stop."

# Forward termination to both child processes so neither dev server is orphaned.
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
