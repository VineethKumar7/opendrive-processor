#!/bin/bash
# Start OpenDRIVE Road Network Processor

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "🚀 Starting OpenDRIVE Road Network Processor..."

# Create data directory
mkdir -p data/maps

# Copy sample files if data/maps is empty
if [ -z "$(ls -A data/maps 2>/dev/null)" ]; then
    echo "📁 Copying sample maps..."
    cp samples/*.xodr data/maps/ 2>/dev/null || true
fi

# Start backend
echo "🔧 Starting API backend..."
cd backend/python
if [ ! -d "../venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv ../venv
    source ../venv/bin/activate
    pip install -r ../requirements.txt
else
    source ../venv/bin/activate
fi

# Check if backend is already running
if [ -f "../../.pids/api.pid" ] && kill -0 $(cat ../../.pids/api.pid) 2>/dev/null; then
    echo "⚠️  Backend already running (PID: $(cat ../../.pids/api.pid))"
else
    mkdir -p ../../.pids ../../logs
    nohup python api.py > ../../logs/api.log 2>&1 &
    echo $! > ../../.pids/api.pid
    echo "✓ Backend started (PID: $!)"
fi

cd "$PROJECT_DIR"

# Start frontend
echo "🎨 Starting frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Check if frontend is already running
if [ -f "../.pids/frontend.pid" ] && kill -0 $(cat ../.pids/frontend.pid) 2>/dev/null; then
    echo "⚠️  Frontend already running (PID: $(cat ../.pids/frontend.pid))"
else
    mkdir -p ../.pids ../logs
    nohup npm run dev > ../logs/frontend.log 2>&1 &
    echo $! > ../.pids/frontend.pid
    echo "✓ Frontend started (PID: $!)"
fi

cd "$PROJECT_DIR"

echo ""
echo "✅ OpenDRIVE Road Network Processor started!"
echo ""
echo "📊 Dashboard: http://localhost:8080"
echo "🔌 API:       http://localhost:8000"
echo "📖 API Docs:  http://localhost:8000/docs"
echo ""
echo "Use ./stop.sh to stop all services"
