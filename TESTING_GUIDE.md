# Flash AI B2B SaaS - Complete Testing Guide ✅

## Overview

This guide covers the complete setup including:
1. ✅ OTP Verification System (Email + Phone)
2. ✅ Admin Panel with Store Management
3. ✅ Brand Owner Dashboard
4. ✅ Frontend Storefront for Chatbot Testing
5. ✅ Dummy Store with 20 Products

---

## Login Credentials

### Admin Account
- **Email**: testadmin@flashai.com
- **Password**: TestAdmin@123
- **Access**: Full system administration
- **URL**: http://localhost:5173/login

### Brand Owner Account
- **Email**: bodyshop@example.com
- **Password**: BodyShop@123
- **Store**: The Body Shop (20 products)
- **URL**: http://localhost:5173/login

---

## Testing Routes & Features

### 1. Admin Panel Testing

**Access URLs:**
- http://localhost:5173/admin
- http://localhost:5173/admin-dashboard

**Login:** testadmin@flashai.com / TestAdmin@123

**What to Test:**

✅ **Dashboard Overview**
- Total stores count (should show 5)
- Total products across all stores
- Recent activity

✅ **Store Management**
- View all stores (5 stores visible)
- The Body Shop with 20 products
- Other test stores
- Store owner information displayed

✅ **Onboarding Requests**
- URL: http://localhost:5173/onboarding-requests
- View all pending/approved/rejected requests
- Approve/reject new requests
- See verification status (email + phone)

✅ **Features:**
- View store details
- See product counts per store
- Monitor sync status
- Access owner information

---

### 2. Brand Owner Dashboard Testing

**Access URL:**
- http://localhost:5173/brand-console

**Login:** bodyshop@example.com / BodyShop@123

**What to Test:**

✅ **Store Overview**
- Store name: The Body Shop
- Store URL: https://thebodyshop.example.com
- Platform: Shopify
- Status: Active

✅ **Product Catalog**
- 20 products displayed
- Face care products (10 items)
- Hair care products (10 items)
- Product details: name, SKU, price, inventory

✅ **Widget Configuration**
- Access widget settings
- Generate API keys
- View embed code
- Configure chat appearance

✅ **Analytics** (if available)
- Conversation metrics
- Customer insights
- Product recommendations tracking

---

### 3. Public Storefront (Chatbot Testing)

**Access URLs:**
- http://localhost:5173/store
- http://localhost:5173/shop

**No login required - Public access**

**What to Test:**

✅ **Store Layout**
- Header with brand logo and name
- Product grid with 20 items
- Category navigation
- Search functionality
- Shopping cart

✅ **Product Display**
- Product cards with image placeholder
- Title, description, vendor
- Price and compare-at price
- Tags and categories
- Quick view modal

✅ **E-commerce Features**
- Category filtering
- Product sorting
- Add to cart button
- Product quick view
- Responsive design

✅ **Chatbot Widget (Placeholder)**
- Floating chat button (bottom right)
- Green circular button with chat icon
- Ready for widget integration

---

### 4. Brand Onboarding Flow

**Access URL:**
- http://localhost:5173/onboard

**What to Test:**

✅ **OTP Verification**
1. Fill in brand details
2. Enter email → Send Email OTP
3. Check backend console for OTP code
4. Verify email with 6-digit code
5. Enter phone → Send Phone OTP
6. Check backend console for OTP code
7. Verify phone with 6-digit code

✅ **Admin Credentials**
- Set admin username (min 3 characters)
- Set admin password (min 8 characters)
- Password hashed with bcrypt

✅ **Form Validation**
- Cannot submit without email verification
- Cannot submit without phone verification
- Shows error if verification missing

✅ **Approval Process**
- Admin receives request in /onboarding-requests
- Admin can approve/reject
- On approval, brand owner account created
- Brand owner can login immediately

---

## Product Catalog Details

### The Body Shop Store
**Store ID**: `7caf971a-d60a-4741-b1e3-1def8e738e45`
**Products**: 20 items across 2 categories

### Face Care Products (10 items)

1. **Vitamin C Glow Boosting Moisturiser** - $26.95
   - Vendor: The Body Shop
   - SKU: TBS-VCM-50ML
   - Inventory: 50 units

2. **Tea Tree Daily Solution Serum** - $20.95
   - Vendor: The Body Shop
   - SKU: TBS-TTS-50ML
   - Inventory: 100 units

3. **Minimalist 10% Niacinamide Serum** - $5.99
   - Vendor: Minimalist
   - SKU: MIN-NIA10-30ML
   - Inventory: 200 units

