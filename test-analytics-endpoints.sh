#!/bin/bash

# Test Analytics Endpoints for Production
# This script tests the brand-specific query analytics endpoints

STORE_ID="62130715-ff42-4160-934e-c663fc1e7872"
BASE_URL="https://flash-ai-backend-rld7.onrender.com/api"

echo "================================================================"
echo "Testing Query Analytics Endpoints"
echo "================================================================"
echo ""
echo "Store ID: $STORE_ID"
echo "Base URL: $BASE_URL"
echo ""
echo "⚠️  You need to provide your JWT token to test authenticated endpoints"
echo ""
echo "To get your token:"
echo "1. Open https://flash-ai-b2b.vercel.app in your browser"
echo "2. Login to your account"
echo "3. Open DevTools (F12)"
echo "4. Go to Console tab"
echo "5. Type: localStorage.getItem('access_token')"
echo "6. Copy the token (without quotes)"
echo ""
read -p "Paste your JWT token here: " TOKEN
echo ""

if [ -z "$TOKEN" ]; then
  echo "❌ No token provided. Exiting."
  exit 1
fi

echo "================================================================"
echo "Test 1: Conversations Endpoint"
echo "================================================================"
echo ""
echo "GET /api/brand/$STORE_ID/conversations"
echo ""

CONV_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE_URL/brand/$STORE_ID/conversations")

HTTP_STATUS=$(echo "$CONV_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$CONV_RESPONSE" | sed -e 's/HTTP_STATUS:.*//')

echo "Status: $HTTP_STATUS"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Success!"
  echo ""
  echo "Response:"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
  echo "❌ Failed"
  echo ""
  echo "Response:"
  echo "$BODY"
fi

echo ""
echo "================================================================"
echo "Test 2: Query Stats Endpoint"
echo "================================================================"
echo ""
echo "GET /api/brand/$STORE_ID/query-analytics/stats?days=30"
echo ""

STATS_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE_URL/brand/$STORE_ID/query-analytics/stats?days=30")

HTTP_STATUS=$(echo "$STATS_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$STATS_RESPONSE" | sed -e 's/HTTP_STATUS:.*//')

echo "Status: $HTTP_STATUS"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Success!"
  echo ""
  echo "Response:"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
  echo "❌ Failed"
  echo ""
  echo "Response:"
  echo "$BODY"
fi

echo ""
echo "================================================================"
echo "Test 3: Popular Queries Endpoint"
echo "================================================================"
echo ""
echo "GET /api/brand/$STORE_ID/query-analytics/popular?days=30&limit=10"
echo ""

POP_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE_URL/brand/$STORE_ID/query-analytics/popular?days=30&limit=10")

HTTP_STATUS=$(echo "$POP_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$POP_RESPONSE" | sed -e 's/HTTP_STATUS:.*//')

echo "Status: $HTTP_STATUS"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Success!"
  echo ""
  echo "Response:"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
  echo "❌ Failed"
  echo ""
  echo "Response:"
  echo "$BODY"
fi

echo ""
echo "================================================================"
echo "Test 4: Category Breakdown Endpoint"
echo "================================================================"
echo ""
echo "GET /api/brand/$STORE_ID/query-analytics/categories?days=30"
echo ""

CAT_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE_URL/brand/$STORE_ID/query-analytics/categories?days=30")

HTTP_STATUS=$(echo "$CAT_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$CAT_RESPONSE" | sed -e 's/HTTP_STATUS:.*//')

echo "Status: $HTTP_STATUS"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Success!"
  echo ""
  echo "Response:"
  echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
else
  echo "❌ Failed"
  echo ""
  echo "Response:"
  echo "$BODY"
fi

echo ""
echo "================================================================"
echo "Summary"
echo "================================================================"
echo ""
echo "If you see '200' status codes above, the endpoints are working!"
echo ""
echo "If the response shows 0 queries or empty arrays, it means:"
echo "  - Your store exists in the database ✅"
echo "  - But there are no conversations yet ℹ️"
echo ""
echo "To generate data:"
echo "  1. Make sure your widget is installed on your Shopify store"
echo "  2. Visit a product page"
echo "  3. Chat with the widget"
echo "  4. The analytics will populate automatically"
echo ""
