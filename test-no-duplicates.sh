#!/bin/bash

echo "⏳ Waiting for v1.4.6 deployment..."

for i in {1..25}; do
  VERSION=$(curl -s https://flash-ai-backend-rld7.onrender.com/health 2>&1 | python3 -c "import sys, json; print(json.load(sys.stdin).get('version', 'unknown'))" 2>/dev/null || echo "unknown")
  echo "[$i/25] Version: $VERSION"
  
  if [ "$VERSION" = "1.4.6" ]; then
    echo ""
    echo "✅ v1.4.6 Deployed!"
    echo ""
    break
  fi
  sleep 10
done

if [ "$VERSION" != "1.4.6" ]; then
  echo "⏰ Deployment timeout"
  exit 1
fi

echo "🧪 Testing: Checking for duplicate products..."
echo ""

cat > /tmp/test-duplicates.json << 'TESTEOF'
{
  "message": "show me complete hair care routine options",
  "sessionId": "test-no-duplicates-final"
}
TESTEOF

RESPONSE=$(curl -s -X POST "https://flash-ai-backend-rld7.onrender.com/api/widget/chat" \
  -H "Content-Type: application/json" \
  -H "x-api-key: fa_e855f85b0585634b7b578b66985f2618" \
  -d @/tmp/test-duplicates.json)

echo "$RESPONSE" | python3 -c "
import sys, json, re

data = json.load(sys.stdin)
if data.get('success'):
    msg = data['data']['message']
    
    # Extract all product titles
    products = re.findall(r'\[PRODUCT:\s*([^|]+)\s*\|', msg)
    
    print(f'Total products shown: {len(products)}')
    print(f'Unique products: {len(set(products))}')
    print('')
    
    if len(products) != len(set(products)):
        print('❌ DUPLICATES FOUND:')
        seen = set()
        for p in products:
            p = p.strip()
            if p in seen:
                print(f'  - {p} (DUPLICATE)')
            seen.add(p)
    else:
        print('✅ SUCCESS: All products are unique!')
    
    print('')
    print('Products shown:')
    for p in set(products):
        print(f'  - {p.strip()}')
else:
    print('Error:', data)
"

echo ""
echo ""
echo "🎯 Test at: https://zorohshop.shop"
