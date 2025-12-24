import Queue from 'bull';
import { pool } from '../config/database';
import { createError } from '../middleware/errorHandler';
import platformDetectorService, { Platform, PlatformDetectionResult } from './platform-detector.service';
import shopifyAdapterService, { ShopifyAdapterService } from './adapters/shopify-adapter.service';

interface StoreConfig {
  userId: string;
  storeUrl: string;
  accessToken?: string;
  apiKey?: string;
  apiSecret?: string;
}

interface ExtractionJobData {
  storeId: string;
  jobId: string;
  userId: string;
}

export class StoreExtractionService {
  private extractionQueue: Queue.Queue;

  constructor() {
    // Initialize Bull queue with Redis
    this.extractionQueue = new Queue('store-extraction', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 200, // Keep last 200 failed jobs
      },
    });

    // Process extraction jobs
    this.extractionQueue.process(async (job) => {
      return await this.processExtraction(job.data);
    });

    // Job event listeners
    this.extractionQueue.on('completed', (job) => {
      console.log(`Job ${job.id} completed successfully`);
    });

    this.extractionQueue.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed:`, err.message);
    });

    this.extractionQueue.on('progress', (job, progress) => {
      console.log(`Job ${job.id} progress: ${progress}%`);
    });
  }

  async initiateExtraction(config: StoreConfig): Promise<{ storeId: string; jobId: string }> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Detect platform
      const detection = await platformDetectorService.detectPlatform(config.storeUrl);

      if (detection.confidence < 50 && detection.platform !== Platform.CUSTOM) {
        throw createError('Could not reliably detect platform. Please verify the URL or provide API credentials.', 400);
      }

      // Extract domain
      const domain = platformDetectorService.extractDomain(config.storeUrl);

      // Create store record
      const storeResult = await client.query(
        `INSERT INTO stores (user_id, platform, store_url, domain, access_token, api_key, api_secret, sync_status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          config.userId,
          detection.platform,
          config.storeUrl,
          domain,
          config.accessToken || null,
          config.apiKey || null,
          config.apiSecret || null,
          'pending',
          JSON.stringify({
            detection: {
              confidence: detection.confidence,
              indicators: detection.indicators,
            },
          }),
        ]
      );

      const storeId = storeResult.rows[0].id;

      // Create extraction job record
      const jobResult = await client.query(
        `INSERT INTO extraction_jobs (store_id, job_type, status, progress)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [storeId, 'full', 'pending', 0]
      );

      const jobId = jobResult.rows[0].id;

      await client.query('COMMIT');

      // Add job to queue
      await this.extractionQueue.add({
        storeId,
        jobId,
        userId: config.userId,
      });

      return { storeId, jobId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async processExtraction(data: ExtractionJobData): Promise<void> {
    const { storeId, jobId, userId } = data;

    try {
      // Update job status to processing
      await this.updateJobStatus(jobId, 'processing', 0);
      await this.updateStoreStatus(storeId, 'processing');

      // Get store details
      const storeResult = await pool.query(
        'SELECT * FROM stores WHERE id = $1',
        [storeId]
      );

      if (storeResult.rows.length === 0) {
        throw new Error('Store not found');
      }

      const store = storeResult.rows[0];

      // Process based on platform
      switch (store.platform) {
        case Platform.SHOPIFY:
          await this.extractShopifyStore(store, jobId);
          break;

        case Platform.WOOCOMMERCE:
        case Platform.BIGCOMMERCE:
        case Platform.MAGENTO:
        case Platform.CUSTOM:
          throw new Error(`Platform ${store.platform} extraction not yet implemented`);

        default:
          throw new Error(`Unknown platform: ${store.platform}`);
      }

      // Mark job as completed
      await this.updateJobStatus(jobId, 'completed', 100);
      await this.updateStoreStatus(storeId, 'completed');
      await this.updateStoreLastSync(storeId);
    } catch (error: any) {
      console.error('Extraction error:', error);
      await this.updateJobStatus(jobId, 'failed', 0, error.message);
      await this.updateStoreStatus(storeId, 'failed');
      throw error;
    }
  }

  private async extractShopifyStore(store: any, jobId: string): Promise<void> {
    const adapter = new ShopifyAdapterService();

    try {
      // Initialize Shopify adapter
      const shopName = platformDetectorService.extractShopifyDomain(store.store_url);
      if (!shopName) {
        throw new Error('Invalid Shopify store URL');
      }

      await adapter.initialize({
        shopName,
        accessToken: store.access_token,
        apiKey: store.api_key,
        password: store.api_secret,
      });

      // Step 1: Extract store info (10%)
      await this.updateJobProgress(jobId, 5, 'Extracting store information...');
      const storeInfo = await adapter.extractStoreInfo();

      await pool.query(
        `UPDATE stores
         SET store_name = $1, metadata = metadata || $2
         WHERE id = $3`,
        [
          storeInfo.name,
          JSON.stringify({ storeInfo: storeInfo.metadata }),
          store.id,
        ]
      );

      await this.updateJobProgress(jobId, 10, 'Store information extracted');

      // Step 2: Extract products (60%)
      await this.updateJobProgress(jobId, 15, 'Extracting products...');
      const products = await adapter.extractProducts();

      await this.updateJobProgress(jobId, 40, `Extracted ${products.length} products, saving to database...`);

      for (let i = 0; i < products.length; i++) {
        const product = products[i];

        await pool.query(
          `INSERT INTO extracted_products (
            store_id, external_id, title, description, short_description,
            price, compare_at_price, currency, sku, barcode,
            weight, weight_unit, inventory, product_type, vendor,
            handle, status, images, variants, options, tags,
            seo_title, seo_description, raw_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
          ON CONFLICT (store_id, external_id)
          DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            price = EXCLUDED.price,
            updated_at = CURRENT_TIMESTAMP`,
          [
            store.id,
            product.externalId,
            product.title,
            product.description,
            product.shortDescription,
            product.price,
            product.compareAtPrice,
            product.currency,
            product.sku,
            product.barcode,
            product.weight,
            product.weightUnit,
            product.inventory,
            product.productType,
            product.vendor,
            product.handle,
            product.status,
            JSON.stringify(product.images),
            JSON.stringify(product.variants),
            JSON.stringify(product.options),
            product.tags,
            product.seoTitle,
            product.seoDescription,
            JSON.stringify(product.rawData),
          ]
        );

        // Update progress every 10 products
        if (i % 10 === 0) {
          const progress = 40 + Math.floor((i / products.length) * 30);
          await this.updateJobProgress(jobId, progress, `Saved ${i}/${products.length} products`);
        }
      }

      await this.updateJobProgress(jobId, 70, `All ${products.length} products saved`);

      // Step 3: Extract collections (15%)
      await this.updateJobProgress(jobId, 75, 'Extracting collections...');
      const collections = await adapter.extractCollections();

      for (const collection of collections) {
        await pool.query(
          `INSERT INTO extracted_collections (
            store_id, external_id, title, description, handle,
            image_url, product_count, sort_order, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (store_id, external_id)
          DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description`,
          [
            store.id,
            collection.externalId,
            collection.title,
            collection.description,
            collection.handle,
            collection.imageUrl,
            collection.productCount,
            collection.sortOrder,
            JSON.stringify(collection.metadata),
          ]
        );
      }

      await this.updateJobProgress(jobId, 85, `Extracted ${collections.length} collections`);

      // Step 4: Extract pages (10%)
      await this.updateJobProgress(jobId, 90, 'Extracting pages...');
      const pages = await adapter.extractPages();

      for (const page of pages) {
        // Determine page type from title/handle
        const pageType = this.determinePageType(page.title, page.handle);

        await pool.query(
          `INSERT INTO extracted_pages (
            store_id, page_type, title, content, url, handle, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (store_id, handle)
          DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            updated_at = CURRENT_TIMESTAMP`,
          [
            store.id,
            pageType,
            page.title,
            page.content,
            page.url,
            page.handle,
            JSON.stringify(page.metadata),
          ]
        );
      }

      await this.updateJobProgress(jobId, 95, `Extracted ${pages.length} pages`);

      // Step 5: Extract policies (5%)
      await this.updateJobProgress(jobId, 98, 'Extracting policies...');
      const policies = await adapter.extractPolicies();

      // Save policies as pages
      for (const [policyType, content] of Object.entries(policies)) {
        if (content) {
          await pool.query(
            `INSERT INTO extracted_pages (
              store_id, page_type, title, content, url, handle, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (store_id, handle)
            DO UPDATE SET
              content = EXCLUDED.content,
              updated_at = CURRENT_TIMESTAMP`,
            [
              store.id,
              policyType.replace(/([A-Z])/g, '_$1').toLowerCase().substring(1), // camelCase to snake_case
              policyType,
              content,
              `${store.store_url}/policies/${policyType}`,
              policyType,
              JSON.stringify({ type: 'policy' }),
            ]
          );
        }
      }

      await this.updateJobProgress(jobId, 100, 'Extraction completed successfully');

      // Disconnect adapter
      await adapter.disconnect();
    } catch (error) {
      await adapter.disconnect();
      throw error;
    }
  }

  private determinePageType(title: string, handle: string): string {
    const lowerTitle = title.toLowerCase();
    const lowerHandle = handle.toLowerCase();

    if (lowerTitle.includes('about') || lowerHandle.includes('about')) return 'about';
    if (lowerTitle.includes('faq') || lowerHandle.includes('faq')) return 'faq';
    if (lowerTitle.includes('contact') || lowerHandle.includes('contact')) return 'contact';
    if (lowerTitle.includes('shipping') || lowerHandle.includes('shipping')) return 'shipping';
    if (lowerTitle.includes('returns') || lowerHandle.includes('return')) return 'returns';
    if (lowerTitle.includes('terms') || lowerHandle.includes('terms')) return 'terms';
    if (lowerTitle.includes('privacy') || lowerHandle.includes('privacy')) return 'privacy';

    return 'other';
  }

  private async updateJobStatus(jobId: string, status: string, progress: number, errorMessage?: string): Promise<void> {
    const now = new Date();

    await pool.query(
      `UPDATE extraction_jobs
       SET status = $1::varchar,
           progress = $2::integer,
           error_message = $3::text,
           started_at = CASE WHEN status = 'pending' AND $1::varchar = 'processing' THEN $4 ELSE started_at END,
           completed_at = CASE WHEN $1::varchar IN ('completed', 'failed') THEN $4 ELSE NULL END
       WHERE id = $5`,
      [status, progress, errorMessage || null, now, jobId]
    );
  }

  private async updateJobProgress(jobId: string, progress: number, message?: string): Promise<void> {
    await pool.query(
      `UPDATE extraction_jobs
       SET progress = $1::integer, error_message = $2::text
       WHERE id = $3`,
      [progress, message || null, jobId]
    );
  }

  private async updateStoreStatus(storeId: string, status: string): Promise<void> {
    await pool.query(
      'UPDATE stores SET sync_status = $1::varchar WHERE id = $2',
      [status, storeId]
    );
  }

  private async updateStoreLastSync(storeId: string): Promise<void> {
    await pool.query(
      'UPDATE stores SET last_sync = CURRENT_TIMESTAMP WHERE id = $1',
      [storeId]
    );
  }

  async getExtractionStatus(jobId: string, userId: string): Promise<any> {
    const result = await pool.query(
      `SELECT ej.*, s.store_url, s.store_name, s.platform
       FROM extraction_jobs ej
       JOIN stores s ON ej.store_id = s.id
       WHERE ej.id = $1 AND s.user_id = $2`,
      [jobId, userId]
    );

    if (result.rows.length === 0) {
      throw createError('Job not found', 404);
    }

    return result.rows[0];
  }

  async getUserStores(userId: string): Promise<any[]> {
    const result = await pool.query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM extracted_products WHERE store_id = s.id) as product_count,
              (SELECT COUNT(*) FROM extracted_collections WHERE store_id = s.id) as collection_count,
              (SELECT COUNT(*) FROM extracted_pages WHERE store_id = s.id) as page_count
       FROM stores s
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  async getStoreDetails(storeId: string, userId: string): Promise<any> {
    const storeResult = await pool.query(
      `SELECT * FROM stores WHERE id = $1 AND user_id = $2`,
      [storeId, userId]
    );

    if (storeResult.rows.length === 0) {
      throw createError('Store not found', 404);
    }

    const store = storeResult.rows[0];

    // Get product count
    const productCount = await pool.query(
      'SELECT COUNT(*) as count FROM extracted_products WHERE store_id = $1',
      [storeId]
    );

    // Get collection count
    const collectionCount = await pool.query(
      'SELECT COUNT(*) as count FROM extracted_collections WHERE store_id = $1',
      [storeId]
    );

    // Get page count
    const pageCount = await pool.query(
      'SELECT COUNT(*) as count FROM extracted_pages WHERE store_id = $1',
      [storeId]
    );

    // Get latest extraction job
    const latestJob = await pool.query(
      'SELECT * FROM extraction_jobs WHERE store_id = $1 ORDER BY created_at DESC LIMIT 1',
      [storeId]
    );

    return {
      ...store,
      productCount: parseInt(productCount.rows[0].count),
      collectionCount: parseInt(collectionCount.rows[0].count),
      pageCount: parseInt(pageCount.rows[0].count),
      latestJob: latestJob.rows[0] || null,
    };
  }

  async deleteStore(storeId: string, userId: string): Promise<void> {
    const result = await pool.query(
      'DELETE FROM stores WHERE id = $1 AND user_id = $2',
      [storeId, userId]
    );

    if (result.rowCount === 0) {
      throw createError('Store not found', 404);
    }
  }

  async retryExtraction(storeId: string, userId: string): Promise<{ jobId: string }> {
    // Verify store ownership
    const storeResult = await pool.query(
      'SELECT * FROM stores WHERE id = $1 AND user_id = $2',
      [storeId, userId]
    );

    if (storeResult.rows.length === 0) {
      throw createError('Store not found', 404);
    }

    // Create new extraction job
    const jobResult = await pool.query(
      `INSERT INTO extraction_jobs (store_id, job_type, status, progress)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [storeId, 'full', 'pending', 0]
    );

    const jobId = jobResult.rows[0].id;

    // Update store status
    await this.updateStoreStatus(storeId, 'pending');

    // Add to queue
    await this.extractionQueue.add({
      storeId,
      jobId,
      userId,
    });

    return { jobId };
  }
}

export default new StoreExtractionService();
