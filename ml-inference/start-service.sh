#!/bin/bash
# Flash AI VTO ML Inference Service - Startup Script

echo "🚀 Starting Flash AI VTO ML Inference Service..."
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Please run: python3 -m venv venv"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp .env.example .env
fi

# Activate virtual environment and start server
echo "✅ Starting FastAPI server on http://0.0.0.0:8000"
echo "📚 API docs available at: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

./venv/bin/python main.py
