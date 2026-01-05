# Debug Production Analytics Issue

## Issue: "No queries found matching your filters"

Store ID from URL: `62130715-ff42-4160-934e-c663fc1e7872`

## Step 1: Check Browser Console Errors

**Action:** Open browser DevTools and check Console tab

1. Press **F12** or **Ctrl+Shift+I** (Cmd+Option+I on Mac)
2. Click **Console** tab
3. Look for red error messages
4. Also check **Network** tab for failed API requests

**What to look for:**
- 404 errors → Endpoint doesn't exist
- 401/403 errors → Authentication issue
- 500 errors → Server error
- CORS errors → Backend CORS configuration issue

## Step 2: Check Network Tab

1. Open DevTools → **Network** tab
2. Refresh the page
3. Filter by: **XHR** or **Fetch**
4. Look for these API calls:

```
GET /api/admin/queries/stats?storeId=62130715...&days=30
GET /api/admin/queries/popular?storeId=62130715...&days=30
GET /api/admin/queries/categories?storeId=62130715...&days=30
GET /api/admin/queries?storeId=62130715...&page=1&limit=50
```

5. Click on each request and check:
   - **Status**: Should be 200
   - **Response**: What data is returned?
   - **Headers**: Is Authorization header present?

## Step 3: Test API Directly

Copy this command and run it in your terminal (replace YOUR_TOKEN):

```bash
# Get your auth token from localStorage first
# In browser console, run: localStorage.getItem('access_token')

# Then test the API:
curl "https://flash-ai-backend-rld7.onrender.com/api/admin/queries/stats?storeId=62130715-ff42-4160-934e-c663fc1e7872&days=30" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Step 4: Check Production Database

Run this locally to check if the store has data in production:

```bash
# Check if store exists and has messages
psql $DATABASE_URL -c "
SELECT
  s.id,
  s.store_name,
  COUNT(DISTINCT wc.id) as conversations,
  COUNT(wm.id) as messages
FROM stores s
LEFT JOIN widget_conversations wc ON wc.store_id = s.id
LEFT JOIN widget_messages wm ON wm.store_id = s.id
WHERE s.id = '62130715-ff42-4160-934e-c663fc1e7872'
GROUP BY s.id, s.store_name;
"
```

## Step 5: Verify Migration Ran on Render

Check Render build logs:
1. Go to Render dashboard
2. Find `flash-ai-backend-rld7`
3. Click on latest deployment
4. Search logs for: `010_query_analytics.sql`
5. Should see: `✅ Completed: 010_query_analytics.sql`

## Common Issues & Fixes

### Issue 1: Store ID Doesn't Exist in Production
**Symptom:** API returns empty arrays or 404
**Fix:** This store ID might only exist in local DB, not production

**Check:**
```bash
psql $DATABASE_URL -c "SELECT id, store_name FROM stores LIMIT 5;"
```

**Solution:** Use a store ID that exists in production database

### Issue 2: Migration Didn't Run
**Symptom:** Database column errors in logs
**Fix:** Run migration manually on production database

```bash
# Connect to production DB
psql $DATABASE_URL

# Check if columns exist
\d widget_messages

# If query_category doesn't exist, migration didn't run
```

### Issue 3: Authentication Failing
**Symptom:** 401 Unauthorized errors
**Fix:**
- Check if you're logged in
- Check localStorage has 'access_token'
- Try logging out and logging back in

### Issue 4: Different Database on Production
**Symptom:** Local has data, production doesn't
**Reality:** Production and local are separate databases

**Solution:**
- Chat with the widget on production to generate data
- Or use a store ID that has production data

## Quick Diagnostic Script

Run this to check everything:

```bash
cd /Users/sugathsurendran/Desktop/flash-ai-b2b/backend

# Check production DB for this store
psql $DATABASE_URL -c "
SELECT
  'Store Exists' as check_type,
  EXISTS(SELECT 1 FROM stores WHERE id = '62130715-ff42-4160-934e-c663fc1e7872') as result
UNION ALL
SELECT
  'Has Conversations',
  EXISTS(SELECT 1 FROM widget_conversations WHERE store_id = '62130715-ff42-4160-934e-c663fc1e7872')
UNION ALL
SELECT
  'Has Messages',
  EXISTS(SELECT 1 FROM widget_messages WHERE store_id = '62130715-ff42-4160-934e-c663fc1e7872')
UNION ALL
SELECT
  'Migration Columns Exist',
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'widget_messages' AND column_name = 'query_category');
"
```

## Next Steps

Based on what you find, let me know:
1. **What errors** do you see in browser console?
2. **What status codes** do the API calls return?
3. **Does the store ID exist** in production database?
4. **Did the migration run** on Render?

I'll help fix the specific issue!
