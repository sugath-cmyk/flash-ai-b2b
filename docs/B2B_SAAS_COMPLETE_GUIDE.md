# Flash AI B2B SaaS - Complete Guide

## Overview

Flash AI is a comprehensive B2B SaaS platform that provides e-commerce stores with:
1. **Automated Store Data Extraction** - Extract products, collections, and store information
2. **Brand Console** - Dashboard for store owners to manage their AI widget
3. **Embeddable AI Chat Widget** - Customer-facing chat assistant for their storefront

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Flash AI Platform                        │
│  (Platform Admin - Internal Management)                      │
│  - Store import & data extraction                            │
│  - Platform management                                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─── Extracts Store Data
                            │
┌─────────────────────────────────────────────────────────────┐
│                      Brand Console                           │
│  (Store Owners - Manage their widget)                        │
│  - View analytics                                            │
│  - Customize widget appearance                               │
│  - Generate API keys                                         │
│  - Manage billing & subscription                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─── Provides Embed Code
                            │
┌─────────────────────────────────────────────────────────────┐
│                   Brand's E-commerce Store                   │
│  (Customer-facing website)                                   │
│  - Embedded Chat Widget                                      │
│  - AI-powered customer support                               │
│  - Product recommendations                                   │
└─────────────────────────────────────────────────────────────┘
```

## User Roles

### 1. Platform Admin (Your Team)
- Access: Main dashboard (`/dashboard`, `/stores`)
- Capabilities:
  - Import new brand stores
  - Extract store data (products, collections, pages)
  - Monitor platform health
  - Manage all brand accounts

### 2. Brand Store Owner (Your Customers)
- Access: Brand Console (`/brand/:storeId`)
- Capabilities:
  - View widget analytics
  - Customize widget appearance
  - Generate API keys
  - Manage subscription & billing
  - Get embed code for their website

### 3. End Customer (Store Visitors)
- Access: Embedded chat widget on brand's website
- Capabilities:
  - Chat with AI assistant
  - Get product recommendations
  - Ask questions about the store

## Features

### 1. Store Data Extraction

**Purpose**: Extract comprehensive data from e-commerce stores

**Supported Platforms**:
- Shopify (fully implemented)
- WooCommerce (adapter ready)
- BigCommerce (adapter ready)
- Magento (adapter ready)

**Extracted Data** (270+ fields):
- Products (title, description, price, variants, images, inventory)
- Collections/Categories
- Store pages (About, Terms, Privacy, Shipping, Returns)
- Store policies
- Reviews (schema ready)

**API Endpoints**:
```
POST   /api/stores/extract              - Initiate extraction
GET    /api/stores                      - List user stores
GET    /api/stores/:storeId             - Get store details
GET    /api/stores/:storeId/products    - Get extracted products
GET    /api/stores/:storeId/collections - Get collections
GET    /api/stores/:storeId/pages       - Get pages
DELETE /api/stores/:storeId             - Delete store
POST   /api/stores/:storeId/retry       - Retry extraction
```

### 2. Brand Console

**Purpose**: Dashboard for store owners to manage their AI widget

**Features**:
- **Analytics Dashboard**
  - Unique visitors
  - Total conversations
  - Message usage tracking
  - Event counts by type
  - Daily session trends

- **Widget Configuration**
  - Customize colors
  - Set widget position
  - Configure greeting message
  - Enable/disable features

- **API Key Management**
  - Generate API keys for widget
  - View key usage
  - Revoke keys

- **Billing & Subscriptions**
  - View current plan
  - Upgrade/downgrade
  - View invoices
  - Track message usage

**API Endpoints**:
```
GET    /api/brand/:storeId/widget/config      - Get widget config
PUT    /api/brand/:storeId/widget/config      - Update widget config
GET    /api/brand/:storeId/api-keys           - List API keys
POST   /api/brand/:storeId/api-keys           - Generate API key
GET    /api/brand/:storeId/analytics          - Get analytics
GET    /api/brand/:storeId/embed-code         - Get embed code
GET    /api/brand/:storeId/subscription       - Get subscription
PUT    /api/brand/:storeId/subscription       - Update subscription
GET    /api/brand/:storeId/invoices           - List invoices
GET    /api/brand/:storeId/conversations      - List conversations
```

### 3. Embeddable Chat Widget

**Purpose**: AI-powered chat assistant for store customers

**Features**:
- **AI-Powered Responses**
  - Uses Claude 3 Haiku model
  - Context-aware (knows store products, policies)
  - Product recommendations
  - Store policy information

- **Customizable Appearance**
  - Primary color
  - Position (bottom-right, bottom-left, top-right, top-left)
  - Greeting message
  - Placeholder text

- **Analytics Tracking**
  - Widget opens
  - Messages sent
  - Session tracking
  - Visitor tracking

- **Smart Features**
  - Session persistence
  - Conversation history
  - Typing indicators
  - Mobile responsive

**Integration**:
```html
<!-- Add to your website before </body> -->
<script>
  window.flashAIConfig = {
    apiKey: 'sk_xxxxxxxxxxxx',
    storeId: 'store-uuid-here'
  };
  var script = document.createElement('script');
  script.src = 'https://widget.flashai.com/widget.js';
  script.async = true;
  document.head.appendChild(script);
