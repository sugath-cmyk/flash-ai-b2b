# E-Commerce Integration - Quick Start Guide

## Getting Started in 30 Minutes

This guide will help you implement the basic store extraction feature quickly.

## Step 1: Install Dependencies

```bash
cd backend
npm install --save \
  puppeteer \
  cheerio \
  bull \
  ioredis \
  shopify-api-node \
  @shopify/shopify-api \
  woocommerce-api \
  axios \
  image-size \
  sharp
```

## Step 2: Database Migration

Create migration file: `database/migrations/003_store_extraction.sql`

```sql
-- See full schema in ECOMMERCE_INTEGRATION_SOLUTION.md
-- Essential tables only for quick start

CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50),
    store_url TEXT NOT NULL,
    store_name VARCHAR(255),
    domain VARCHAR(255),
    access_token TEXT ENCRYPTED,
    api_key TEXT ENCRYPTED,
    api_secret TEXT ENCRYPTED,
    sync_status VARCHAR(50) DEFAULT 'pending',
    last_sync TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE extracted_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    title VARCHAR(500),
    description TEXT,
    price DECIMAL(10,2),
    currency VARCHAR(3),
    images JSONB,
    variants JSONB,
    inventory INTEGER,
    tags TEXT[],
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE extraction_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    total_items INTEGER,
    items_processed INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stores_user_id ON stores(user_id);
CREATE INDEX idx_products_store_id ON extracted_products(store_id);
CREATE INDEX idx_jobs_store_id ON extraction_jobs(store_id);
```

## Step 3: Core Services Structure

### Platform Detector Service

`src/services/platform-detector.service.ts`

```typescript
import axios from 'axios';
import { load } from 'cheerio';

export enum Platform {
  SHOPIFY = 'shopify',
  WOOCOMMERCE = 'woocommerce',
  BIGCOMMERCE = 'bigcommerce',
  MAGENTO = 'magento',
  CUSTOM = 'custom'
}

export class PlatformDetectorService {
  async detectPlatform(url: string): Promise<Platform> {
    try {
      // Normalize URL
      const normalizedUrl = this.normalizeUrl(url);

      // Method 1: Check for platform-specific headers
      const response = await axios.get(normalizedUrl, {
        timeout: 10000,
        validateStatus: () => true,
      });

      // Shopify detection
      if (
        response.headers['x-shopify-stage'] ||
        response.headers['x-shopid'] ||
        response.data.includes('cdn.shopify.com') ||
        response.data.includes('Shopify.theme')
      ) {
        return Platform.SHOPIFY;
      }

      // WooCommerce detection
      if (
        response.data.includes('woocommerce') ||
        response.data.includes('wp-content/plugins/woocommerce')
      ) {
        return Platform.WOOCOMMERCE;
      }

      // BigCommerce detection
      if (
        response.headers['x-bc-store-hash'] ||
        response.data.includes('bigcommerce.com')
      ) {
        return Platform.BIGCOMMERCE;
      }

      // Magento detection
      if (
        response.data.includes('Mage.') ||
        response.data.includes('magento')
      ) {
        return Platform.MAGENTO;
      }

      // Method 2: Check meta tags
      const $ = load(response.data);
      const generator = $('meta[name="generator"]').attr('content')?.toLowerCase();

      if (generator?.includes('shopify')) return Platform.SHOPIFY;
      if (generator?.includes('woocommerce')) return Platform.WOOCOMMERCE;
      if (generator?.includes('magento')) return Platform.MAGENTO;

      return Platform.CUSTOM;
    } catch (error) {
      throw new Error(`Failed to detect platform: ${error.message}`);
    }
  }

  private normalizeUrl(url: string): string {
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    return url.replace(/\/$/, '');
  }

  extractDomain(url: string): string {
    const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
    return match ? match[1] : url;
  }
}

export default new PlatformDetectorService();
```

### Shopify Adapter Service

`src/services/adapters/shopify-adapter.service.ts`

