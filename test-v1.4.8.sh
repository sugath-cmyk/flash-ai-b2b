#!/bin/bash

echo "⏳ Waiting for v1.4.8..."

for i in {1..30}; do
  VERSION=$(curl -s https://flash-ai-backend-rld7.onrender.com/health 2>&1 | python3 -c "import sys, json; print(json.load(sys.stdin).get('version', 'unknown'))" 2>/dev/null || echo "unknown")
  echo "[$i/30] v$VERSION"

  if [ "$VERSION" = "1.4.8" ]; then
    echo ""
    echo "✅ v1.4.8 Deployed!"
    echo ""
    break
  fi
  sleep 10
done

if [ "$VERSION" != "1.4.8" ]; then
  echo "⏰ Timeout"
  exit 1
fi

echo "🧪 Testing: ONE carousel with NO sections..."
echo ""

TIMESTAMP=$(date +%s)
curl -s -X POST "https://flash-ai-backend-rld7.onrender.com/api/widget/chat" \
  -H "Content-Type: application/json" \
  -H "x-api-key: fa_e855f85b0585634b7b578b66985f2618" \
  -d "{\"message\":\"suggest me one each of conditioner and oil\",\"sessionId\":\"final-test-$TIMESTAMP\"}" | python3 << 'PYEOF'
import sys, json, re

data = json.load(sys.stdin)
if data.get('success'):
    msg = data['data']['message']

    # Check for ANY section headers
    sections = re.findall(r'(SHAMPOO:|CONDITIONER:|HAIR OIL:|MASK:|SERUM:|\*\*CONDITIONER:\*\*|\*\*HAIR OIL:\*\*|\*\*SHAMPOO:\*\*)', msg, re.IGNORECASE)
    products = len(re.findall(r'\[PRODUCT:', msg))

    print(f'Products shown: {products}')

    if sections:
        print(f'❌ SECTIONS FOUND: {sections}')
        print('STILL WRONG!')
    else:
        print('✅ NO SECTIONS - CORRECT!')

    print(f'\nResponse:\n{msg[:700]}...')
else:
    print('Error:', data)
PYEOF

echo ""
echo ""
echo "🎯 Test at: https://zorohshop.shop"