</script>
```

**API Endpoints** (Public, API key authenticated):
```
GET    /api/widget/config  - Get widget configuration
POST   /api/widget/chat    - Send chat message
POST   /api/widget/track   - Track analytics event
```

## Subscription Plans

### Starter - $29/month
- 1,000 messages/month
- AI chat widget
- Basic analytics
- Email support

### Professional - $99/month
- 5,000 messages/month
- Advanced customization
- Priority support
- Custom branding
- Order tracking integration

### Enterprise - $299/month
- 20,000 messages/month
- White-label solution
- Dedicated support
- API access
- Custom integrations
- SLA guarantee

## Database Schema

### Brand Console Tables

**widget_configs** - Widget customization settings
- Colors, position, messages
- Feature toggles
- Custom branding

**widget_api_keys** - API keys for widget authentication
- Key name, API key, secret
- Permissions, expiration
- Last used tracking

**subscriptions** - Billing and plan management
- Plan details, status
- Message limits and usage
- Stripe integration

**invoices** - Billing history
- Invoice details, status
- PDF URLs, payment dates

**widget_conversations** - Customer chat sessions
- Session ID, visitor ID
- Status tracking

**widget_messages** - Chat messages
- User/assistant messages
- Token usage tracking

**widget_analytics** - Event tracking
- Event types, session info
- Page URLs, device types

## Getting Started

### For Platform Admins

1. **Import a Store**:
   ```
   Navigate to /stores → Import New Store
   Enter store URL → Import
   ```

2. **View Extracted Data**:
   ```
   /stores/:storeId → View products, collections, pages
   ```

3. **Access Brand Console**:
   ```
   /brand/:storeId → Brand dashboard
   ```

### For Brand Store Owners

1. **Access Your Console**:
   ```
   Login → Navigate to /brand/:storeId
   ```

2. **Generate API Key**:
   ```
   Widget Setup tab → Generate API Key
   Save the API key and secret (shown only once!)
   ```

3. **Get Embed Code**:
   ```
   Widget Setup tab → Generate Embed Code
   Copy and paste into your website's HTML
   ```

4. **Customize Widget**:
   ```
   Widget Setup tab → Customize appearance
   Change colors, position, messages
   ```

5. **View Analytics**:
   ```
   Analytics tab → View visitor stats, conversations
   ```

6. **Manage Billing**:
   ```
   Billing tab → View plan, upgrade, view invoices
   ```

## Technical Stack

### Backend
- **Framework**: Node.js 20+ with TypeScript, Express 5
- **Database**: PostgreSQL 14 with migrations
- **Cache/Queue**: Redis with Bull
- **AI**: Anthropic Claude 3 Haiku
- **APIs**: Shopify API, REST APIs

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS v4
- **State**: Zustand
- **HTTP**: Axios

### Widget
- **Type**: Vanilla JavaScript (no dependencies)
- **Size**: ~15KB minified
- **Browser Support**: All modern browsers
- **Mobile**: Fully responsive

## API Authentication

### Platform APIs
- **Type**: JWT Bearer Token
- **Header**: `Authorization: Bearer <token>`
- **Endpoints**: All `/api/stores`, `/api/brand` endpoints

### Widget APIs
- **Type**: API Key
- **Header**: `X-API-Key: <api-key>`
- **Endpoints**: All `/api/widget` endpoints

## Security Features

- JWT authentication with refresh tokens
- API key authentication for widgets
- Rate limiting on all endpoints
- Message usage limits per subscription
- Store ownership verification
- SQL injection prevention (parameterized queries)
- XSS prevention (content escaping)
- CORS configuration
- Helmet security headers

## Development

### Running Locally

1. **Start PostgreSQL**:
   ```bash
   # Database should be running
   ```

2. **Start Redis**:
   ```bash
   brew services start redis
   ```

3. **Start Backend**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

4. **Start Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **Test Widget**:
   ```bash
   cd widget
   # Open test.html in browser
   # Update apiKey and storeId in test.html
   ```

### Testing the Complete Flow

1. **Import a Store** (as Platform Admin):
   - Go to http://localhost:5173/stores
   - Click "Import New Store"
   - Enter store URL
   - Wait for extraction to complete

2. **Access Brand Console** (as Brand Owner):
   - Go to http://localhost:5173/brand/:storeId
   - Click "Generate API Key" in Widget Setup
   - Save the API key

3. **Test Widget**:
   - Open widget/test.html
   - Update apiKey and storeId
   - Open in browser
   - Click chat button
   - Send a message

## Production Deployment

### Backend
1. Set environment variables
2. Run migrations
3. Start Redis
4. Deploy to hosting (Heroku, AWS, etc.)

### Frontend
1. Update API URLs in `.env`
2. Build: `npm run build`
3. Deploy to CDN (Vercel, Netlify, etc.)

### Widget
1. Host widget.js on CDN
2. Update API URL in widget.js
3. Provide embed code to customers

## Monitoring

### Key Metrics
- Message usage per store
- API response times
- Widget load times
- Conversation completion rates
- Subscription renewals

### Analytics Dashboards
- Platform metrics (internal)
- Brand console analytics (per store)
- Widget performance metrics

## Support

### For Platform Issues
- Internal ticketing system
- Direct database access
- Log monitoring

### For Brand Owners
- Email support (all plans)
- Priority support (Professional+)
- Dedicated support (Enterprise)

## Roadmap

### Phase 1 (Current)
- ✅ Store data extraction
- ✅ Brand console
- ✅ AI chat widget
- ✅ Basic analytics
- ✅ Subscription management

### Phase 2 (Next)
- Widget customization UI with live preview
- Advanced analytics with charts
- Email notifications
- Webhook integrations
- Multi-language support

### Phase 3 (Future)
- Voice chat support
- Video chat integration
- Advanced AI models (GPT-4, Claude Opus)
- Custom AI training per store
- Mobile SDK for native apps

## Conclusion

This B2B SaaS platform provides a complete solution for e-commerce stores to add AI-powered customer support. The three-tier architecture (Platform → Brand Console → Widget) ensures scalability and proper separation of concerns.

Store owners get a powerful dashboard to manage their widget, while their customers get seamless AI assistance directly on the storefront.
