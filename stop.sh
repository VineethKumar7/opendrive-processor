#!/bin/bash
# Stop OpenDRIVE Road Network Processor

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "🛑 Stopping OpenDRIVE Road Network Processor..."

# Stop backend
if [ -f ".pids/api.pid" ]; then
    PID=$(cat .pids/api.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo "✓ Backend stopped (PID: $PID)"
    fi
    rm -f .pids/api.pid
fi

# Stop frontend
if [ -f ".pids/frontend.pid" ]; then
    PID=$(cat .pids/frontend.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo "✓ Frontend stopped (PID: $PID)"
    fi
    rm -f .pids/frontend.pid
fi

echo "✅ All services stopped"
