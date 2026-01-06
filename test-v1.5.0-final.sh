#!/bin/bash

echo "⏳ Waiting for v1.5.0..."

for i in {1..30}; do
  V=$(curl -s https://flash-ai-backend-rld7.onrender.com/health 2>&1 | python3 -c "import sys, json; print(json.load(sys.stdin).get('version', 'unknown'))" 2>/dev/null || echo "unknown")
  echo "[$i/30] v$V"

  if [ "$V" = "1.5.0" ]; then
    echo ""
    echo "✅ v1.5.0 Deployed!"
    echo ""
    echo "🧪 Testing section header removal..."
    echo ""

    curl -s -X POST "https://flash-ai-backend-rld7.onrender.com/api/widget/chat" \
      -H "Content-Type: application/json" \
      -H "x-api-key: fa_e855f85b0585634b7b578b66985f2618" \
      -d '{"message":"suggest me one each of conditioner and oil","sessionId":"v1-5-0-final-test"}' \
      --max-time 60 | python3 << 'PYEOF'
import sys, json, re

data = json.load(sys.stdin)
if data.get('success'):
    msg = data['data']['message']

    # Check for sections
    sections = re.findall(r'(SHAMPOO|CONDITIONER|HAIR OIL|MASK|SERUM):', msg, re.IGNORECASE)
    products = len(re.findall(r'\[PRODUCT:', msg))

    print(f'Products shown: {products}')
    print(f'Section headers found: {len(sections)}')

    if sections:
        print(f'Section headers: {sections}')
        print('\n❌ FAILED: Sections still present')
    else:
        print('\n✅ SUCCESS: No section headers!')

    print(f'\nResponse preview:\n{msg[:500]}...\n')
else:
    print(f'❌ API Error: {data}')
PYEOF

    echo ""
    echo "🎯 Test live at: https://zorohshop.shop"
    exit 0
  fi

  sleep 10
done

echo "⏰ Deployment timeout"