4. **Minimalist 2% Salicylic Acid Serum** - $5.99
   - Vendor: Minimalist
   - SKU: MIN-SA2-30ML
   - Inventory: 180 units

5. **Plum 15% Vitamin C Serum** - $7.90
   - Vendor: Plum
   - SKU: PLUM-VC15-30ML
   - Inventory: 150 units

6. **Plum 10% Niacinamide Serum** - $6.59
   - Vendor: Plum
   - SKU: PLUM-NIA10-30ML
   - Inventory: 140 units

7. **Dot & Key 10% Vitamin C Serum** - $5.99
   - Vendor: Dot & Key
   - SKU: DK-VC10-20ML
   - Inventory: 130 units

8. **Dot & Key Cica Niacinamide Serum** - $6.45
   - Vendor: Dot & Key
   - SKU: DK-CN-30ML
   - Inventory: 120 units

9. **The Derma Co 10% Vitamin C Serum** - $6.49
   - Vendor: The Derma Co
   - SKU: TDC-VC10-30ML
   - Inventory: 160 units

10. **The Derma Co 10% Niacinamide Serum** - $5.99
    - Vendor: The Derma Co
    - SKU: TDC-NIA10-30ML
    - Inventory: 190 units

### Hair Care Products (10 items)

11. **Ginger Anti-Dandruff Shampoo** - $11.95
    - Vendor: The Body Shop
    - Inventory: 100 units

12. **Ginger Scalp Care Conditioner** - $12.95
    - Vendor: The Body Shop
    - Inventory: 90 units

13. **Banana Nourishing Shampoo** - $10.95
    - Vendor: The Body Shop
    - Inventory: 110 units

14. **Banana Nourishing Conditioner** - $11.95
    - Vendor: The Body Shop
    - Inventory: 95 units

15. **Minimalist Hair Growth Actives 18%** - $6.99
    - Vendor: Minimalist
    - Inventory: 150 units

16. **Minimalist 2% Ketoconazole Scalp Serum** - $5.49
    - Vendor: Minimalist
    - Inventory: 130 units

17. **Plum Coconut Milk Shampoo** - $3.79
    - Vendor: Plum
    - Inventory: 180 units

18. **Dot & Key Hair Growth Oil** - $6.49
    - Vendor: Dot & Key
    - Inventory: 110 units

19. **The Derma Co Hair Growth Serum** - $6.49
    - Vendor: The Derma Co
    - Inventory: 140 units

20. **The Derma Co Biotin Hair Mask** - $5.99
    - Vendor: The Derma Co
    - Inventory: 100 units

---

## API Endpoints Reference

### Admin Endpoints
```bash
# Requires admin authentication
GET    /api/stores                           # List all stores (admin sees all)
GET    /api/stores/:id                       # Get store details
GET    /api/onboarding/requests              # List onboarding requests
POST   /api/onboarding/requests/:id/approve  # Approve request
POST   /api/onboarding/requests/:id/reject   # Reject request
```

### Brand Owner Endpoints
```bash
# Requires brand owner authentication
GET    /api/brand/:storeId                   # Get store details
GET    /api/brand/:storeId/products          # List products
GET    /api/brand/:storeId/widget/config     # Widget configuration
POST   /api/brand/:storeId/api-keys          # Generate API key
GET    /api/brand/:storeId/analytics         # View analytics
```

### OTP Endpoints
```bash
# Public endpoints for onboarding
POST   /api/otp/send-email                   # Send email OTP
POST   /api/otp/send-phone                   # Send phone OTP
POST   /api/otp/verify-email                 # Verify email OTP
POST   /api/otp/verify-phone                 # Verify phone OTP
```

### Widget Public API
```bash
# Requires API key (generated by brand owner)
GET    /api/widget/config                    # Get widget config
POST   /api/widget/chat                      # Send chat message
POST   /api/widget/track                     # Track events
```

---

## Test Scenarios

### Scenario 1: New Brand Onboarding
1. Go to http://localhost:5173/onboard
2. Fill in brand information
3. Enter email and click "Send Email OTP"
4. Check backend console for OTP: `📧 EMAIL OTP for {email} : XXXXXX`
5. Enter OTP and verify email
6. Enter phone and click "Send Phone OTP"
7. Check backend console for OTP: `📱 SMS OTP for {phone} : XXXXXX`
8. Enter OTP and verify phone
9. Set admin username and password
10. Complete form and submit
11. Login as admin to approve the request
12. New brand owner can login with their credentials

### Scenario 2: Admin Store Management
1. Login as admin (testadmin@flashai.com)
2. Go to /admin or /admin-dashboard
3. View all 5 stores in the system
4. See The Body Shop with 20 products
5. Click on any store to view details
6. Check owner information
7. Monitor sync status

