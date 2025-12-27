# Flash AI Brand Onboarding System

## Overview

The brand onboarding system has been successfully implemented, creating a complete self-service flow for new brand owners to join the Flash AI platform.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Flash AI Platform                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │  Platform Admin  │         │   Brand Owner    │          │
│  │   (Flash AI)     │         │   (Customers)    │          │
│  └────────┬─────────┘         └────────┬─────────┘          │
│           │                            │                     │
│           ├─ View all requests         ├─ Self-service      │
│           ├─ Approve/Reject            ├─ Manage profile    │
│           ├─ Manage all brands         ├─ View analytics    │
│           └─ Create accounts           └─ Configure widget  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Features Implemented

### 1. Public Onboarding Landing Page
**URL:** http://localhost:5173/onboard

**Features:**
- Marketing content explaining problem/solution
- Problem statements:
  - Cart abandonment due to unanswered queries
  - Slow customer support response times
  - High cost of 24/7 human support
  - Repetitive customer questions

- Solution highlights:
  - Instant 24/7 AI-powered responses
  - Smart product recommendations
  - 5-minute setup
  - Cost-effective alternative

- Comprehensive onboarding form collecting:
  - Brand information (name, contact, email, phone)
  - Store details (URL, platform, monthly traffic)
  - Business information (address, city, state, PIN, GST)
  - Additional context (current support method, referral source)

### 2. Admin Management Panel
**URL:** http://localhost:5173/onboarding-requests

**Features:**
- View all onboarding requests
- Filter by status (All, Pending, Approved, Rejected)
- Detailed request view with full brand information
- Approve requests → Automatically creates:
  - Store record
  - Brand owner user account
  - Brand profile
  - Basic subscription
  - Generates temporary password
- Reject requests with optional reason
- Delete processed requests

### 3. Role-Based Access Control

**Admin Users:**
- Access: All platform features
- Can manage all brand stores
- Approve/reject onboarding requests
- View all analytics

**Brand Owner Users:**
- Access: Only their own brand console
- Manage their store profile
- Configure widget settings
- View their analytics
- Cannot access other brands

### 4. User Dashboards

**Admin Dashboard:**
- Platform overview statistics
- Total brands, products, collections
- Quick actions: Onboarding requests, Import store, View all stores
- Recent stores grid

**Brand Owner Dashboard:**
- Auto-redirects to brand console
- Self-service profile management
- Widget configuration
- Analytics dashboard

## Database Schema