```typescript
import Shopify from 'shopify-api-node';
import { createError } from '../../middleware/errorHandler';

interface ShopifyCredentials {
  shopName: string;
  accessToken: string;
}

export class ShopifyAdapterService {
  private client: Shopify;

  constructor(credentials: ShopifyCredentials) {
    this.client = new Shopify({
      shopName: credentials.shopName,
      accessToken: credentials.accessToken,
    });
  }

  async fetchAllProducts() {
    const allProducts = [];
    let params = { limit: 250 };

    do {
      const products = await this.client.product.list(params);
      allProducts.push(...products);

      if (products.length < 250) break;

      // Get next page
      const lastProductId = products[products.length - 1].id;
      params = { ...params, since_id: lastProductId };
    } while (true);

    return this.normalizeProducts(allProducts);
  }

  async fetchProductDetails(productId: string) {
    const product = await this.client.product.get(parseInt(productId));
    return this.normalizeProduct(product);
  }

  async fetchShopInfo() {
    const shop = await this.client.shop.get();
    return {
      name: shop.name,
      email: shop.email,
      domain: shop.domain,
      currency: shop.currency,
      timezone: shop.timezone,
      address: {
        address1: shop.address1,
        address2: shop.address2,
        city: shop.city,
        province: shop.province,
        country: shop.country,
        zip: shop.zip,
      },
      phone: shop.phone,
      primaryLocale: shop.primary_locale,
    };
  }

  async fetchPages() {
    const pages = await this.client.page.list({ limit: 250 });
    return pages.map(page => ({
      id: page.id,
      title: page.title,
      content: page.body_html,
      handle: page.handle,
      createdAt: page.created_at,
      updatedAt: page.updated_at,
    }));
  }

  private normalizeProducts(products: any[]) {
    return products.map(p => this.normalizeProduct(p));
  }

  private normalizeProduct(product: any) {
    return {
      externalId: product.id.toString(),
      title: product.title,
      description: product.body_html,
      vendor: product.vendor,
      productType: product.product_type,
      handle: product.handle,
      status: product.status,
      tags: product.tags.split(', ').filter(Boolean),
      images: product.images.map((img: any) => ({
        id: img.id,
        src: img.src,
        alt: img.alt,
        position: img.position,
      })),
      variants: product.variants.map((v: any) => ({
        id: v.id,
        title: v.title,
        price: v.price,
        compareAtPrice: v.compare_at_price,
        sku: v.sku,
        barcode: v.barcode,
        weight: v.weight,
        weightUnit: v.weight_unit,
        inventoryQuantity: v.inventory_quantity,
        imageId: v.image_id,
      })),
      options: product.options.map((o: any) => ({
        name: o.name,
        values: o.values,
        position: o.position,
      })),
      createdAt: product.created_at,
      updatedAt: product.updated_at,
      rawData: product,
    };
  }
}
```

### Store Extraction Service

`src/services/store-extraction.service.ts`

