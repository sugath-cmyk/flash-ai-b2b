# Shopify Integration & Widget Customization - Implementation Plan

## Overview

This document outlines the complete implementation for:
1. **Shopify Store Connection** - OAuth flow for any Shopify store
2. **Automated Data Extraction** - Real-time sync of products, collections, policies
3. **Brand Owner Dashboard** - Self-service store management
4. **Widget Customization** - Brand-specific styling and configuration

---

## Part 1: Shopify Store Connection

### 1.1 Shopify OAuth Flow

**What Needs to Be Built**:

#### Backend: OAuth Controller
```typescript
// /backend/src/controllers/shopify-oauth.controller.ts

export class ShopifyOAuthController {
  // Step 1: Initiate OAuth
  async initiateAuth(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const { shopDomain } = req.body; // e.g., "mystore.myshopify.com"
    
    // Generate state token for security
    const state = generateSecureToken();
    await storeOAuthState(userId, state, shopDomain);
    
    // Build Shopify OAuth URL
    const authUrl = `https://${shopDomain}/admin/oauth/authorize?` +
      `client_id=${SHOPIFY_API_KEY}` +
      `&scope=${SHOPIFY_SCOPES}` +
      `&redirect_uri=${REDIRECT_URI}` +
      `&state=${state}`;
    
    return res.json({ authUrl });
  }
  
  // Step 2: Handle Shopify Callback
  async handleCallback(req: Request, res: Response) {
    const { code, shop, state } = req.query;
    
    // Verify state token
    const userId = await verifyOAuthState(state);
    if (!userId) throw createError('Invalid OAuth state', 401);
    
    // Exchange code for access token
    const accessToken = await exchangeCodeForToken(shop, code);
    
    // Save store connection
    await saveShopifyStore(userId, shop, accessToken);
    
    // Trigger initial data extraction
    await triggerStoreExtraction(shop, userId);
    
    // Redirect to brand dashboard
    return res.redirect(`/brand-console?connected=success`);
  }
  
  // Step 3: Disconnect Store
  async disconnectStore(req: AuthRequest, res: Response) {
    const { storeId } = req.params;
    const userId = req.user!.id;
    
    await shopifyService.disconnectStore(storeId, userId);
    
    return res.json({ success: true });
  }
}
```

**Required Scopes** (Shopify permissions):
```typescript
const SHOPIFY_SCOPES = [
  'read_products',
  'read_product_listings',
  'read_collections',
  'read_content',
  'read_orders',        // For order tracking
  'read_customers',     // For customer insights
  'read_analytics',     // For store analytics
].join(',');
```

### 1.2 Shopify API Service

```typescript
// /backend/src/services/shopify-api.service.ts

export class ShopifyAPIService {
  private client: Shopify;
  
  constructor(shop: string, accessToken: string) {
    this.client = new Shopify({
      shopName: shop,
      accessToken: accessToken,
      apiVersion: '2024-01',
    });
  }
  
  // Extract all products
  async extractProducts(storeId: string): Promise<void> {
    let hasNextPage = true;
    let cursor = null;
    
    while (hasNextPage) {
      const response = await this.client.product.list({
        limit: 250,
        cursor: cursor,
      });
      
      for (const product of response.products) {
        await this.saveProduct(storeId, product);
      }
      
      hasNextPage = response.pageInfo.hasNextPage;
      cursor = response.pageInfo.cursor;
    }
  }
  
  // Extract collections
  async extractCollections(storeId: string): Promise<void> {
    const collections = await this.client.collection.list({ limit: 250 });
    
    for (const collection of collections) {
      await this.saveCollection(storeId, collection);
    }
  }
  
  // Extract store policies
  async extractPolicies(storeId: string): Promise<void> {
    const shop = await this.client.shop.get();
    
    await this.savePolicy(storeId, 'terms', shop.termsOfService);
    await this.savePolicy(storeId, 'privacy', shop.privacyPolicy);
    await this.savePolicy(storeId, 'refund', shop.refundPolicy);
    await this.savePolicy(storeId, 'shipping', shop.shippingPolicy);
  }
  
