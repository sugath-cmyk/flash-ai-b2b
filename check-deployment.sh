#!/bin/bash

echo "🔄 Waiting for Render to deploy v1.4.1..."
echo ""

for i in {1..20}; do
  VERSION=$(curl -s https://flash-ai-backend-rld7.onrender.com/health 2>&1 | python3 -c "import sys, json; print(json.load(sys.stdin).get('version', 'unknown'))" 2>/dev/null || echo "unknown")

  echo "[$i/20] Current version: $VERSION"

  if [ "$VERSION" = "1.4.1" ]; then
    echo ""
    echo "✅ Backend deployed! Version: $VERSION"
    echo ""
    echo "🧪 Testing bot..."
    echo ""

    # Test widget script
    echo "1. Testing widget script..."
    curl -s "https://flash-ai-backend-rld7.onrender.com/widget/77e65b2a-ce51-4e64-a75e-0d3d5a4b4b84.js" | head -5
    echo ""
    echo ""

    # Test health endpoint
    echo "2. Testing health endpoint..."
    curl -s https://flash-ai-backend-rld7.onrender.com/health | python3 -m json.tool
    echo ""

    echo "🎉 Bot should now be working at: https://zorohshop.shop"
    exit 0
  fi

  sleep 10
done

echo ""
echo "⏰ Timeout waiting for deployment. Current version: $VERSION"
echo "Please check Render dashboard for deployment status."