```typescript
import { pool } from '../config/database';
import { createError } from '../middleware/errorHandler';
import platformDetector from './platform-detector.service';
import { ShopifyAdapterService } from './adapters/shopify-adapter.service';
import Queue from 'bull';

const extractionQueue = new Queue('store-extraction', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
});

export class StoreExtractionService {
  async startExtraction(storeUrl: string, userId: string, credentials?: any) {
    // Detect platform
    const platform = await platformDetector.detectPlatform(storeUrl);
    const domain = platformDetector.extractDomain(storeUrl);

    // Create store record
    const storeResult = await pool.query(
      `INSERT INTO stores (user_id, platform, store_url, domain, access_token, sync_status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id`,
      [userId, platform, storeUrl, domain, credentials?.accessToken || null]
    );

    const storeId = storeResult.rows[0].id;

    // Create extraction job
    const jobResult = await pool.query(
      `INSERT INTO extraction_jobs (store_id, status)
       VALUES ($1, 'pending')
       RETURNING id`,
      [storeId]
    );

    const jobId = jobResult.rows[0].id;

    // Queue extraction
    await extractionQueue.add('extract', {
      jobId,
      storeId,
      storeUrl,
      platform,
      credentials,
    });

    return {
      jobId,
      storeId,
      platform,
    };
  }

  async getExtractionStatus(jobId: string) {
    const result = await pool.query(
      `SELECT status, progress, total_items, items_processed, error_message, started_at, completed_at
       FROM extraction_jobs
       WHERE id = $1`,
      [jobId]
    );

    if (result.rows.length === 0) {
      throw createError('Extraction job not found', 404);
    }

    return result.rows[0];
  }
}

// Queue processor
extractionQueue.process('extract', async (job) => {
  const { jobId, storeId, platform, credentials } = job.data;

  try {
    // Update job status
    await pool.query(
      `UPDATE extraction_jobs
       SET status = 'processing', started_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [jobId]
    );

    let adapter;
    if (platform === 'shopify') {
      if (!credentials?.accessToken) {
        throw new Error('Shopify access token required');
      }
      adapter = new ShopifyAdapterService(credentials);
    } else {
      throw new Error(`Platform ${platform} not yet supported`);
    }

    // Fetch shop info
    const shopInfo = await adapter.fetchShopInfo();
    await pool.query(
      `UPDATE stores
       SET store_name = $1, metadata = $2
       WHERE id = $3`,
      [shopInfo.name, JSON.stringify(shopInfo), storeId]
    );

    // Fetch products
    const products = await adapter.fetchAllProducts();

    await pool.query(
      `UPDATE extraction_jobs
       SET total_items = $1
       WHERE id = $2`,
      [products.length, jobId]
    );

    // Save products
    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      await pool.query(
        `INSERT INTO extracted_products (
          store_id, external_id, title, description, price,
          currency, images, variants, tags, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (store_id, external_id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          price = EXCLUDED.price,
          images = EXCLUDED.images,
          variants = EXCLUDED.variants,
          tags = EXCLUDED.tags,
          raw_data = EXCLUDED.raw_data,
          updated_at = CURRENT_TIMESTAMP`,
        [
          storeId,
          product.externalId,
          product.title,
          product.description,
          product.variants[0]?.price || 0,
          'USD',
          JSON.stringify(product.images),
          JSON.stringify(product.variants),
          product.tags,
          JSON.stringify(product.rawData),
        ]
      );

      // Update progress
      const progress = Math.round(((i + 1) / products.length) * 100);
      await pool.query(
        `UPDATE extraction_jobs
         SET progress = $1, items_processed = $2
         WHERE id = $3`,
        [progress, i + 1, jobId]
      );

      await job.progress(progress);
    }

    // Mark as completed
    await pool.query(
      `UPDATE extraction_jobs
       SET status = 'completed', progress = 100, completed_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [jobId]
    );

    await pool.query(
      `UPDATE stores
       SET sync_status = 'completed', last_sync = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [storeId]
    );

  } catch (error) {
    await pool.query(
      `UPDATE extraction_jobs
       SET status = 'failed', error_message = $1
       WHERE id = $2`,
      [error.message, jobId]
    );

    throw error;
  }
});

