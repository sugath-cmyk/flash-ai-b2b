#!/bin/bash

echo "⏳ Waiting for v1.4.5 deployment..."

for i in {1..25}; do
  VERSION=$(curl -s https://flash-ai-backend-rld7.onrender.com/health 2>&1 | python3 -c "import sys, json; print(json.load(sys.stdin).get('version', 'unknown'))" 2>/dev/null || echo "unknown")
  echo "[$i/25] Version: $VERSION"
  
  if [ "$VERSION" = "1.4.5" ]; then
    echo ""
    echo "✅ v1.4.5 Deployed!"
    echo ""
    break
  fi
  sleep 10
done

if [ "$VERSION" != "1.4.5" ]; then
  echo "⏰ Deployment timeout"
  exit 1
fi

echo "🧪 Testing: Can bot find shampoos now?"
echo ""

cat > /tmp/test-shampoo-final.json << 'TESTEOF'
{
  "message": "show me all hair shampoo options",
  "sessionId": "test-all-shampoos-final"
}
TESTEOF

RESPONSE=$(curl -s -X POST "https://flash-ai-backend-rld7.onrender.com/api/widget/chat" \
  -H "Content-Type: application/json" \
  -H "x-api-key: fa_e855f85b0585634b7b578b66985f2618" \
  -d @/tmp/test-shampoo-final.json)

echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data.get('success'):
    msg = data['data']['message']
    print(msg[:1500])
    
    # Check if shampoos are found
    if 'Maleic Bond Repair' in msg or 'Anti Dandruff Shampoo' in msg:
        print('\n\n✅ SUCCESS: Bot can now see shampoos!')
    else:
        print('\n\n❌ ISSUE: Bot still not finding shampoos')
else:
    print('Error:', data)
"

echo ""
echo ""
echo "🎯 Test at: https://zorohshop.shop"
