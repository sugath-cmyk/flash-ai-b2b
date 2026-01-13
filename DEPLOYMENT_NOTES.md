# Deployment Notes - Widget Management Feature

## Date: 2026-01-13

## What's New

### 1. Unified Widget Management System
- **New Frontend Page**: `WidgetManagement.tsx` - Manage both Chatbot and VTO widgets from one place
- **New Backend Controller**: `widget-settings.controller.ts` - API for widget settings
- **New Database Table**: `widget_settings` - Centralized widget configuration

### 2. Features Added
- ✅ Enable/Disable Chatbot Widget
- ✅ Enable/Disable VTO (Virtual Try-On) Widget
- ✅ Configure widget appearance (colors, position, text)
- ✅ Global widget settings (border radius, shadow, animation)
- ✅ Toggle widgets independently via admin panel

### 3. API Endpoints Added
```
GET    /api/brand/:storeId/widget/settings    - Get widget settings
PUT    /api/brand/:storeId/widget/settings    - Update widget settings
POST   /api/brand/:storeId/widget/toggle      - Toggle widget on/off
```

### 4. Routes Added
```
/brand/:storeId/widgets               - Widget Management Page (NEW)
/brand/:storeId/widget-customization  - Advanced Chatbot Settings
/brand/:storeId/widget                - Redirects to Widget Management
```

## Database Migration Required

**Migration File**: `database/migrations/012_add_widget_settings.sql`

### To Run Migration:

**Option 1 - Automatic (Recommended for Render)**:
If you have auto-migrations enabled on Render, the migration will run on next deploy.

**Option 2 - Manual via psql**:
```bash
# Connect to production database
psql $DATABASE_URL

# Run migration
\i database/migrations/012_add_widget_settings.sql
```

**Option 3 - Via backend npm script**:
```bash
cd backend
npm run migrate
```

### What the Migration Does:
1. Creates `widget_settings` table
2. Migrates existing `vto_settings` data to `widget_settings`
3. Sets default values (chatbot enabled, VTO disabled)
4. Adds indexes for performance

## Files Changed

### Backend
- `backend/src/controllers/widget-settings.controller.ts` (NEW)
- `backend/src/routes/brand.routes.ts` (MODIFIED - added widget settings routes)
- `backend/src/index.ts` (MODIFIED - added VTO routes)

### Frontend
- `frontend/src/pages/WidgetManagement.tsx` (NEW)
- `frontend/src/App.tsx` (MODIFIED - added routes)

### Database
- `database/migrations/012_add_widget_settings.sql` (NEW)

### VTO Feature (Complete but separate)
- `database/migrations/011_add_vto_tables.sql`
- `backend/src/controllers/vto.controller.ts`
- `backend/src/services/vto.service.ts`
- `backend/src/routes/vto.routes.ts`
- `backend/src/types/vto.types.ts`
- `widget/vto-widget.js`, `vto-styles.css`, `vto-3d-renderer.js`
- `ml-inference/` (Python ML service - deploy separately)

## Deployment Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Add unified widget management for chatbot and VTO widgets"
git push origin main
```

### 2. Automatic Deployments
- **Vercel** (Frontend): Will auto-deploy from GitHub
- **Render** (Backend): Will auto-deploy from GitHub
  - Migration should run automatically if configured
  - Check Render logs after deployment

### 3. Verify Deployment
1. Check Render logs: https://dashboard.render.com
2. Test frontend: https://flash-ai-b2b.vercel.app
3. Test API: https://flash-ai-backend-rld7.onrender.com/health

### 4. Run Migration (if not automatic)
```bash
# SSH to Render or use psql locally
psql $DATABASE_URL -f database/migrations/012_add_widget_settings.sql
```

### 5. Test Widget Management
1. Login to brand dashboard: https://flash-ai-b2b.vercel.app/brand/{storeId}
2. Navigate to: https://flash-ai-b2b.vercel.app/brand/{storeId}/widgets
3. Toggle chatbot and VTO widgets
4. Save settings
5. Verify changes persist

## Post-Deployment Checklist

- [ ] Migration ran successfully (check `widget_settings` table exists)
- [ ] Widget Management page loads without errors
- [ ] Can toggle chatbot widget on/off
- [ ] Can toggle VTO widget on/off
- [ ] Settings save properly
- [ ] Existing chatbot customization still works
- [ ] API endpoints respond correctly

## Environment Variables (No Changes Required)

All existing environment variables are still valid. No new env vars needed for this feature.

## Rollback Plan

If issues occur:
```sql
-- Rollback migration
DROP TABLE IF EXISTS widget_settings;
```

Then revert to previous Git commit:
```bash
git revert HEAD
git push origin main
```

## Notes

- **Backward Compatible**: Existing chatbot settings are preserved
- **VTO Widget**: Disabled by default for all stores
- **ML Service**: VTO widget requires separate ML service deployment (not included in this release)
- **Testing**: Thoroughly tested in development environment

## Support

If deployment issues occur:
1. Check Render logs for backend errors
2. Check browser console for frontend errors
3. Verify database migration completed successfully
4. Contact: sugath@flashai.com

---

**Deployment Status**: Ready for Production ✅
**Breaking Changes**: None
**Database Changes**: Yes (migration required)
**API Changes**: Additive only (no breaking changes)
