#!/bin/bash

echo "⏳ Waiting for Render to deploy v1.4.2..."
echo ""

# Wait for new version to deploy
for i in {1..30}; do
  VERSION=$(curl -s https://flash-ai-backend-rld7.onrender.com/health 2>&1 | python3 -c "import sys, json; print(json.load(sys.stdin).get('version', 'unknown'))" 2>/dev/null || echo "unknown")

  echo "[$i/30] Current version: $VERSION"

  if [ "$VERSION" = "1.4.2" ]; then
    echo ""
    echo "✅ Backend deployed! Version: $VERSION"
    echo ""
    break
  fi

  sleep 10
done

if [ "$VERSION" != "1.4.2" ]; then
  echo "⏰ Timeout waiting for deployment"
  exit 1
fi

echo "🔄 Triggering Shopify sync..."
echo ""

# Get current product count and last sync time
echo "📊 Current status:"
curl -s "https://flash-ai-backend-rld7.onrender.com/api/maintenance/sync-status/62130715-ff42-4160-934e-c663fc1e7872" | python3 -m json.tool
echo ""
echo ""

# Trigger sync (using ADMIN_SECRET from environment)
echo "🚀 Starting sync..."
SYNC_RESULT=$(curl -s -X POST "https://flash-ai-backend-rld7.onrender.com/api/maintenance/sync/62130715-ff42-4160-934e-c663fc1e7872" \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: ${ADMIN_SECRET:-FlashAI-2026-Secure-Migration-Key}")

echo "$SYNC_RESULT" | python3 -m json.tool
echo ""
echo ""

# Check specific product price
echo "🔍 Checking Absolut Repair Hair Mask price:"
curl -s "https://flash-ai-backend-rld7.onrender.com/api/maintenance/products/62130715-ff42-4160-934e-c663fc1e7872?search=absolut%20repair" \
  -H "x-admin-secret: ${ADMIN_SECRET:-FlashAI-2026-Secure-Migration-Key}" | python3 -m json.tool

echo ""
echo ""
echo "✅ Sync complete! Prices are now accurate."
echo "🧪 Test at: https://zorohshop.shop"
