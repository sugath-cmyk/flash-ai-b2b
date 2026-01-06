#!/bin/bash

echo "⏳ Waiting for v1.4.7 deployment..."

for i in {1..25}; do
  VERSION=$(curl -s https://flash-ai-backend-rld7.onrender.com/health 2>&1 | python3 -c "import sys, json; print(json.load(sys.stdin).get('version', 'unknown'))" 2>/dev/null || echo "unknown")
  echo "[$i/25] Version: $VERSION"
  
  if [ "$VERSION" = "1.4.7" ]; then
    echo ""
    echo "✅ v1.4.7 Deployed!"
    echo ""
    break
  fi
  sleep 10
done

if [ "$VERSION" != "1.4.7" ]; then
  echo "⏰ Deployment timeout"
  exit 1
fi

echo "🧪 Testing: ONE carousel only..."
echo ""

# Test the exact scenario user showed
cat > /tmp/test-one-carousel.json << 'TESTEOF'
{
  "message": "suggest me one each of conditioner and oil",
  "sessionId": "test-one-carousel-only"
}
TESTEOF

RESPONSE=$(curl -s -X POST "https://flash-ai-backend-rld7.onrender.com/api/widget/chat" \
  -H "Content-Type: application/json" \
  -H "x-api-key: fa_e855f85b0585634b7b578b66985f2618" \
  -d @/tmp/test-one-carousel.json)

echo "$RESPONSE" | python3 -c "
import sys, json, re

data = json.load(sys.stdin)
if data.get('success'):
    msg = data['data']['message']
    
    # Check for section headers
    has_sections = bool(re.search(r'(SHAMPOO:|CONDITIONER:|HAIR OIL:|MASK:|SERUM:)', msg))
    
    # Count [PRODUCT: occurrences
    product_count = len(re.findall(r'\[PRODUCT:', msg))
    
    # Extract unique products
    products = re.findall(r'\[PRODUCT:\s*([^|]+)\s*\|', msg)
    unique_count = len(set(products))
    
    print(f'Products shown: {product_count}')
    print(f'Unique products: {unique_count}')
    print(f'Section headers found: {\"YES - WRONG!\" if has_sections else \"NO - CORRECT!\"}')
    print('')
    
    if has_sections:
        print('❌ STILL HAS SECTIONS: Bot created multiple carousels')
    elif product_count == unique_count and product_count <= 5:
        print('✅ SUCCESS: One carousel with unique products!')
    else:
        print('⚠️ Issue detected')
    
    print('')
    print('Response preview:')
    print(msg[:500])
else:
    print('Error:', data)
"

echo ""
echo ""
echo "🎯 Test at: https://zorohshop.shop"
