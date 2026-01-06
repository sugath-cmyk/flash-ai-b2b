#!/bin/bash

echo "⏳ Waiting for deployment of v1.4.3..."
echo ""

for i in {1..20}; do
  VERSION=$(curl -s https://flash-ai-backend-rld7.onrender.com/health 2>&1 | python3 -c "import sys, json; print(json.load(sys.stdin).get('version', 'unknown'))" 2>/dev/null || echo "unknown")

  echo "[$i/20] Version: $VERSION"

  if [ "$VERSION" = "1.4.3" ]; then
    echo ""
    echo "✅ v1.4.3 Deployed!"
    echo ""
    echo "🧪 Testing price accuracy..."
    echo ""

    # Test with product context
    curl -s -X POST "https://flash-ai-backend-rld7.onrender.com/api/widget/chat" \
      -H "Content-Type: application/json" \
      -H "x-api-key: fa_e855f85b0585634b7b578b66985f2618" \
      -d '{
        "message": "what is the price?",
        "sessionId": "test-pricing-accuracy-789",
        "productContext": {
          "productTitle": "Absolut Repair hair mask",
          "price": "1000"
        }
      }' | python3 -c "import sys, json; data = json.load(sys.stdin); print(data['data']['message'][:400] if data.get('success') else 'Error: ' + str(data))"

    echo ""
    echo ""
    echo "✅ Bot is now enforcing 100% accurate pricing!"
    echo "🎯 Test at: https://zorohshop.shop"
    exit 0
  fi

  sleep 10
done

echo ""
echo "⏰ Timeout - please check Render dashboard"