export default new StoreExtractionService();
```

## Step 4: Controllers and Routes

`src/controllers/store.controller.ts`

```typescript
import { Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import storeExtractionService from '../services/store-extraction.service';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';
import { pool } from '../config/database';

export const startExtractionValidation = [
  body('storeUrl').isURL().withMessage('Valid store URL is required'),
  body('credentials').optional().isObject(),
];

class StoreController {
  async startExtraction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const { storeUrl, credentials } = req.body;

      const result = await storeExtractionService.startExtraction(
        storeUrl,
        req.user.id,
        credentials
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getExtractionStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const { jobId } = req.params;
      const status = await storeExtractionService.getExtractionStatus(jobId);

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStores(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const result = await pool.query(
        `SELECT id, platform, store_url, store_name, domain, sync_status, last_sync, created_at
         FROM stores
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [req.user.id]
      );

      res.json({
        success: true,
        data: { stores: result.rows },
      });
    } catch (error) {
      next(error);
    }
  }

  async getStoreProducts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw createError('User not authenticated', 401);
      }

      const { storeId } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      const result = await pool.query(
        `SELECT p.*
         FROM extracted_products p
         JOIN stores s ON s.id = p.store_id
         WHERE p.store_id = $1 AND s.user_id = $2
         ORDER BY p.created_at DESC
         LIMIT $3 OFFSET $4`,
        [storeId, req.user.id, limit, offset]
      );

      const countResult = await pool.query(
        `SELECT COUNT(*) as total
         FROM extracted_products p
         JOIN stores s ON s.id = p.store_id
         WHERE p.store_id = $1 AND s.user_id = $2`,
        [storeId, req.user.id]
      );

      res.json({
        success: true,
        data: {
          products: result.rows,
          total: parseInt(countResult.rows[0].total),
          page: Number(page),
          limit: Number(limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new StoreController();
```

`src/routes/store.routes.ts`

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import storeController, { startExtractionValidation } from '../controllers/store.controller';

const router = Router();

router.use(authenticate);

// POST /api/stores/extract - Start store extraction
router.post('/extract', startExtractionValidation, storeController.startExtraction.bind(storeController));

// GET /api/stores/jobs/:jobId - Get extraction job status
router.get('/jobs/:jobId', storeController.getExtractionStatus.bind(storeController));

// GET /api/stores - Get user's stores
router.get('/', storeController.getStores.bind(storeController));

// GET /api/stores/:storeId/products - Get store products
router.get('/:storeId/products', storeController.getStoreProducts.bind(storeController));

export default router;
```

## Step 5: Register Routes

`src/index.ts` - Add to your existing routes:

```typescript
import storeRoutes from './routes/store.routes';

app.use('/api/stores', storeRoutes);
```

## Step 6: Frontend Components

`frontend/src/pages/StoreImport.tsx`

```typescript
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import axios from '../lib/axios';

export default function StoreImport() {
  const { logout } = useAuthStore();
  const [storeUrl, setStoreUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  const handleImport = async () => {
    if (!storeUrl) return;

    setLoading(true);

    try {
      const response = await axios.post('/stores/extract', { storeUrl });
      const { jobId: newJobId, storeId } = response.data.data;

      setJobId(newJobId);
      setStatus('processing');

      // Poll for progress
      const interval = setInterval(async () => {
        const statusResponse = await axios.get(`/stores/jobs/${newJobId}`);
        const jobStatus = statusResponse.data.data;

        setProgress(jobStatus.progress || 0);
        setStatus(jobStatus.status);

        if (jobStatus.status === 'completed' || jobStatus.status === 'failed') {
          clearInterval(interval);
          setLoading(false);

          if (jobStatus.status === 'completed') {
            alert('Store imported successfully!');
            window.location.href = `/stores/${storeId}`;
          } else {
            alert(`Import failed: ${jobStatus.error_message}`);
          }
        }
      }, 2000);

    } catch (error: any) {
      console.error('Failed to import store:', error);
      alert(error.response?.data?.error?.message || 'Failed to import store');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">
                ← Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Import Store</h1>
            </div>
            <button onClick={logout} className="text-sm text-gray-600 hover:text-gray-900">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Enter Your Store URL
          </h2>
          <p className="text-gray-600 mb-6">
            We support Shopify, WooCommerce, BigCommerce, and more. Just paste your store URL below.
          </p>

          <div className="space-y-4">
            <input
              type="url"
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              placeholder="https://your-store.myshopify.com"
              className="input-field"
              disabled={loading}
            />

            <button
              onClick={handleImport}
              disabled={loading || !storeUrl}
              className="btn-primary"
            >
              {loading ? 'Importing...' : 'Import Store'}
            </button>
          </div>

          {loading && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">
                  {status === 'processing' ? 'Extracting data...' : 'Initializing...'}
                </span>
                <span className="text-sm font-medium text-gray-900">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 card bg-blue-50 border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">Supported Platforms</h3>
          <ul className="list-disc list-inside space-y-1 text-blue-800 text-sm">
            <li>Shopify (Recommended - Full API support)</li>
            <li>WooCommerce (WordPress)</li>
            <li>BigCommerce</li>
            <li>Magento / Adobe Commerce</li>
            <li>Custom stores (Limited features)</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
```

## Step 7: Run Migrations and Test

```bash
# Run migration
npm run migrate

# Start Redis (required for Bull queue)
redis-server

# Start backend
npm run dev

# In another terminal, start frontend
cd frontend
npm run dev
```

## Testing the Feature

1. Go to http://localhost:5173
2. Create a test Shopify store or use a demo store
3. Navigate to Store Import page
4. Enter store URL
5. Watch the extraction progress
6. View imported products

## Next Steps

- Add web scraping for non-Shopify stores
- Implement review extraction
- Add AI-powered data enhancement
- Build product catalog viewer
- Create export functionality

This gives you a working MVP in ~30 minutes!
