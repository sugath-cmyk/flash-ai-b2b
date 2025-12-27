# Flash AI User Roles & Access Control

## Overview

Flash AI now has two distinct user roles with separate dashboards and access levels:

## 1. Platform Admin (Flash AI Team)

**Role**: `admin`

**Access**:
- Platform-level dashboard with all brand stores
- Can import new stores
- Can access any brand console (`/brand/:storeId`)
- View platform-wide analytics

**Login**: Use existing accounts (e.g., `test@flashai.com`)

**Dashboard Features**:
- View all imported stores
- Platform statistics (total brands, products, collections)
- Quick actions to import/manage stores
- Access to any brand's console

**Routes**:
- `/dashboard` - Platform admin overview
- `/stores` - Manage all brand stores
- `/stores/:id` - Store details
- `/brand/:id` - Access any brand console
- `/profile` - User profile

---

## 2. Brand Owner (Your Customers)

**Role**: `brand_owner`

**Access**:
- Automatically redirected to their own brand console
- Can ONLY manage their own store
- Cannot see other stores
- Cannot import new stores

**Test Login**:
- Email: `brand@supply.co`
- Password: `Password123`
- Store: Supply.co

**Dashboard Features**:
- Widget configuration
- Analytics for their store only
- API key management
- Subscription & billing
- Embed code generation

**Routes** (Restricted):
- `/dashboard` - Auto-redirects to `/brand/:theirStoreId`
- `/brand/:theirStoreId` - Their brand console ONLY
- `/profile` - User profile

**Blocked Routes**:
- `/stores` - Cannot access (admin only)
- `/brand/:otherStoreId` - Returns 404 (not their store)

---

## Security

### Store Ownership Verification

All brand-related API endpoints verify ownership:

```typescript
// Checks that user_id matches the store's user_id
const storeCheck = await pool.query(
  'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
  [storeId, userId]
);

if (storeCheck.rows.length === 0) {
  throw createError('Store not found', 404);
}
```

### Role-Based Access

- **Admin users**: Can access any store (for support/management)
- **Brand owners**: Can only access stores where `store_id = user.store_id`

---

## Creating Brand Owner Accounts

### Via Database (Admin Task):

```sql
-- 1. First, import/create the store
-- (via /stores page or API)

-- 2. Create brand owner account linked to that store
INSERT INTO users (email, password, first_name, last_name, role, store_id)
VALUES (
  'owner@brandstore.com',
  '$2b$10$...bcrypt_hash...',  -- Use bcrypt to hash password
  'Brand',
  'Owner',
  'brand_owner',
  'store-uuid-here'  -- Link to their store
);
```

### Via API (Future Enhancement):

Create an endpoint to invite brand owners and automatically:
1. Create their user account
2. Link to their store
3. Send welcome email with login credentials

---

## Testing the Separation

### 1. Test as Admin:
```
Login: test@flashai.com
Password: Password123

Expected:
- See platform admin dashboard
- View all stores
- Can access any brand console
```

### 2. Test as Brand Owner:
```
Login: brand@supply.co
Password: Password123

Expected:
- Auto-redirect to Supply.co brand console
- Only see Supply.co data
- Cannot access /stores
- Cannot access other brand consoles
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│     Flash AI Platform (Admin)           │
│  - Manage all brands                    │
│  - Import stores                        │
│  - Platform analytics                   │
│  - Access any brand console             │
└─────────────────────────────────────────┘
                   │
                   │ (Admin can access any)
                   │
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼────┐    ┌───▼────┐    ┌───▼────┐
│ Brand  │    │ Brand  │    │ Brand  │
│Store #1│    │Store #2│    │Store #3│
│Console │    │Console │    │Console │
└────────┘    └────────┘    └────────┘
    │              │              │
(Restricted)  (Restricted)  (Restricted)
    │              │              │
    └──────────────┴──────────────┘
              │
    ┌─────────▼──────────┐
    │  Brand Owner       │
    │  (Can only access  │
    │   their own store) │
    └────────────────────┘
```

---

## Next Steps

1. **Invite System**: Build brand owner invitation flow
2. **Self-Service**: Allow brands to self-register (with store verification)
3. **Role Management**: Admin UI to manage brand owner accounts
4. **Audit Logging**: Track which admin accessed which brand console
