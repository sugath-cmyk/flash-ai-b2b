# Brand Store Connection API

Complete guide for brand owners to connect their Shopify stores via API credentials.

## Overview

This API allows brand owners to:
- ✅ Connect their Shopify store with Admin API credentials
- ✅ Test credentials before saving
- ✅ Automatically sync products, collections, and pages
- ✅ Monitor sync status and progress
- ✅ Disconnect stores when needed

## Authentication

All endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

---

## Endpoints

### 1. Test Connection (Before Saving)

Test Shopify credentials without creating a store record.

**Endpoint:** `POST /api/brand/stores/test-connection`

**Request Body:**
```json
{
  "shopDomain": "mystore.myshopify.com",
  "accessToken": "shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Connection successful!",
  "data": {
    "storeName": "My Store",
    "domain": "mystore.myshopify.com",
    "email": "owner@example.com",
    "currency": "USD",
    "country": "United States",
    "productCount": 13
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "Invalid credentials",
  "hint": "Please check your access token"
}
```

---

### 2. Connect Store

Connect a Shopify store and start automatic sync.

**Endpoint:** `POST /api/brand/stores/connect`

**Request Body:**
```json
{
  "shopDomain": "mystore.myshopify.com",
  "accessToken": "shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Store connected successfully! Product sync has started.",
  "data": {
    "storeId": "uuid-here",
    "storeName": "My Store",
    "domain": "mystore.myshopify.com",
    "isNewStore": true,
    "syncStatus": "processing",
    "shopInfo": {
      "email": "owner@example.com",
      "currency": "USD",
      "country": "United States",
      "productCount": 13
    }
  }
}
```

**What Happens After Connection:**
1. ✅ Credentials validated with Shopify API
2. ✅ Store record created (or updated if already exists)
3. ✅ Widget API key automatically generated
4. ✅ Background sync started (products, collections, pages)
5. ✅ AI widget ready to answer questions once sync completes

**Error Responses:**

*Invalid Token (401):*
```json
{
  "success": false,
  "message": "Invalid access token. Please check your Shopify Admin API credentials.",
  "hint": "Make sure the access token has not expired and has the required permissions."
}
```

*Store Already Connected (409):*
```json
{
  "success": false,
  "message": "This store is already connected to another account"
}
```

---

### 3. Get Connection Status

Check sync progress and connection health.

**Endpoint:** `GET /api/brand/stores/:storeId/connection`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "storeId": "uuid-here",
    "storeName": "My Store",
    "domain": "mystore.myshopify.com",
    "isConnected": true,
    "isSynced": true,
    "syncStatus": "completed",
    "lastSync": "2025-12-29T12:00:00Z",
    "productCount": 13,
    "collectionCount": 3,
    "latestSyncJob": {
      "status": "completed",
      "progress": 100,
      "totalItems": 13,
      "itemsProcessed": 13,
      "startedAt": "2025-12-29T12:00:00Z",
      "completedAt": "2025-12-29T12:02:30Z",
      "errorMessage": null
    }
  }
}
```

**Sync Status Values:**
- `pending` - Connection established, sync not started
- `processing` - Sync in progress
- `completed` - Sync finished successfully
- `failed` - Sync encountered errors
- `disconnected` - Store credentials removed

---

### 4. Disconnect Store

Remove Shopify credentials (keeps data and widget).

**Endpoint:** `DELETE /api/brand/stores/:storeId/connection`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Store disconnected successfully. Your data is preserved."
}
```

**Note:** This removes the Shopify credentials but keeps:
- ✅ All synced product data
- ✅ Widget configuration
- ✅ Chat history
- ✅ Analytics data

---

## Getting Shopify Admin API Credentials

### Step 1: Create Custom App in Shopify

1. Go to Shopify Admin → **Settings** → **Apps and sales channels**
2. Click **Develop apps**
3. Click **Create an app**
4. Enter app name: "Flash AI Product Assistant"
5. Click **Create app**

### Step 2: Configure API Scopes

1. Click **Configure Admin API scopes**
2. Select these scopes:
   - ✅ `read_products` - Read product data
   - ✅ `read_product_listings` - Read product listings
   - ✅ `read_collections` - Read collections
   - ✅ `read_content` - Read pages and content
3. Click **Save**

### Step 3: Install App & Get Token

1. Click **Install app**
2. Copy the **Admin API access token** (starts with `shpat_`)
3. **IMPORTANT:** Save this token securely - it's only shown once!

### Step 4: Get Shop Domain

Your shop domain format: `yourstore.myshopify.com`

Example: If your store URL is `https://my-awesome-store.myshopify.com/admin`, your domain is `my-awesome-store.myshopify.com`

---

## Integration Flow

### For Brand Owners:

```
1. Brand owner logs into Flash AI dashboard
   ↓
2. Navigates to "Connect Store" page
   ↓
3. Enters Shopify credentials:
   - Shop Domain: mystore.myshopify.com
   - Access Token: shpat_xxx...
   ↓
4. (Optional) Clicks "Test Connection" to validate
   ↓
5. Clicks "Connect Store"
   ↓
6. Backend validates credentials
   ↓
7. Background sync starts (products, collections, pages)
   ↓
8. Dashboard shows sync progress
   ↓
9. Once complete, AI widget is ready!
   ↓
10. Brand owner gets embed code and installs on their site
```

---

## Example cURL Requests

### Test Connection
```bash
curl -X POST https://your-api.com/api/brand/stores/test-connection \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shopDomain": "mystore.myshopify.com",
    "accessToken": "shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
  }'
```

### Connect Store
```bash
curl -X POST https://your-api.com/api/brand/stores/connect \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shopDomain": "mystore.myshopify.com",
    "accessToken": "shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
  }'
```

### Check Status
```bash
curl -X GET https://your-api.com/api/brand/stores/{storeId}/connection \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Disconnect
```bash
curl -X DELETE https://your-api.com/api/brand/stores/{storeId}/connection \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Error Handling

### Common Errors

**400 - Bad Request**
- Missing required fields (shopDomain or accessToken)
- Invalid domain format
- Malformed request

**401 - Unauthorized**
- Invalid or expired JWT token
- Invalid Shopify access token
- Missing authentication header

**404 - Not Found**
- Store doesn't exist
- Invalid Shopify shop domain

**409 - Conflict**
- Store already connected to another user

**500 - Internal Server Error**
- Database connection issues
- Unexpected server errors

---

## FAQ

### Q: What happens if I reconnect an already connected store?
**A:** Your store credentials will be updated, and a new sync will be triggered. All existing data is preserved.

### Q: How long does the initial sync take?
**A:** Typically 1-3 minutes for most stores. Time depends on the number of products (13 products usually takes ~30 seconds).

### Q: Can I disconnect and reconnect?
**A:** Yes! Disconnecting removes credentials but keeps all your data. You can reconnect anytime.

### Q: What permissions does the API token need?
**A:** Minimum required: `read_products`, `read_collections`, `read_content`

### Q: Is my access token stored securely?
**A:** Yes, tokens are stored encrypted in the database and never exposed in API responses.

### Q: What if sync fails?
**A:** Check the sync status endpoint for error details. Common issues:
- Token expired or revoked
- Insufficient API permissions
- Network connectivity issues

---

## Next Steps

After connecting your store:

1. **Monitor Sync Progress** - Use the connection status endpoint
2. **Configure Widget** - Customize colors, position, greetings
3. **Get Embed Code** - Install widget on your Shopify store
4. **Test AI Assistant** - Verify it can answer product questions
5. **View Analytics** - Track customer interactions

Need help? Contact support or check our [full documentation](https://docs.flashai.com).
