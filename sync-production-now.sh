#!/bin/bash

echo "⏳ Waiting for v1.4.4 deployment..."

for i in {1..20}; do
  VERSION=$(curl -s https://flash-ai-backend-rld7.onrender.com/health 2>&1 | python3 -c "import sys, json; print(json.load(sys.stdin).get('version', 'unknown'))" 2>/dev/null || echo "unknown")
  echo "[$i/20] Version: $VERSION"
  
  if [ "$VERSION" = "1.4.4" ]; then
    echo ""
    echo "✅ v1.4.4 Deployed!"
    echo ""
    break
  fi
  sleep 10
done

if [ "$VERSION" != "1.4.4" ]; then
  echo "⏰ Deployment timeout"
  exit 1
fi

echo "🔄 Syncing Shopify data from PRODUCTION store..."
echo ""

SYNC_RESULT=$(curl -s -X POST "https://flash-ai-backend-rld7.onrender.com/api/maintenance/sync/62130715-ff42-4160-934e-c663fc1e7872" \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: FlashAI-2026-Secure-Migration-Key" \
  --max-time 120)

echo "$SYNC_RESULT" | python3 -m json.tool
echo ""
echo ""

# Check what products exist now
echo "📊 Products after sync:"
curl -s "https://flash-ai-backend-rld7.onrender.com/api/maintenance/products/62130715-ff42-4160-934e-c663fc1e7872" \
  -H "x-admin-secret: FlashAI-2026-Secure-Migration-Key" | python3 -c "
import sys, json
data = json.load(sys.stdin)
products = data['data']['products'][:10]
print(f'Total: {data[\"data\"][\"count\"]} products\n')
for p in products:
    print(f'{p[\"title\"]:50} | ₹{p[\"price\"]:>8}')"

echo ""
echo ""
echo "✅ Production sync complete!"
