# How to Run Production Database Migration

## Step 1: Set Up Admin Secret in Vercel

1. Go to Vercel → Your Project → **Settings** → **Environment Variables**
2. Click **"Add Another"** or **"Create new"**
3. Add this variable:
   - **Key:** `ADMIN_SECRET`
   - **Value:** `FlashAI-2026-Secure-Migration-Key` (or any secure string you prefer)
   - **Environment:** Select "All Environments" or just "Production"
4. Click **Save**
5. **Important:** Redeploy your backend (Vercel will prompt you to redeploy)

## Step 2: Wait for Deployment

Wait 2-3 minutes for the backend to redeploy with the new migration endpoint.

Check deployment status at: https://vercel.com/dashboard

## Step 3: Check Current Migration Status

Open your browser or use curl to check if migration is needed:

```bash
# Check status (no auth needed)
curl https://flash-ai-b2b.vercel.app/api/migrate/status
```

You should see:
```json
{
  "success": true,
  "migrationComplete": false,
  "tables": {
    "extracted_discounts": {
      "exists": false,
      "count": 0
    },
    "store_offers": {
      "exists": false,
      "count": 0
    }
  },
  "message": "Migration not yet run - tables missing"
}
```

## Step 4: Run the Migration

Use curl or any API client (Postman, Thunder Client, etc.):

```bash
# Run migration
curl -X POST https://flash-ai-b2b.vercel.app/api/migrate/run-discounts-migration \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: FlashAI-2026-Secure-Migration-Key" \
  -d '{}'
```

**Replace `FlashAI-2026-Secure-Migration-Key` with the ADMIN_SECRET you set in Step 1**

## Step 5: Verify Migration Succeeded

Check status again:

```bash
curl https://flash-ai-b2b.vercel.app/api/migrate/status
```

You should see:
```json
{
  "success": true,
  "migrationComplete": true,
  "tables": {
    "extracted_discounts": {
      "exists": true,
      "count": 0
    },
    "store_offers": {
      "exists": true,
      "count": 0
    }
  },
  "message": "Migration is complete"
}
```

## Step 6: Test the Bot

1. Go to https://zorohshop.shop
2. Open the chat widget
3. Ask: "Do you have any discounts?"
4. The bot should now work! 🎉

---

## Expected Responses

### Success Response:
```json
{
  "success": true,
  "message": "Migration completed successfully",
  "tablesCreated": {
    "extracted_discounts": true,
    "store_offers": true
  },
  "timestamp": "2026-01-07T..."
}
```

### Already Completed:
```json
{
  "success": true,
  "message": "Migration already completed - tables already exist",
  "alreadyExists": true
}
```

### Error Response:
```json
{
  "error": "Unauthorized: Invalid admin secret"
}
```
If you get this, check that ADMIN_SECRET matches in Vercel and your curl command.

---

## Troubleshooting

**Problem:** "Unauthorized: Invalid admin secret"
- **Solution:** Make sure ADMIN_SECRET in Vercel matches the value in your curl command
- **Solution:** Redeploy backend after adding ADMIN_SECRET

**Problem:** "Migration file not found"
- **Solution:** Make sure you pushed the latest code (we just did this)
- **Solution:** Check Vercel deployment logs

**Problem:** Bot still shows error
- **Solution:** Trigger a Shopify sync to extract discounts
- **Solution:** Clear browser cache and reload the widget

---

## Alternative: Use Browser Console

You can also run the migration from your browser console:

```javascript
fetch('https://flash-ai-b2b.vercel.app/api/migrate/run-discounts-migration', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-admin-secret': 'FlashAI-2026-Secure-Migration-Key' // Replace with your secret
  },
  body: JSON.stringify({})
})
.then(r => r.json())
.then(data => console.log('Migration result:', data))
.catch(err => console.error('Error:', err));
```

---

## What This Migration Creates

✅ **extracted_discounts** table - Stores Shopify discount codes
✅ **store_offers** table - Stores manually uploaded offers
✅ Updates **documents** table with store_id and document_type columns
✅ All necessary indexes for performance

After migration, the bot will be able to answer discount questions! 🎉
