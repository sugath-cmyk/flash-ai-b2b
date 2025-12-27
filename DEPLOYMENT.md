# Flash AI B2B - Production Deployment Guide

This guide will walk you through deploying Flash AI to production using **Railway** (backend + PostgreSQL) and **Vercel** (frontend).

## Prerequisites

- GitHub account
- Railway account (sign up at https://railway.app)
- Vercel account (sign up at https://vercel.com)
- Shopify Partner account (for creating production Shopify app)
- Anthropic API key (for Claude AI)

## Part 1: Deploy Backend to Railway

### Step 1: Create Railway Account and Project

1. Go to https://railway.app and sign up/login with GitHub
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account and select this repository
5. Railway will auto-detect the Node.js application

### Step 2: Add PostgreSQL Database

1. In your Railway project, click "New" → "Database" → "Add PostgreSQL"
2. Railway will automatically provision a PostgreSQL database
3. The `DATABASE_URL` environment variable will be automatically set
4. **Important**: Copy the database connection details for later

### Step 3: Configure Environment Variables

In Railway, go to your backend service → Variables tab and add:

```env
# Server Configuration
NODE_ENV=production
FRONTEND_URL=https://your-app.vercel.app  # Update after deploying frontend

# Database (automatically set by Railway)
# DATABASE_URL=postgresql://... (already set)

# JWT Authentication (generate new secrets for production!)
JWT_SECRET=your-production-secret-change-this
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-production-refresh-secret
JWT_REFRESH_EXPIRES_IN=30d

# AI APIs
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# Shopify OAuth (will configure in Part 3)
SHOPIFY_CLIENT_ID=your-production-shopify-client-id
SHOPIFY_CLIENT_SECRET=your-production-shopify-client-secret
SHOPIFY_REDIRECT_URI=https://your-backend.railway.app/api/shopify/callback

# Session
SESSION_SECRET=your-production-session-secret

# Optional: Add other variables as needed
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@flashai.com
```

### Step 4: Deploy Backend

1. Railway will automatically start building and deploying
2. Monitor the deployment in the "Deployments" tab
3. Once deployed, click "Settings" → "Networking" → "Generate Domain"
4. **Copy your backend URL**: `https://your-backend.railway.app`

### Step 5: Run Database Migrations

1. In Railway, go to your backend service
2. Click "Settings" → "Deploy Triggers"
3. Or manually run migrations by connecting to the PostgreSQL database:
   ```bash
   # Connect to Railway PostgreSQL
   psql postgresql://user:pass@host:port/database

   # Run the migration SQL files from backend/src/database/schema.sql
   ```

**Alternative**: You can create a migration script to run automatically on deployment.

## Part 2: Deploy Frontend to Vercel

### Step 1: Create Vercel Account and Import Project

1. Go to https://vercel.com and sign up/login with GitHub
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Vercel will auto-detect it's a Vite project

### Step 2: Configure Build Settings

Vercel should auto-detect these settings, but verify:
- **Framework Preset**: Vite
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### Step 3: Configure Environment Variables

In Vercel → Settings → Environment Variables, add:

```env
VITE_API_URL=https://your-backend.railway.app/api
```

**Replace** `your-backend.railway.app` with your actual Railway backend URL from Part 1.

### Step 4: Deploy Frontend

1. Click "Deploy"
2. Vercel will build and deploy your frontend
3. Once deployed, you'll get a production URL: `https://your-app.vercel.app`
4. **Copy this URL**

### Step 5: Update Backend CORS Settings

1. Go back to Railway
2. Update the `FRONTEND_URL` environment variable with your Vercel URL:
   ```env
   FRONTEND_URL=https://your-app.vercel.app
   ```
3. Railway will automatically redeploy with the new settings

## Part 3: Create Production Shopify App

### Step 1: Create Shopify Partner Account

1. Go to https://partners.shopify.com
2. Sign up for a Shopify Partner account (free)
3. Navigate to "Apps" → "Create app"

### Step 2: Configure Shopify App

1. **App name**: Flash AI Widget
2. **App URL**: `https://your-backend.railway.app`
3. **Allowed redirection URL(s)**:
   ```
   https://your-backend.railway.app/api/shopify/callback
   https://your-app.vercel.app/brand/*
   ```

### Step 3: Set API Scopes

Add these OAuth scopes:
- `read_products` - Read product data
- `read_product_listings` - Read product listings
- `read_collections` - Read collections
- `read_content` - Read store pages
- `read_themes` - Read theme information
- `read_shipping` - Read shipping information

### Step 4: Get App Credentials

1. After creating the app, copy the **Client ID** and **Client Secret**
2. Update Railway environment variables:
   ```env
   SHOPIFY_CLIENT_ID=your-production-client-id
   SHOPIFY_CLIENT_SECRET=your-production-client-secret
   SHOPIFY_REDIRECT_URI=https://your-backend.railway.app/api/shopify/callback
   ```

## Part 4: Test Production Deployment

### Test 1: Backend Health Check

```bash
curl https://your-backend.railway.app/health
```

Expected response:
```json
{"status":"ok","timestamp":"2025-01-..."}
```

### Test 2: Brand Registration Flow

1. Go to `https://your-app.vercel.app/brand-onboarding`
2. Fill out the registration form
3. Submit the application

### Test 3: Admin Approval

1. Login to admin account at `https://your-app.vercel.app/login`
2. Go to dashboard - you should see the pending registration
3. Approve the registration

### Test 4: Shopify Connection

1. Login as the approved brand owner
2. Navigate to "Connect Store"
3. Enter Shopify store domain
4. Complete OAuth flow
5. Verify store data is imported

### Test 5: Widget Functionality

1. Get the widget embed code from brand dashboard
2. Test the widget on a sample HTML page
3. Verify chat functionality works

## Part 5: Post-Deployment Configuration

### Security Checklist

- [ ] Change all default secrets (JWT_SECRET, SESSION_SECRET, etc.)
- [ ] Enable HTTPS only (both services should use HTTPS)
- [ ] Configure rate limiting properly
- [ ] Review CORS settings
- [ ] Set up monitoring and logging
- [ ] Configure database backups (Railway has automatic backups)

### Optional Enhancements

1. **Custom Domain**:
   - In Vercel: Settings → Domains → Add custom domain
   - In Railway: Settings → Networking → Custom domain

2. **Environment-specific Configs**:
   - Create separate Railway projects for staging and production
   - Use Vercel preview deployments for testing

3. **Monitoring**:
   - Set up error tracking (e.g., Sentry)
   - Monitor Railway logs and metrics
   - Set up uptime monitoring

4. **Email Service**:
   - Configure SMTP credentials for transactional emails
   - Consider using SendGrid or similar service

## Troubleshooting

### Backend won't start
- Check Railway logs for errors
- Verify all required environment variables are set
- Ensure DATABASE_URL is properly configured

### Frontend can't connect to backend
- Verify VITE_API_URL is correct in Vercel
- Check CORS settings in backend
- Ensure FRONTEND_URL in Railway matches Vercel URL

### Database connection errors
- Railway PostgreSQL might need SSL enabled
- Check that database migrations ran successfully
- Verify DATABASE_URL format

### Shopify OAuth fails
- Verify callback URL matches exactly (including /api/shopify/callback)
- Check that app is installed in Shopify Partner dashboard
- Ensure scopes are properly configured

## Support

- **Railway Docs**: https://docs.railway.app
- **Vercel Docs**: https://vercel.com/docs
- **Shopify Partners**: https://partners.shopify.com/current

## Summary of URLs to Update

After deployment, you'll need to update these URLs in various places:

1. **Backend Railway URL**: `https://your-backend.railway.app`
   - Add to Vercel env vars as `VITE_API_URL`
   - Add to Shopify app configuration

2. **Frontend Vercel URL**: `https://your-app.vercel.app`
   - Add to Railway env vars as `FRONTEND_URL`
   - Add to Shopify app redirect URLs

3. **Shopify Callback URL**: `https://your-backend.railway.app/api/shopify/callback`
   - Add to Railway as `SHOPIFY_REDIRECT_URI`
   - Add to Shopify app configuration

## Next Steps

After successful deployment:

1. Test all features thoroughly in production
2. Set up monitoring and alerting
3. Configure automatic backups
4. Document any production-specific procedures
5. Create runbook for common operations