  // Webhook handlers for real-time sync
  async handleProductUpdate(webhook: ShopifyWebhook): Promise<void> {
    const { product, store_id } = webhook;
    await this.updateProduct(store_id, product);
  }
}
```

### 1.3 Database Schema Updates

```sql
-- Add Shopify connection fields to stores table
ALTER TABLE stores ADD COLUMN shopify_domain VARCHAR(255);
ALTER TABLE stores ADD COLUMN shopify_access_token TEXT;
ALTER TABLE stores ADD COLUMN shopify_store_id BIGINT;
ALTER TABLE stores ADD COLUMN last_sync_at TIMESTAMP;
ALTER TABLE stores ADD COLUMN sync_status VARCHAR(50); -- 'pending', 'syncing', 'completed', 'failed'
ALTER TABLE stores ADD COLUMN sync_error TEXT;

-- OAuth state tracking
CREATE TABLE shopify_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  state_token VARCHAR(255) NOT NULL UNIQUE,
  shop_domain VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

-- Webhook subscriptions
CREATE TABLE shopify_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id),
  webhook_id BIGINT NOT NULL,
  topic VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Part 2: Brand Owner Dashboard Enhancements

### 2.1 Store Connection Page

**New Route**: `/brand-console/connect-store`

```typescript
// /frontend/src/pages/ConnectStore.tsx

export default function ConnectStore() {
  const [shopDomain, setShopDomain] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleConnect = async () => {
    setLoading(true);
    
    try {
      // Step 1: Request OAuth URL
      const response = await axios.post('/api/shopify/auth/initiate', {
        shopDomain: shopDomain.replace(/^https?:\/\//, ''),
      });
      
      // Step 2: Redirect to Shopify
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Connection failed:', error);
      setLoading(false);
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Connect Your Shopify Store</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Shopify Store URL
          </label>
          <div className="flex">
            <input
              type="text"
              value={shopDomain}
              onChange={(e) => setShopDomain(e.target.value)}
              placeholder="mystore.myshopify.com"
              className="flex-1 px-4 py-2 border rounded-l-lg focus:ring-2 focus:ring-emerald-500"
            />
            <button
              onClick={handleConnect}
              disabled={loading || !shopDomain}
              className="px-6 py-2 bg-emerald-600 text-white rounded-r-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">What happens next?</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• You'll be redirected to Shopify to authorize</li>
            <li>• We'll import your products, collections, and policies</li>
            <li>• Your AI chatbot will be ready in minutes</li>
            <li>• We'll keep your data synced automatically</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
```

### 2.2 Store Management Dashboard

```typescript
// /frontend/src/pages/StoreManagement.tsx

export default function StoreManagement() {
  const [store, setStore] = useState<any>(null);
  
  useEffect(() => {
    loadStoreData();
  }, []);
  
  const handleSync = async () => {
    await axios.post(`/api/stores/${store.id}/sync`);
    // Trigger re-extraction
  };
  
  const handleDisconnect = async () => {
    if (confirm('Are you sure? This will remove all synced data.')) {
      await axios.delete(`/api/stores/${store.id}/connection`);
      navigate('/brand-console/connect-store');
    }
  };
  
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Store Management</h1>
      
      {/* Connection Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{store.store_name}</h2>
            <p className="text-gray-600">{store.shopify_domain}</p>
            <div className="mt-2">
              <span className={`px-3 py-1 rounded-full text-sm ${
                store.sync_status === 'completed' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {store.sync_status}
              </span>
            </div>
          </div>
          
          <div className="space-x-3">
            <button
              onClick={handleSync}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Sync Now
            </button>
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>
      
      {/* Sync Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-gray-600 text-sm">Products Synced</h3>
          <p className="text-3xl font-bold text-emerald-600">{store.productCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-gray-600 text-sm">Collections</h3>
          <p className="text-3xl font-bold text-emerald-600">{store.collectionCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-gray-600 text-sm">Last Synced</h3>
          <p className="text-lg font-semibold">{formatDate(store.last_sync_at)}</p>
        </div>
      </div>
      
      {/* Auto-sync Settings */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Sync Settings</h2>
        <div className="space-y-4">
          <label className="flex items-center">
            <input type="checkbox" className="mr-3" defaultChecked />
            <span>Auto-sync every 24 hours</span>
          </label>
          <label className="flex items-center">
            <input type="checkbox" className="mr-3" defaultChecked />
            <span>Real-time sync via webhooks</span>
          </label>
          <label className="flex items-center">
            <input type="checkbox" className="mr-3" />
            <span>Sync customer reviews</span>
          </label>
        </div>
      </div>
    </div>
  );
}
```

---

## Part 3: Widget Customization

### 3.1 Widget Customization UI

```typescript
// /frontend/src/pages/WidgetCustomization.tsx

