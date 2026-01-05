#!/bin/bash

STORE_ID="62130715-ff42-4160-934e-c663fc1e7872"
BASE_URL="https://flash-ai-backend-rld7.onrender.com"

echo "========================================================================"
echo "Testing Production Query Analytics Endpoints - End to End"
echo "========================================================================"
echo ""
echo "Store ID: $STORE_ID"
echo "Backend: $BASE_URL"
echo ""

# Test 1: Health check
echo "Test 1: Health Check"
echo "--------------------------------------------------------------------"
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""
echo ""

# Test 2: Stats endpoint (without auth - should get 401 or specific error)
echo "Test 2: Query Stats Endpoint (without auth)"
echo "--------------------------------------------------------------------"
echo "GET $BASE_URL/api/brand/$STORE_ID/query-analytics/stats?days=30"
echo ""
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BASE_URL/api/brand/$STORE_ID/query-analytics/stats?days=30")
HTTP_CODE=$(echo "$RESPONSE" | grep HTTP_CODE | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/HTTP_CODE:.*//')

echo "Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""
echo ""

# Test 3: Popular queries endpoint
echo "Test 3: Popular Queries Endpoint (without auth)"
echo "--------------------------------------------------------------------"
echo "GET $BASE_URL/api/brand/$STORE_ID/query-analytics/popular?days=30&limit=10"
echo ""
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BASE_URL/api/brand/$STORE_ID/query-analytics/popular?days=30&limit=10")
HTTP_CODE=$(echo "$RESPONSE" | grep HTTP_CODE | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/HTTP_CODE:.*//')

echo "Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""
echo ""

# Test 4: Categories endpoint
echo "Test 4: Categories Endpoint (without auth)"
echo "--------------------------------------------------------------------"
echo "GET $BASE_URL/api/brand/$STORE_ID/query-analytics/categories?days=30"
echo ""
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BASE_URL/api/brand/$STORE_ID/query-analytics/categories?days=30")
HTTP_CODE=$(echo "$RESPONSE" | grep HTTP_CODE | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/HTTP_CODE:.*//')

echo "Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""
echo ""

# Test 5: Search endpoint
echo "Test 5: Search Queries Endpoint (without auth)"
echo "--------------------------------------------------------------------"
echo "GET $BASE_URL/api/brand/$STORE_ID/query-analytics/search?page=1&limit=50"
echo ""
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BASE_URL/api/brand/$STORE_ID/query-analytics/search?page=1&limit=50")
HTTP_CODE=$(echo "$RESPONSE" | grep HTTP_CODE | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed 's/HTTP_CODE:.*//')

echo "Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""
echo ""

echo "========================================================================"
echo "ANALYSIS:"
echo "========================================================================"
echo ""
if [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Endpoints exist (401 = authentication required)"
  echo "❌ But authentication is failing"
  echo ""
  echo "This means:"
  echo "  - Backend routes are deployed correctly"
  echo "  - But frontend JWT token is not being sent or is invalid"
  echo ""
elif [ "$HTTP_CODE" = "404" ]; then
  echo "❌ Endpoints return 404 (Not Found)"
  echo ""
  echo "This means:"
  echo "  - Routes are not registered in the backend"
  echo "  - The code may not have been deployed properly"
  echo ""
elif [ "$HTTP_CODE" = "200" ]; then
  echo "⚠️  Endpoints return 200 without auth - security issue!"
  echo "But at least they're working..."
  echo ""
else
  echo "⚠️  Unexpected status code: $HTTP_CODE"
  echo ""
fi

echo "Next step: Test WITH authentication token"
echo ""