### Scenario 3: Brand Owner Product Management
1. Login as brand owner (bodyshop@example.com)
2. Go to /brand-console
3. View store dashboard
4. See 20 products in catalog
5. Generate API key for widget
6. View widget configuration
7. Check analytics (if available)

### Scenario 4: Customer Shopping Experience
1. Go to http://localhost:5173/store (no login required)
2. Browse 20 products
3. Filter by category (Face Care / Hair Care)
4. Click product for quick view
5. See product details, tags, pricing
6. Add to cart (UI only)
7. See chatbot button (bottom right)

---

## Database Verification

### Check Store
```sql
SELECT
  s.id,
  s.store_name,
  s.domain,
  u.email as owner_email,
  COUNT(p.id) as product_count
FROM stores s
LEFT JOIN users u ON s.user_id = u.id
LEFT JOIN extracted_products p ON p.store_id = s.id
WHERE s.id = '7caf971a-d60a-4741-b1e3-1def8e738e45'
GROUP BY s.id, s.store_name, s.domain, u.email;
```

### Check Products by Category
```sql
SELECT
  vendor,
  product_type,
  COUNT(*) as product_count,
  AVG(price) as avg_price
FROM extracted_products
WHERE store_id = '7caf971a-d60a-4741-b1e3-1def8e738e45'
GROUP BY vendor, product_type
ORDER BY vendor, product_type;
```

### Check Onboarding Requests
```sql
SELECT
  brand_name,
  email,
  status,
  email_verified,
  phone_verified,
  approved_at
FROM onboarding_requests
ORDER BY created_at DESC
LIMIT 10;
```

---

## Features Implemented

### ✅ OTP Verification System
- Email OTP with 10-minute expiration
- Phone OTP with 10-minute expiration
- Development mode logs OTPs to console
- Production-ready with nodemailer
- SMS integration architecture (Twilio-ready)
- Secure storage with verification tracking

### ✅ Admin Panel
- View all stores across the platform
- Store owner information
- Product counts and statistics
- Onboarding request management
- Approve/reject workflows
- Role-based access control

### ✅ Brand Owner Dashboard
- Store-specific access
- Product catalog management
- Widget configuration
- API key generation
- Analytics dashboard
- Secure authentication

### ✅ Public Storefront
- No authentication required
- 20 products displayed
- E-commerce UI/UX
- Product categories
- Search and filters
- Chatbot widget placeholder
- Responsive design

### ✅ Security Features
- Bcrypt password hashing (10 rounds)
- JWT authentication
- OTP expiration
- One-time use OTPs
- Role-based access control
- API key authentication for widgets

---

## Next Steps for Production

### 1. Email Configuration
Add to `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@askflash.ai
```

### 2. SMS Integration (Twilio)
```bash
npm install twilio
```

Add to `.env`:
```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### 3. Widget Integration
1. Generate API key from brand dashboard
2. Embed widget script in storefront
3. Configure widget appearance
4. Test AI chat functionality
5. Monitor analytics

### 4. AI Chat Testing
Once widget is integrated, test with:
- "What products do you have for oily skin?"
- "Show me vitamin C serums under $10"
- "Which shampoo is good for dry damaged hair?"
- "Tell me about the Minimalist Niacinamide serum"
- "Can I use retinol during pregnancy?"

---

## Quick Access Links

- **Login**: http://localhost:5173/login
- **Onboarding**: http://localhost:5173/onboard
- **Admin Dashboard**: http://localhost:5173/admin
- **Brand Console**: http://localhost:5173/brand-console
- **Storefront**: http://localhost:5173/store
- **Onboarding Requests**: http://localhost:5173/onboarding-requests

---

## Technical Stack

**Backend:**
- Node.js + TypeScript
- Express 5
- PostgreSQL
- Redis + Bull Queue
- Bcrypt for passwords
- Nodemailer for emails
- JWT authentication

**Frontend:**
- React 18 + TypeScript
- Vite
- TailwindCSS v4
- Zustand state management
- Axios

**Database:**
- PostgreSQL 14+
- Full-text search
- UUID primary keys
- Proper relations and indexes

---

## Support & Documentation

For additional documentation, see:
- `/DUMMY_STORE_SETUP.md` - Initial store setup details
- `/OTP_VERIFICATION_IMPLEMENTATION.md` - OTP implementation details
- Backend API docs: `/backend/src/routes/`
- Frontend components: `/frontend/src/pages/`

---

**Last Updated**: December 25, 2025
**Status**: ✅ Fully Functional & Ready for Testing
**Version**: 1.0.0