export default function WidgetCustomization() {
  const [config, setConfig] = useState({
    // Appearance
    primaryColor: '#10b981',      // emerald-500
    accentColor: '#059669',       // emerald-600
    position: 'bottom-right',     // 'bottom-right', 'bottom-left'
    size: 'medium',               // 'small', 'medium', 'large'
    
    // Branding
    brandName: 'Flash AI',
    showBranding: true,
    customLogo: null,
    
    // Messages
    welcomeMessage: 'Hi! How can I help you today?',
    placeholderText: 'Ask about our products...',
    
    // Behavior
    autoOpen: false,
    autoOpenDelay: 5000,          // 5 seconds
    showOnMobile: true,
    
    // Quick Questions
    quickQuestions: [
      'What are the key ingredients?',
      'Is this suitable for sensitive skin?',
      'How do I use this product?',
    ],
  });
  
  const handleSave = async () => {
    await axios.put(`/api/brand/${storeId}/widget-config`, config);
    toast.success('Widget customization saved!');
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Customization Form */}
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Widget Customization</h1>
        
        {/* Appearance Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Appearance</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Primary Color</label>
              <input
                type="color"
                value={config.primaryColor}
                onChange={(e) => setConfig({...config, primaryColor: e.target.value})}
                className="w-full h-10 rounded border"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Position</label>
              <select
                value={config.position}
                onChange={(e) => setConfig({...config, position: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Size</label>
              <select
                value={config.size}
                onChange={(e) => setConfig({...config, size: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="small">Small (320px)</option>
                <option value="medium">Medium (384px)</option>
                <option value="large">Large (480px)</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Messages Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Messages</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Welcome Message</label>
              <textarea
                value={config.welcomeMessage}
                onChange={(e) => setConfig({...config, welcomeMessage: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg"
                rows={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Input Placeholder</label>
              <input
                type="text"
                value={config.placeholderText}
                onChange={(e) => setConfig({...config, placeholderText: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
          </div>
        </div>
        
        {/* Quick Questions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Questions</h2>
          
          {config.quickQuestions.map((question, index) => (
            <div key={index} className="mb-3">
              <input
                type="text"
                value={question}
                onChange={(e) => {
                  const newQuestions = [...config.quickQuestions];
                  newQuestions[index] = e.target.value;
                  setConfig({...config, quickQuestions: newQuestions});
                }}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
          ))}
        </div>
        
        <button
          onClick={handleSave}
          className="w-full py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold"
        >
          Save Customization
        </button>
      </div>
      
      {/* Right: Live Preview */}
      <div className="sticky top-6">
        <div className="bg-gray-100 rounded-lg p-6 h-[800px] relative">
          <h2 className="text-xl font-semibold mb-4">Live Preview</h2>
          <div className="bg-white rounded-lg h-full relative overflow-hidden">
            {/* Preview the widget with current config */}
            <WidgetPreview config={config} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 3.2 Widget Config Database Schema

```sql
-- Widget customization table
CREATE TABLE widget_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) UNIQUE,
  
  -- Appearance
  primary_color VARCHAR(7) DEFAULT '#10b981',
  accent_color VARCHAR(7) DEFAULT '#059669',
  position VARCHAR(20) DEFAULT 'bottom-right',
  size VARCHAR(20) DEFAULT 'medium',
  
  -- Branding
  brand_name VARCHAR(100),
  show_branding BOOLEAN DEFAULT true,
  custom_logo TEXT,
  
  -- Messages
  welcome_message TEXT DEFAULT 'Hi! How can I help you today?',
  placeholder_text VARCHAR(255) DEFAULT 'Ask about our products...',
  
  -- Behavior
  auto_open BOOLEAN DEFAULT false,
  auto_open_delay INT DEFAULT 5000,
  show_on_mobile BOOLEAN DEFAULT true,
  
  -- Quick Questions
  quick_questions JSONB DEFAULT '[]',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Implementation Timeline

### Phase 1: Shopify Connection (Week 1-2)
- [ ] Set up Shopify OAuth flow
- [ ] Build OAuth controller and callback handler
- [ ] Create ConnectStore page in frontend
- [ ] Test OAuth flow end-to-end
- [ ] Handle errors and edge cases

### Phase 2: Data Extraction (Week 2-3)
- [ ] Implement ShopifyAPIService
- [ ] Build product extraction logic
- [ ] Build collection extraction logic
- [ ] Extract store policies and pages
- [ ] Set up Bull queue for background jobs
- [ ] Add progress tracking

### Phase 3: Dashboard Integration (Week 3-4)
- [ ] Build StoreManagement page
- [ ] Add sync status displays
- [ ] Implement manual sync button
- [ ] Add disconnect functionality
- [ ] Show extraction statistics

### Phase 4: Widget Customization (Week 4-5)
- [ ] Build WidgetCustomization page
- [ ] Create live preview component
- [ ] Implement save/update API
- [ ] Apply custom config to widget
- [ ] Add embed code with custom config

### Phase 5: Webhooks & Real-time Sync (Week 5-6)
- [ ] Set up Shopify webhook subscriptions
- [ ] Handle product/update webhooks
- [ ] Handle product/delete webhooks
- [ ] Handle collection webhooks
- [ ] Test real-time sync

---

## API Endpoints Summary

### Shopify OAuth
- `POST /api/shopify/auth/initiate` - Start OAuth flow
- `GET /api/shopify/auth/callback` - Handle Shopify callback
- `DELETE /api/stores/:storeId/connection` - Disconnect store

### Store Management
- `GET /api/stores/:storeId` - Get store details
- `POST /api/stores/:storeId/sync` - Trigger manual sync
- `GET /api/stores/:storeId/sync-status` - Get sync progress

### Widget Customization
- `GET /api/brand/:storeId/widget-config` - Get widget config
- `PUT /api/brand/:storeId/widget-config` - Update widget config
- `GET /api/widget/config` - Public endpoint for widget (with API key)

### Webhooks
- `POST /api/webhooks/shopify/products-update` - Product update webhook
- `POST /api/webhooks/shopify/products-delete` - Product delete webhook
- `POST /api/webhooks/shopify/collections-update` - Collection update webhook

---

## Security Considerations

1. **OAuth Security**:
   - Use state tokens to prevent CSRF
   - Validate redirect URIs
   - Encrypt access tokens at rest

2. **API Rate Limiting**:
   - Shopify has rate limits (2 requests/second)
   - Implement exponential backoff
   - Use bulk operations where possible

3. **Webhook Verification**:
   - Verify HMAC signatures
   - Check webhook origin
   - Prevent replay attacks

4. **Data Privacy**:
   - Only request necessary Shopify scopes
   - Encrypt sensitive data
   - Comply with GDPR/privacy laws

---

## Testing Plan

### Unit Tests
- OAuth flow state generation/verification
- Shopify API service methods
- Widget config validation

### Integration Tests
- Complete OAuth flow
- Data extraction pipeline
- Webhook handling
- Real-time sync

### E2E Tests
- Brand owner connects store
- Products appear in dashboard
- Widget shows correct data
- Customization applies correctly

---

## Deployment Checklist

- [ ] Create Shopify Partner account
- [ ] Register app in Shopify Partners
- [ ] Configure OAuth redirect URLs
- [ ] Set up environment variables
- [ ] Deploy webhook endpoints
- [ ] Configure SSL certificates
- [ ] Test with real Shopify store
- [ ] Set up monitoring and alerts
- [ ] Document for brand owners

---

## Future Enhancements

1. **Multi-store Support**: Brand owners with multiple stores
2. **Advanced Analytics**: Store performance insights
3. **Product Recommendations**: AI-powered suggestions
4. **Inventory Alerts**: Low stock notifications
5. **Customer Insights**: Chat analytics by product
6. **A/B Testing**: Test different widget configurations
7. **WhatsApp Integration**: Chat via WhatsApp
8. **Email Integration**: Capture leads from chat

