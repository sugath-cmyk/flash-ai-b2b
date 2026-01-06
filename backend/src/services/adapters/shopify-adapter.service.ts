import Shopify from 'shopify-api-node';
import { createError } from '../../middleware/errorHandler';

export interface ShopifyConfig {
  shopName: string;
  accessToken?: string;
  apiKey?: string;
  password?: string; // For private apps
}

export interface ExtractedStore {
  name: string;
  domain: string;
  email: string;
  currency: string;
  timezone: string;
  metadata: {
    shopOwner?: string;
    phone?: string;
    address?: any;
    plan?: string;
    primaryLocale?: string;
    enabledPresentmentCurrencies?: string[];
  };
}

export interface ExtractedProduct {
  externalId: string;
  title: string;
  description: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  sku?: string;
  barcode?: string;
  weight?: number;
  weightUnit?: string;
  inventory?: number;
  productType?: string;
  vendor?: string;
  handle: string;
  status: string;
  images: any[];
  variants: any[];
  options: any[];
  tags: string[];
  seoTitle?: string;
  seoDescription?: string;
  rawData: any;
}

export interface ExtractedCollection {
  externalId: string;
  title: string;
  description?: string;
  handle: string;
  imageUrl?: string;
  productCount: number;
  sortOrder?: string;
  metadata: any;
}

export interface ExtractedPage {
  title: string;
  content: string;
  handle: string;
  url: string;
  metadata: any;
}

export class ShopifyAdapterService {
  private shopify: Shopify | null = null;
  private shopName: string = '';

  async initialize(config: ShopifyConfig): Promise<void> {
    try {
      const { shopName, accessToken, apiKey, password } = config;

      // Remove .myshopify.com if present
      const cleanShopName = shopName.replace('.myshopify.com', '');
      this.shopName = cleanShopName;

      if (accessToken) {
        // Public/Custom app with access token
        this.shopify = new Shopify({
          shopName: cleanShopName,
          accessToken,
          apiVersion: '2024-01',
        });
      } else if (apiKey && password) {
        // Private app with API key and password
        this.shopify = new Shopify({
          shopName: cleanShopName,
          apiKey,
          password,
          apiVersion: '2024-01',
        });
      } else {
        throw createError('Missing Shopify credentials', 400);
      }

      // Test connection
      await this.shopify.shop.get();
    } catch (error: any) {
      throw createError(`Failed to connect to Shopify: ${error.message}`, 500);
    }
  }

  async extractStoreInfo(): Promise<ExtractedStore> {
    if (!this.shopify) {
      throw createError('Shopify client not initialized', 500);
    }

    try {
      const shop = await this.shopify.shop.get();

      return {
        name: shop.name,
        domain: shop.domain,
        email: shop.email,
        currency: shop.currency,
        timezone: shop.timezone || 'UTC',
        metadata: {
          shopOwner: shop.shop_owner || undefined,
          phone: shop.phone || undefined,
          address: {
            address1: shop.address1,
            address2: shop.address2,
            city: shop.city,
            province: shop.province,
            provinceCode: shop.province_code,
            country: shop.country,
            countryCode: shop.country_code,
            zip: shop.zip,
          },
          plan: shop.plan_name,
          primaryLocale: shop.primary_locale,
          enabledPresentmentCurrencies: shop.enabled_presentment_currencies,
        },
      };
    } catch (error: any) {
      throw createError(`Failed to extract store info: ${error.message}`, 500);
    }
  }

