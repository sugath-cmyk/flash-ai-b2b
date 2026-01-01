#!/bin/bash
# Test Conversations API End-to-End

echo "========================================="
echo "CONVERSATIONS API DIAGNOSTIC TEST"
echo "========================================="
echo ""

# Replace with your actual values
BACKEND_URL="https://flash-ai-backend-rld7.onrender.com"
STORE_ID="62130715-ff42-4160-934e-c663fc1e7872"
TOKEN="your-auth-token-here"  # Get this from localStorage or cookies

echo "1. Testing Backend Health..."
curl -s "$BACKEND_URL/health" | jq '.' || echo "❌ Backend health check failed"
echo ""

echo "2. Testing Conversations Endpoint (requires auth token)..."
echo "   URL: $BACKEND_URL/api/brand/$STORE_ID/conversations"
echo ""
echo "   To get your auth token:"
echo "   - Open DevTools → Application → Local Storage → https://flash-ai-b2b.vercel.app"
echo "   - Copy the 'token' value"
echo "   - Run: TOKEN='your-token' $0"
echo ""

if [ "$TOKEN" != "your-auth-token-here" ]; then
    echo "   Testing with provided token..."
    curl -s -H "Authorization: Bearer $TOKEN" \
        "$BACKEND_URL/api/brand/$STORE_ID/conversations" | jq '.' || echo "❌ API call failed"
else
    echo "   ⚠️  No token provided - skipping authenticated test"
fi

echo ""
echo "========================================="
echo "COMMON ISSUES & FIXES:"
echo "========================================="
echo ""
echo "Issue 1: Backend Not Deployed"
echo "  Fix: Go to https://dashboard.render.com"
echo "       Click 'Manual Deploy' → 'Deploy latest commit'"
echo ""
echo "Issue 2: Database Tables Missing"
echo "  Fix: Run migration 005_brand_console.sql on production DB"
echo ""
echo "Issue 3: No Conversations Data"
echo "  Fix: Use the widget to create test conversations first"
echo ""
echo "Issue 4: Authentication Error"
echo "  Fix: Check if token is valid, try logging out/in"
echo ""
