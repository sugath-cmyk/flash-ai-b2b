import axios, { AxiosInstance } from 'axios';
import { pool } from '../config/database';
import {
  ShopifyProduct,
  ShopifyCollection,
  ShopifyPage,
  ShopifyShop,
  ShopifyWebhook,
  WebhookTopic,
  WEBHOOK_TOPICS,
} from '../types/shopify.types';

/**
 * Shopify API Service
 * Handles all interactions with Shopify Admin API
 */

const SHOPIFY_API_VERSION = '2024-01';

interface PaginationInfo {
  limit?: number;
  pageInfo?: string;
  hasNextPage?: boolean;
}

export class ShopifyAPIService {
  private axiosInstance: AxiosInstance;
  private shopDomain: string;
  private accessToken: string;

  constructor(shopDomain: string, accessToken: string) {
    this.shopDomain = shopDomain;
    this.accessToken = accessToken;

    // Create axios instance with Shopify configuration
    this.axiosInstance = axios.create({
      baseURL: `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}`,
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds
    });

    // Add retry logic with exponential backoff
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;

        // Retry on rate limiting (429) or server errors (5xx)
        if (error.response?.status === 429 || error.response?.status >= 500) {
          const retryAfter = error.response.headers['retry-after'];
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : 2000;

          // Retry up to 3 times
          if (!config._retry) config._retry = 0;
          if (config._retry < 3) {
            config._retry += 1;
            await this.sleep(delay * config._retry);
            return this.axiosInstance(config);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Helper: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Helper: Extract Link header for pagination
   */
  private extractLinkHeader(linkHeader: string | undefined): { next?: string; previous?: string } {
    if (!linkHeader) return {};

    const links: any = {};
    const parts = linkHeader.split(',');

    parts.forEach((part) => {
      const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
      if (match) {
        links[match[2]] = match[1];
      }
    });

    return links;
  }

  /**
   * Get Shop Details
   */
  async getShop(): Promise<ShopifyShop> {
    const response = await this.axiosInstance.get('/shop.json');
    return response.data.shop;
  }

  /**
   * Get All Products (with pagination)
   */
  async *getAllProducts(): AsyncGenerator<ShopifyProduct[], void, unknown> {
    let url = '/products.json?limit=250';

    while (url) {
      const response = await this.axiosInstance.get(url);
      const products: ShopifyProduct[] = response.data.products;

      yield products;

      // Check for next page
      const linkHeader = response.headers['link'];
      const links = this.extractLinkHeader(linkHeader);
      url = links.next ? new URL(links.next).pathname + new URL(links.next).search : '';
    }
  }

  /**
   * Get Single Product
   */
  async getProduct(productId: number): Promise<ShopifyProduct> {
    const response = await this.axiosInstance.get(`/products/${productId}.json`);
    return response.data.product;
  }

  /**
   * Get Product Count
   */
  async getProductCount(): Promise<number> {
    const response = await this.axiosInstance.get('/products/count.json');
    return response.data.count;
  }

  /**
   * Get All Collections (with pagination)
   */
  async *getAllCollections(): AsyncGenerator<ShopifyCollection[], void, unknown> {
    let url = '/custom_collections.json?limit=250';

    while (url) {
      const response = await this.axiosInstance.get(url);
      const collections: ShopifyCollection[] = response.data.custom_collections;

      yield collections;

      // Check for next page
      const linkHeader = response.headers['link'];
      const links = this.extractLinkHeader(linkHeader);
      url = links.next ? new URL(links.next).pathname + new URL(links.next).search : '';
    }

    // Also fetch smart collections
    url = '/smart_collections.json?limit=250';
    while (url) {
      const response = await this.axiosInstance.get(url);
      const collections: ShopifyCollection[] = response.data.smart_collections;

      yield collections;

      const linkHeader = response.headers['link'];
      const links = this.extractLinkHeader(linkHeader);
      url = links.next ? new URL(links.next).pathname + new URL(links.next).search : '';
    }
  }

  /**
   * Get All Pages (with pagination)
   */
  async *getAllPages(): AsyncGenerator<ShopifyPage[], void, unknown> {
    let url = '/pages.json?limit=250';

    while (url) {
      const response = await this.axiosInstance.get(url);
      const pages: ShopifyPage[] = response.data.pages;

      yield pages;

      // Check for next page
      const linkHeader = response.headers['link'];
      const links = this.extractLinkHeader(linkHeader);
      url = links.next ? new URL(links.next).pathname + new URL(links.next).search : '';
    }
  }

  /**
   * Get All Price Rules (with pagination)
   */
  async getAllPriceRules(): Promise<any[]> {
    const priceRules: any[] = [];
    let url = '/price_rules.json?limit=250';

    while (url) {
      const response = await this.axiosInstance.get(url);
      priceRules.push(...response.data.price_rules);

      // Check for next page
      const linkHeader = response.headers['link'];
      const links = this.extractLinkHeader(linkHeader);
      url = links.next ? new URL(links.next).pathname + new URL(links.next).search : '';

      if (!url) break;
    }

    return priceRules;
  }

  /**
   * Get Discount Codes for a Price Rule
   */
  async getDiscountCodes(priceRuleId: number): Promise<any[]> {
    const discountCodes: any[] = [];
    let url = `/price_rules/${priceRuleId}/discount_codes.json?limit=250`;

    while (url) {
      const response = await this.axiosInstance.get(url);
      discountCodes.push(...response.data.discount_codes);

      // Check for next page
      const linkHeader = response.headers['link'];
      const links = this.extractLinkHeader(linkHeader);
      url = links.next ? new URL(links.next).pathname + new URL(links.next).search : '';

      if (!url) break;
    }

    return discountCodes;
  }

  /**
   * Create Webhook Subscription
   */
  async createWebhook(topic: WebhookTopic, address: string): Promise<ShopifyWebhook> {
    const response = await this.axiosInstance.post('/webhooks.json', {
      webhook: {
        topic,
        address,
        format: 'json',
      },
    });
    return response.data.webhook;
  }

  /**
   * Get All Webhooks
   */
  async getWebhooks(): Promise<ShopifyWebhook[]> {
    const response = await this.axiosInstance.get('/webhooks.json');
    return response.data.webhooks;
  }

  /**
   * Delete Webhook
   */
  async deleteWebhook(webhookId: number): Promise<void> {
    await this.axiosInstance.delete(`/webhooks/${webhookId}.json`);
  }
}

/**
 * Extract Store Data Service
 * Coordinates full data extraction from Shopify
 */
export class ShopifyExtractionService {
  /**
   * Extract all data from Shopify store
   */
  static async extractStoreData(storeId: string): Promise<void> {
    try {
      // Get store details
      const storeResult = await pool.query(
        `SELECT shopify_shop_domain, shopify_access_token
         FROM stores WHERE id = $1 AND platform = 'shopify'`,
        [storeId]
      );

      if (storeResult.rows.length === 0) {
        throw new Error('Store not found or not a Shopify store');
      }

      const { shopify_shop_domain, shopify_access_token } = storeResult.rows[0];

      if (!shopify_shop_domain || !shopify_access_token) {
        throw new Error('Store not connected to Shopify');
      }

      // Create Shopify API client
      const shopify = new ShopifyAPIService(shopify_shop_domain, shopify_access_token);

      // Create extraction job
      const jobResult = await pool.query(
        `INSERT INTO extraction_jobs (store_id, job_type, status, started_at)
         VALUES ($1, 'full', 'processing', NOW())
         RETURNING id`,
        [storeId]
      );
      const jobId = jobResult.rows[0].id;

      // Update store sync status
      await pool.query(
        `UPDATE stores SET sync_status = 'processing' WHERE id = $1`,
        [storeId]
      );

      let totalItems = 0;
      let processedItems = 0;

      try {
        // Extract products
        console.log(`Extracting products for store ${storeId}...`);
        for await (const productBatch of shopify.getAllProducts()) {
          for (const product of productBatch) {
            await this.saveProduct(storeId, product);
            processedItems++;
          }
          totalItems += productBatch.length;

          // Update job progress
          await pool.query(
            `UPDATE extraction_jobs
             SET items_processed = $1, total_items = $2, progress = $3
             WHERE id = $4`,
            [processedItems, totalItems, Math.round((processedItems / totalItems) * 100), jobId]
          );
        }

        // Extract collections
        console.log(`Extracting collections for store ${storeId}...`);
        for await (const collectionBatch of shopify.getAllCollections()) {
          for (const collection of collectionBatch) {
            await this.saveCollection(storeId, collection);
          }
        }

        // Extract pages
        console.log(`Extracting pages for store ${storeId}...`);
        for await (const pageBatch of shopify.getAllPages()) {
          for (const page of pageBatch) {
            await this.savePage(storeId, page);
          }
        }

        // Extract discounts (price rules and discount codes)
        console.log(`Extracting discounts for store ${storeId}...`);
        try {
          const priceRules = await shopify.getAllPriceRules();
          const now = new Date();
          let activeDiscountCount = 0;

          for (const priceRule of priceRules) {
            // Skip if not started or expired (only extract active discounts)
            const startDate = new Date(priceRule.starts_at);
            const endDate = priceRule.ends_at ? new Date(priceRule.ends_at) : null;

            if (startDate > now || (endDate && endDate < now)) {
              continue; // Skip inactive discounts
            }

            // Get discount codes for this price rule
            const discountCodes = await shopify.getDiscountCodes(priceRule.id);

            for (const discountCode of discountCodes) {
              await this.saveDiscount(storeId, priceRule, discountCode);
              activeDiscountCount++;
            }
          }

          console.log(`Saved ${activeDiscountCount} active discounts`);
        } catch (error: any) {
          console.error('Failed to extract discounts:', error.message);
          // Continue with extraction even if discounts fail
        }

        // Mark job as completed
        await pool.query(
          `UPDATE extraction_jobs
           SET status = 'completed', completed_at = NOW(), progress = 100
           WHERE id = $1`,
          [jobId]
        );

        // Update store sync status
        await pool.query(
          `UPDATE stores SET sync_status = 'completed', last_sync = NOW() WHERE id = $1`,
          [storeId]
        );

        console.log(`Extraction completed for store ${storeId}`);
      } catch (error: any) {
        // Mark job as failed
        await pool.query(
          `UPDATE extraction_jobs
           SET status = 'failed', error_message = $1, completed_at = NOW()
           WHERE id = $2`,
          [error.message, jobId]
        );

        // Update store sync status
        await pool.query(
          `UPDATE stores SET sync_status = 'failed' WHERE id = $1`,
          [storeId]
        );

        throw error;
      }
    } catch (error) {
      console.error('Extraction error:', error);
      throw error;
    }
  }

  /**
   * Save product to database
   */
  private static async saveProduct(storeId: string, product: ShopifyProduct): Promise<void> {
    await pool.query(
      `INSERT INTO extracted_products
       (store_id, external_id, title, description, price, vendor, product_type,
        handle, status, images, variants, options, tags, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (store_id, external_id)
       DO UPDATE SET
         title = $3, description = $4, price = $5, vendor = $6,
         product_type = $7, handle = $8, status = $9, images = $10,
         variants = $11, options = $12, tags = $13, raw_data = $14,
         updated_at = NOW()`,
      [
        storeId,
        product.id.toString(),
        product.title,
        product.body_html,
        product.variants[0]?.price || '0',
        product.vendor,
        product.product_type,
        product.handle,
        product.status,
        JSON.stringify(product.images),
        JSON.stringify(product.variants),
        JSON.stringify(product.options),
        product.tags.split(',').map((t) => t.trim()),
        JSON.stringify(product),
      ]
    );
  }

  /**
   * Save collection to database
   */
  private static async saveCollection(storeId: string, collection: ShopifyCollection): Promise<void> {
    await pool.query(
      `INSERT INTO extracted_collections
       (store_id, external_id, title, description, handle, image_url, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (store_id, external_id)
       DO UPDATE SET
         title = $3, description = $4, handle = $5, image_url = $6,
         metadata = $7, created_at = NOW()`,
      [
        storeId,
        collection.id.toString(),
        collection.title,
        collection.body_html || '',
        collection.handle,
        collection.image?.src || null,
        JSON.stringify(collection),
      ]
    );
  }

  /**
   * Save page to database
   */
  private static async savePage(storeId: string, page: ShopifyPage): Promise<void> {
    // Detect page type from handle or title
    const handle = page.handle.toLowerCase();
    const title = page.title.toLowerCase();

    let pageType = 'custom';
    if (handle.includes('about') || title.includes('about')) {
      pageType = 'about';
    } else if (handle.includes('contact') || title.includes('contact')) {
      pageType = 'contact';
    } else if (handle.includes('shipping') || title.includes('shipping')) {
      pageType = 'shipping';
    } else if (handle.includes('return') || title.includes('return')) {
      pageType = 'returns';
    } else if (handle.includes('refund') || title.includes('refund')) {
      pageType = 'refund';
    } else if (handle.includes('privacy') || title.includes('privacy')) {
      pageType = 'privacy';
    } else if (handle.includes('terms') || title.includes('terms')) {
      pageType = 'terms';
    }

    await pool.query(
      `INSERT INTO extracted_pages
       (store_id, page_type, title, content, handle, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (store_id, handle)
       DO UPDATE SET
         page_type = $2, title = $3, content = $4, metadata = $6, updated_at = NOW()`,
      [storeId, pageType, page.title, page.body_html, page.handle, JSON.stringify(page)]
    );
  }

  /**
   * Save discount to database
   */
  private static async saveDiscount(storeId: string, priceRule: any, discountCode: any): Promise<void> {
    const externalId = `${priceRule.id}_${discountCode.id}`;
    const now = new Date();
    const startDate = new Date(priceRule.starts_at);
    const endDate = priceRule.ends_at ? new Date(priceRule.ends_at) : null;
    const isActive = startDate <= now && (!endDate || endDate >= now);

    await pool.query(
      `INSERT INTO extracted_discounts
       (store_id, external_id, price_rule_id, discount_code_id, title, code, description,
        value_type, value, target_type, target_selection, customer_selection,
        minimum_requirements, entitled_product_ids, entitled_collection_ids,
        usage_limit, customer_usage_limit, usage_count,
        starts_at, ends_at, is_active, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       ON CONFLICT (store_id, external_id)
       DO UPDATE SET
         title = $5, code = $6, description = $7,
         value_type = $8, value = $9,
         usage_count = $18, is_active = $21, metadata = $22,
         updated_at = NOW()`,
      [
        storeId,
        externalId,
        priceRule.id.toString(),
        discountCode.id.toString(),
        priceRule.title,
        discountCode.code,
        null, // description
        priceRule.value_type,
        parseFloat(priceRule.value),
        priceRule.target_type,
        priceRule.target_selection,
        priceRule.customer_selection,
        priceRule.prerequisite_subtotal_range || priceRule.prerequisite_quantity_range
          ? JSON.stringify(priceRule.prerequisite_subtotal_range || priceRule.prerequisite_quantity_range)
          : null,
        priceRule.entitled_product_ids?.map((id: any) => id.toString()) || null,
        priceRule.entitled_collection_ids?.map((id: any) => id.toString()) || null,
        priceRule.usage_limit || null,
        priceRule.once_per_customer ? 1 : null,
        discountCode.usage_count,
        priceRule.starts_at,
        priceRule.ends_at || null,
        isActive,
        JSON.stringify({ priceRule, discountCode }),
      ]
    );
  }

  /**
   * Setup webhooks for real-time sync
   */
  static async setupWebhooks(storeId: string): Promise<void> {
    try {
      const storeResult = await pool.query(
        `SELECT shopify_shop_domain, shopify_access_token
         FROM stores WHERE id = $1 AND platform = 'shopify'`,
        [storeId]
      );

      if (storeResult.rows.length === 0) {
        throw new Error('Store not found');
      }

      const { shopify_shop_domain, shopify_access_token } = storeResult.rows[0];
      const shopify = new ShopifyAPIService(shopify_shop_domain, shopify_access_token);

      const webhookBaseUrl = process.env.BACKEND_URL || 'http://localhost:3000';

      // Create webhooks for important events
      for (const topic of WEBHOOK_TOPICS) {
        const address = `${webhookBaseUrl}/api/shopify/webhooks/${topic}`;

        try {
          const webhook = await shopify.createWebhook(topic, address);

          // Save webhook subscription to database
          await pool.query(
            `INSERT INTO webhook_subscriptions
             (store_id, webhook_id, topic, address, format, status)
             VALUES ($1, $2, $3, $4, 'json', 'active')
             ON CONFLICT (store_id, topic)
             DO UPDATE SET webhook_id = $2, address = $4, status = 'active', updated_at = NOW()`,
            [storeId, webhook.id.toString(), topic, address]
          );

          console.log(`Webhook created for ${topic}`);
        } catch (error) {
          console.error(`Failed to create webhook for ${topic}:`, error);
        }
      }
    } catch (error) {
      console.error('Setup webhooks error:', error);
      throw error;
    }
  }
}
