#!/bin/bash

echo "⏳ Waiting for Render to deploy v1.5.0..."
echo ""

# Wait for new version to deploy
while true; do
  VERSION=$(curl -s https://flash-ai-backend-rld7.onrender.com/health 2>&1 | grep -o '"version":"[^"]*"' | cut -d'"' -f4)

  if [ "$VERSION" = "1.5.0" ]; then
    echo "✅ Backend deployed! Version: $VERSION"
    echo ""
    break
  else
    echo "Still deploying... Current version: $VERSION (waiting for 1.5.0)"
    sleep 10
  fi
done

echo "🚀 Running migration..."
echo ""

# Check status
echo "📊 Current status:"
curl -s https://flash-ai-backend-rld7.onrender.com/api/migrate/status | python3 -m json.tool
echo ""
echo ""

# Run migration
echo "🔧 Executing migration..."
curl -X POST https://flash-ai-backend-rld7.onrender.com/api/migrate/run-discounts-migration \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: FlashAI-2026-Secure-Migration-Key" | python3 -m json.tool

echo ""
echo ""

# Verify
echo "✅ Verifying migration completed..."
curl -s https://flash-ai-backend-rld7.onrender.com/api/migrate/status | python3 -m json.tool

echo ""
echo ""
echo "🎉 Done! Test the bot at: https://zorohshop.shop"
echo "Ask: 'Do you have any discounts?'"