### onboarding_requests
```sql
CREATE TABLE onboarding_requests (
    id UUID PRIMARY KEY,
    brand_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    store_url TEXT NOT NULL,
    store_platform VARCHAR(50),
    business_address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    zip_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'India',
    gst_number VARCHAR(50),
    monthly_traffic VARCHAR(50),
    current_support TEXT,
    hear_about_us VARCHAR(100),
    additional_info TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    admin_notes TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### brand_profiles
```sql
CREATE TABLE brand_profiles (
    id UUID PRIMARY KEY,
    store_id UUID REFERENCES stores(id),
    user_id UUID REFERENCES users(id),
    business_address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    zip_code VARCHAR(20),
    country VARCHAR(100),
    gst_number VARCHAR(50),
    monthly_traffic VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### users (updated)
```sql
ALTER TABLE users
  ADD COLUMN role VARCHAR(50) DEFAULT 'user'
    CHECK (role IN ('admin', 'brand_owner', 'user')),
  ADD COLUMN store_id UUID REFERENCES stores(id);
```

## API Endpoints

### Public Endpoints

**Submit Onboarding Request**
```
POST /api/onboarding/submit
Content-Type: application/json

{
  "brandName": "string",
  "contactName": "string",
  "email": "string",
  "phone": "string",
  "storeUrl": "string",
  "storePlatform": "string",
  "businessAddress": "string",
  "city": "string",
  "state": "string",
  "zipCode": "string",
  "country": "string",
  "gstNumber": "string",
  "monthlyTraffic": "string",
  "currentSupport": "string",
  "hearAboutUs": "string",
  "additionalInfo": "string"
}
```

### Admin Endpoints (Require Authentication)

**Get All Requests**
```
GET /api/onboarding/requests
Authorization: Bearer <token>
```

**Get Single Request**
```
GET /api/onboarding/requests/:id
Authorization: Bearer <token>
```

**Approve Request**
```
POST /api/onboarding/requests/:id/approve
Authorization: Bearer <token>
```

**Reject Request**
```
POST /api/onboarding/requests/:id/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "string"
}
```

**Delete Request**
```
DELETE /api/onboarding/requests/:id
Authorization: Bearer <token>
```

## Approval Flow

When an admin approves an onboarding request, the system automatically:

1. Creates a store record with the provided URL and platform
2. Generates a temporary password
3. Creates a brand owner user account with:
   - Email from the onboarding request
   - Hashed temporary password
   - Role: `brand_owner`
   - Linked to the created store
4. Creates a brand profile with business details
5. Updates the onboarding request status to 'approved'
6. Returns the login credentials to display to the admin

All operations are wrapped in a database transaction to ensure data consistency.

## Frontend Routes

### Public Routes
- `/onboard` - Brand onboarding landing page and form

### Protected Routes (Authenticated Users)
- `/dashboard` - Role-based dashboard router
  - Admins → AdminDashboard
  - Brand Owners → BrandOwnerDashboard (redirects to brand console)
- `/onboarding-requests` - Admin panel to manage requests (admin only)
- `/brand/:storeId` - Brand console for managing widget
- `/stores` - Store management (admin only)
- `/profile` - User profile

## Testing

### Current Status
✅ Public onboarding form API working
✅ Database tables created and storing data
✅ Authentication middleware protecting admin endpoints
✅ User role system configured (4 admins, 1 brand owner)
✅ 3 pending onboarding requests in database

### Test Flow

1. **Submit Onboarding Request:**
   ```bash
   curl -X POST http://localhost:3000/api/onboarding/submit \
     -H "Content-Type: application/json" \
     -d '{
       "brandName": "Test Store",
       "contactName": "John Doe",
       "email": "test@example.com",
       ...
     }'
   ```

2. **Login as Admin:**
   - Visit http://localhost:5173/login
   - Use admin credentials
   - Navigate to /onboarding-requests

3. **Approve Request:**
   - Click on a pending request
   - Click "Approve & Create Brand Account"
   - Copy the temporary credentials shown
   - Share with brand owner

4. **Brand Owner Login:**
   - Visit http://localhost:5173/login
   - Use provided credentials
   - Auto-redirected to brand console

## Current Data

### Pending Onboarding Requests
1. **Tech Gadgets Store** - mike@techgadgets.com
2. **Elegant Boutique** - sarah@elegantboutique.com
3. **Test Fashion Store** - john@testfashion.com

### User Accounts
- 4 Admin accounts
- 1 Brand Owner account (brand@supply.co)

## Security Features

1. **Authentication Required:** Admin endpoints require valid JWT tokens
2. **Role-Based Authorization:** Only admins can approve/reject requests
3. **Store Ownership:** Brand owners can only access their own store
4. **Password Hashing:** All passwords stored as bcrypt hashes
5. **Transaction Safety:** Multi-step operations use database transactions
6. **Duplicate Prevention:** Checks for existing applications by email

## Files Modified/Created

### Backend
- `database/migrations/007_onboarding_system.sql` - Database schema
- `src/services/onboarding.service.ts` - Business logic
- `src/controllers/onboarding.controller.ts` - HTTP handlers
- `src/routes/onboarding.routes.ts` - API routes
- `src/index.ts` - Mounted onboarding routes

### Frontend
- `src/pages/BrandOnboarding.tsx` - Public landing page and form
- `src/pages/OnboardingRequests.tsx` - Admin management panel
- `src/pages/AdminDashboard.tsx` - Platform admin dashboard
- `src/pages/BrandOwnerDashboard.tsx` - Brand owner landing
- `src/pages/Dashboard.tsx` - Role-based router
- `src/App.tsx` - Added new routes

### Documentation
- `docs/USER_ROLES.md` - User role system guide
- `ONBOARDING_SYSTEM.md` - This file

## Next Steps

To fully test the system:

1. Open http://localhost:5173/onboard in a browser
2. Fill out and submit the onboarding form
3. Login as admin at http://localhost:5173/login
4. Navigate to http://localhost:5173/onboarding-requests
5. View request details and click "Approve & Create Brand Account"
6. Note the temporary credentials displayed
7. Logout and login with the brand owner credentials
8. Verify redirect to brand console at /brand/:storeId

## Success Metrics

The onboarding system successfully implements:

✅ Self-service brand application process
✅ Admin approval workflow
✅ Automated account creation
✅ Role-based access control
✅ Secure authentication
✅ Complete separation between admin and brand owner interfaces
✅ Transaction-safe database operations
✅ User-friendly interfaces for both admins and brand owners
