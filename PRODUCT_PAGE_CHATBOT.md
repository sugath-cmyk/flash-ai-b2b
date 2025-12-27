# Product Page with Flash AI Chatbot

## Overview

Created a dedicated product page with an integrated AI chatbot that appears in the center when the page loads and opens on the right side for product-specific conversations.

---

## What's New

### 1. Product Detail Page
**Location**: `/frontend/src/pages/ProductPage.tsx`

**Features**:
- Full product details display (left side)
- Product image gallery with multiple views
- Price with compare-at-price and savings calculation
- Product description, SKU, inventory status
- Tags and vendor information
- Add to Cart button
- Back to Store navigation
- Responsive layout

### 2. Product-Specific Chat Widget
**Location**: `/frontend/src/components/ProductChatWidget.tsx`

**Features**:
- **Centered "ASK Flash AI" button** with animated lightning icon
- Message: "Ask me anything about this product"
- Opens on the **right side** of product page (not bottom)
- Context-aware: Knows which product you're viewing
- Quick question buttons for common queries:
  - "What are the key ingredients?"
  - "Is this suitable for sensitive skin?"
  - "How do I use this product?"
- Real-time typing indicators
- Conversation history
- Session persistence

---

## How It Works

### User Journey

1. **Browse Store** → Visit http://localhost:5173/store
2. **Click Product** → View any product from the grid
3. **See Flash AI Button** → Centered button appears with "ASK Flash AI"
4. **Click to Chat** → Chat panel opens on the right side
5. **Ask Questions** → Get instant AI responses about the product

### Example URLs

```
Store: http://localhost:5173/store

Product Pages:
- http://localhost:5173/product/2d130876-fa36-475c-9395-6501413664da (Vitamin C Moisturiser)
- http://localhost:5173/product/50f8b577-971c-4a33-9c04-20079c60c385 (Tea Tree Serum)
- http://localhost:5173/product/89c036ee-4996-4c77-922d-194338a2ed1e (Niacinamide Serum)
```

---

## Chat Widget Features

### 1. Centered Call-to-Action
When the product page loads, you see:
```
┌─────────────────────────────────────┐
│  ⚡  ASK Flash AI                   │
│     Ask me anything about this      │
│     product                         │
└─────────────────────────────────────┘
```

### 2. Right-Side Chat Panel
When opened, the chat appears on the right with:
- Product-specific welcome message
- Quick question buttons
- Real-time messaging
- Product context included in all queries

### 3. Product Context
Every message sent to the AI includes:
```javascript
{
  productId: product.id,
  context: {
    productTitle: "Vitamin C Glow Boosting Moisturiser",
    productDescription: "Daily glow-boosting moisturiser...",
    price: "26.95",
    vendor: "The Body Shop"
  }
}
```

---

## Technical Implementation

### 1. Routes Added
```typescript
// App.tsx
<Route path="/product/:productId" element={<ProductPage />} />
```

### 2. Product API Integration
```typescript
// Fetches product details from:
GET /api/brand/{storeId}/products

// Filters by productId on frontend
const product = products.find(p => p.id === productId);
```

### 3. Chat API Integration
```typescript
// Sends messages to:
POST /api/widget/chat

// Headers:
{
  'X-API-Key': 'sk_be0c27126807212efa23820f99563ac40b9b9aba2f4f8a02',
  'X-Store-ID': '7caf971a-d60a-4741-b1e3-1def8e738e45'
}

// Body includes product context:
{
  message: "User's question",
  productId: "uuid",
  context: { product details }
}
```

---

## Design Highlights

### Layout Structure
```
┌─────────────────────────────────────────────────────┐
│ Header: The Body Shop + Back Button                 │
├──────────────────────┬──────────────────────────────┤
│                      │                              │
│  Product Images      │   ⚡ ASK Flash AI            │
│  (3 thumbnails)      │   Ask me anything...         │
│                      │                              │
│  Product Details     │   (or Chat Panel when open)  │
│  - Price             │                              │
│  - Description       │                              │
│  - SKU/Inventory     │                              │
│  - Tags              │                              │
│  - Add to Cart       │                              │
│                      │                              │
└──────────────────────┴──────────────────────────────┘
```

### Color Scheme
- **Primary**: Emerald/Green gradient (from-emerald-500 to-green-600)
- **Lightning Icon**: Animated with pulsing effect
- **User Messages**: Gradient bubble (emerald to green)
- **Bot Messages**: White with gray border
- **Quick Buttons**: White with hover effects

---

## Example Conversation

```
🤖 Flash AI: Hi! I'm Flash AI, your shopping assistant. I can help
              you with questions about Vitamin C Glow Boosting
              Moisturiser. What would you like to know?

👤 User: What are the key ingredients?

🤖 Flash AI: This moisturiser contains Camu Camu berry and Vitamin C
              as key ingredients. It's made with 96% natural ingredients
              and provides 48-hour hydration for your skin.

👤 User: Is it suitable for sensitive skin?

🤖 Flash AI: [AI responds with information about skin compatibility]
```

---

## Testing Guide

### Test Product Page
1. Open http://localhost:5173/store
2. Click any product card
3. Verify you see product details on left
4. Verify "ASK Flash AI" button is centered on right

### Test Chat Widget
1. Click "ASK Flash AI" button
2. Verify chat panel opens on right side
3. Try quick question buttons
4. Type your own question and send
5. Verify bot responds
6. Close chat and verify button returns

### Test Navigation
1. Click "Back to Store" button
2. Verify returns to store page
3. Click different product
4. Verify chat resets for new product

---

## Files Modified/Created

### New Files
1. `/frontend/src/pages/ProductPage.tsx` - Product detail page
2. `/frontend/src/components/ProductChatWidget.tsx` - Right-side chat widget
3. `/PRODUCT_PAGE_CHATBOT.md` - This documentation

### Modified Files
1. `/frontend/src/App.tsx` - Added product route
2. `/frontend/src/pages/Storefront.tsx` - Added navigation to product pages
3. `/backend/src/controllers/brand.controller.ts` - Added public products endpoint
4. `/backend/src/routes/brand.routes.ts` - Added products route

---

## API Key Configuration

**Store ID**: `7caf971a-d60a-4741-b1e3-1def8e738e45`
**API Key**: `sk_be0c27126807212efa23820f99563ac40b9b9aba2f4f8a02`
**Status**: Active
**Permissions**: API + Widget enabled

---

## Product Data Available

**20 Products** across 2 categories:
- **Face Care** (10 products): Serums, moisturisers, treatments
- **Hair Care** (10 products): Shampoos, conditioners, treatments

Each product includes:
- Title, description, vendor
- Price and compare-at-price
- SKU and inventory count
- Tags for categorization
- Status (all active)

---

## Next Steps (Optional)

### Enhance Chat Responses
- Train AI with product-specific knowledge
- Add product recommendations
- Include reviews and ratings in responses

### Add Features
- Similar products suggestions
- Add to cart functionality
- Share product link
- Save favorite products
- Email product details

### Analytics
- Track chat interactions per product
- Monitor common questions
- Identify products needing better descriptions

---

## Quick Access Links

- **Storefront**: http://localhost:5173/store
- **Sample Product 1**: http://localhost:5173/product/2d130876-fa36-475c-9395-6501413664da
- **Sample Product 2**: http://localhost:5173/product/50f8b577-971c-4a33-9c04-20079c60c385
- **Sample Product 3**: http://localhost:5173/product/89c036ee-4996-4c77-922d-194338a2ed1e

---

**Last Updated**: December 25, 2025
**Status**: ✅ Fully Functional
**Version**: 1.0.0