  async extractProducts(limit: number = 250): Promise<ExtractedProduct[]> {
    if (!this.shopify) {
      throw createError('Shopify client not initialized', 500);
    }

    try {
      const products: ExtractedProduct[] = [];
      let params: any = { limit };

      // Fetch all products with pagination
      do {
        const batch = await this.shopify.product.list(params);

        for (const product of batch) {
          // Calculate price - use MINIMUM price from all variants (actual selling price)
          // This ensures we show the lowest available price, not a bulk/wholesale variant
          const variantPrices = product.variants
            ?.map((v) => parseFloat(v.price || '0'))
            .filter((p) => p > 0) || [0];

          const price = variantPrices.length > 0
            ? Math.min(...variantPrices)
            : 0;

          // Get compare_at_price from the variant that has the minimum price
          const minPriceVariant = product.variants?.find(
            (v) => parseFloat(v.price || '0') === price
          ) || product.variants?.[0];

          const compareAtPrice = minPriceVariant?.compare_at_price
            ? parseFloat(minPriceVariant.compare_at_price)
            : undefined;

          products.push({
            externalId: product.id.toString(),
            title: product.title,
            description: product.body_html || '',
            shortDescription: this.extractShortDescription(product.body_html || ''),
            price,
            compareAtPrice,
            currency: 'USD', // Will be overridden by store currency
            sku: minPriceVariant?.sku || undefined,
            barcode: minPriceVariant?.barcode || undefined,
            weight: minPriceVariant?.weight ? parseFloat(minPriceVariant.weight.toString()) : undefined,
            weightUnit: minPriceVariant?.weight_unit || undefined,
            inventory: minPriceVariant?.inventory_quantity,
            productType: product.product_type || undefined,
            vendor: product.vendor || undefined,
            handle: product.handle,
            status: product.status,
            images: product.images.map((img) => ({
              id: img.id,
              src: img.src,
              alt: img.alt,
              width: img.width,
              height: img.height,
              position: img.position,
            })),
            variants: product.variants.map((variant) => ({
              id: variant.id,
              title: variant.title,
              price: parseFloat(variant.price),
              compareAtPrice: variant.compare_at_price
                ? parseFloat(variant.compare_at_price)
                : null,
              sku: variant.sku,
              barcode: variant.barcode,
              weight: variant.weight,
              weightUnit: variant.weight_unit,
              inventoryQuantity: variant.inventory_quantity,
              inventoryPolicy: variant.inventory_policy,
              option1: variant.option1,
              option2: variant.option2,
              option3: variant.option3,
              imageId: variant.image_id,
            })),
            options: product.options.map((opt) => ({
              id: opt.id,
              name: opt.name,
              position: opt.position,
              values: opt.values,
            })),
            tags: product.tags ? product.tags.split(', ') : [],
            seoTitle: product.title,
            seoDescription: this.stripHtml(product.body_html || '').substring(0, 160),
            rawData: product,
          });
        }

        // Check if there are more pages
        if (batch.length < limit) {
          break;
        }

        // Get the last product ID for pagination
        const lastProduct = batch[batch.length - 1];
        params.since_id = lastProduct.id;
      } while (true);

      return products;
    } catch (error: any) {
      throw createError(`Failed to extract products: ${error.message}`, 500);
    }
  }

  async extractCollections(): Promise<ExtractedCollection[]> {
    if (!this.shopify) {
      throw createError('Shopify client not initialized', 500);
    }

    try {
      const collections: ExtractedCollection[] = [];

      // Get custom collections
      const customCollections = await this.shopify.customCollection.list({ limit: 250 });
      for (const collection of customCollections) {
        collections.push({
          externalId: collection.id.toString(),
          title: collection.title,
          description: collection.body_html || undefined,
          handle: collection.handle,
          imageUrl: collection.image?.src || undefined,
          productCount: 0, // Will need separate API call to get count
          sortOrder: collection.sort_order || undefined,
          metadata: {
            type: 'custom',
            publishedAt: collection.published_at,
          },
        });
      }

      // Get smart collections
      const smartCollections = await this.shopify.smartCollection.list({ limit: 250 });
      for (const collection of smartCollections) {
        collections.push({
          externalId: collection.id.toString(),
          title: collection.title,
          description: collection.body_html || undefined,
          handle: collection.handle,
          imageUrl: collection.image?.src || undefined,
          productCount: 0,
          sortOrder: collection.sort_order || undefined,
          metadata: {
            type: 'smart',
            rules: collection.rules,
            disjunctive: collection.disjunctive,
            publishedAt: collection.published_at,
          },
        });
      }

      return collections;
    } catch (error: any) {
      throw createError(`Failed to extract collections: ${error.message}`, 500);
    }
  }

  async extractPages(): Promise<ExtractedPage[]> {
    if (!this.shopify) {
      throw createError('Shopify client not initialized', 500);
    }

    try {
      const pages = await this.shopify.page.list({ limit: 250 });

      return pages.map((page) => ({
        title: page.title,
        content: page.body_html || '',
        handle: page.handle,
        url: `https://${this.shopName}.myshopify.com/pages/${page.handle}`,
        metadata: {
          id: page.id,
          author: page.author,
          createdAt: page.created_at,
          updatedAt: page.updated_at,
          publishedAt: page.published_at,
        },
      }));
    } catch (error: any) {
      throw createError(`Failed to extract pages: ${error.message}`, 500);
    }
  }

  async extractShippingZones(): Promise<any[]> {
    if (!this.shopify) {
      throw createError('Shopify client not initialized', 500);
    }

    try {
      // Note: Shopify API doesn't have direct shipping zone endpoint in older versions
      // This would need GraphQL API or REST Admin API with proper scope
      return [];
    } catch (error: any) {
      console.error('Failed to extract shipping zones:', error.message);
      return [];
    }
  }

  async extractPolicies(): Promise<any> {
    if (!this.shopify) {
      throw createError('Shopify client not initialized', 500);
    }

    try {
      const shop: any = await this.shopify.shop.get();

      return {
        refundPolicy: shop.refund_policy,
        privacyPolicy: shop.privacy_policy,
        termsOfService: shop.terms_of_service,
        shippingPolicy: shop.shipping_policy,
      };
    } catch (error: any) {
      console.error('Failed to extract policies:', error.message);
      return {};
    }
  }

  private extractShortDescription(html: string): string {
    const text = this.stripHtml(html);
    return text.substring(0, 200) + (text.length > 200 ? '...' : '');
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  async disconnect(): Promise<void> {
    this.shopify = null;
  }
}

export default new ShopifyAdapterService();
