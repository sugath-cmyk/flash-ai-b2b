import axios from 'axios';
import { load } from 'cheerio';

export enum Platform {
  SHOPIFY = 'shopify',
  WOOCOMMERCE = 'woocommerce',
  BIGCOMMERCE = 'bigcommerce',
  MAGENTO = 'magento',
  CUSTOM = 'custom'
}

export interface PlatformDetectionResult {
  platform: Platform;
  confidence: number; // 0-100
  indicators: string[];
}

export class PlatformDetectorService {
  async detectPlatform(url: string): Promise<PlatformDetectionResult> {
    try {
      const normalizedUrl = this.normalizeUrl(url);
      const indicators: string[] = [];
      let detectedPlatform: Platform = Platform.CUSTOM;
      let confidence = 0;

      // Make HTTP request
      const response = await axios.get(normalizedUrl, {
        timeout: 10000,
        validateStatus: () => true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const html = response.data;
      const headers = response.headers;

      // Check Shopify
      const shopifyScore = this.checkShopify(html, headers, indicators);
      if (shopifyScore > confidence) {
        confidence = shopifyScore;
        detectedPlatform = Platform.SHOPIFY;
      }

      // Check WooCommerce
      const wooScore = this.checkWooCommerce(html, indicators);
      if (wooScore > confidence) {
        confidence = wooScore;
        detectedPlatform = Platform.WOOCOMMERCE;
      }

      // Check BigCommerce
      const bigCommerceScore = this.checkBigCommerce(html, headers, indicators);
      if (bigCommerceScore > confidence) {
        confidence = bigCommerceScore;
        detectedPlatform = Platform.BIGCOMMERCE;
      }

      // Check Magento
      const magentoScore = this.checkMagento(html, indicators);
      if (magentoScore > confidence) {
        confidence = magentoScore;
        detectedPlatform = Platform.MAGENTO;
      }

      return {
        platform: detectedPlatform,
        confidence,
        indicators,
      };
    } catch (error: any) {
      throw new Error(`Failed to detect platform: ${error.message}`);
    }
  }

  private checkShopify(html: string, headers: any, indicators: string[]): number {
    let score = 0;

    // Check headers
    if (headers['x-shopify-stage']) {
      score += 40;
      indicators.push('Shopify stage header');
    }

    if (headers['x-shopid']) {
      score += 30;
      indicators.push('Shopify ID header');
    }

    // Check HTML content
    if (html.includes('cdn.shopify.com')) {
      score += 25;
      indicators.push('Shopify CDN');
    }

    if (html.includes('Shopify.theme') || html.includes('Shopify.shop')) {
      score += 20;
      indicators.push('Shopify theme object');
    }

    if (html.includes('shopify-section')) {
      score += 15;
      indicators.push('Shopify sections');
    }

    // Check meta tags
    const $ = load(html);
    const generator = $('meta[name="generator"]').attr('content')?.toLowerCase();
    if (generator?.includes('shopify')) {
      score += 30;
      indicators.push('Shopify generator tag');
    }

    return Math.min(score, 100);
  }

  private checkWooCommerce(html: string, indicators: string[]): number {
    let score = 0;

    if (html.includes('woocommerce') || html.includes('WooCommerce')) {
      score += 30;
      indicators.push('WooCommerce mentions');
    }

    if (html.includes('wp-content/plugins/woocommerce')) {
      score += 40;
      indicators.push('WooCommerce plugin path');
    }

    if (html.includes('wc-')) {
      score += 20;
      indicators.push('WooCommerce CSS classes');
    }

    if (html.includes('wp-content') || html.includes('wordpress')) {
      score += 15;
      indicators.push('WordPress detected');
    }

    const $ = load(html);
    const generator = $('meta[name="generator"]').attr('content')?.toLowerCase();
    if (generator?.includes('woocommerce')) {
      score += 30;
      indicators.push('WooCommerce generator tag');
    }

    return Math.min(score, 100);
  }

  private checkBigCommerce(html: string, headers: any, indicators: string[]): number {
    let score = 0;

    if (headers['x-bc-store-hash']) {
      score += 50;
      indicators.push('BigCommerce store hash header');
    }

    if (html.includes('bigcommerce.com')) {
      score += 30;
      indicators.push('BigCommerce domain');
    }

    if (html.includes('cdn.bcapp.dev') || html.includes('cdn11.bigcommerce.com')) {
      score += 25;
      indicators.push('BigCommerce CDN');
    }

    if (html.includes('stencil-utils')) {
      score += 20;
      indicators.push('BigCommerce Stencil');
    }

    return Math.min(score, 100);
  }

  private checkMagento(html: string, indicators: string[]): number {
    let score = 0;

    if (html.includes('Mage.') || html.includes('Magento')) {
      score += 30;
      indicators.push('Magento JS object');
    }

    if (html.includes('mage/cookies') || html.includes('magento')) {
      score += 25;
      indicators.push('Magento paths');
    }

    if (html.includes('catalog/product/view')) {
      score += 20;
      indicators.push('Magento URL structure');
    }

    const $ = load(html);
    const generator = $('meta[name="generator"]').attr('content')?.toLowerCase();
    if (generator?.includes('magento')) {
      score += 35;
      indicators.push('Magento generator tag');
    }

    return Math.min(score, 100);
  }

  normalizeUrl(url: string): string {
    // Remove trailing slash
    let normalized = url.replace(/\/$/, '');

    // Add https if no protocol
    if (!normalized.startsWith('http')) {
      normalized = 'https://' + normalized;
    }

    return normalized;
  }

  extractDomain(url: string): string {
    try {
      const urlObj = new URL(this.normalizeUrl(url));
      return urlObj.hostname.replace(/^www\./, '');
    } catch (error) {
      // Fallback regex
      const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
      return match ? match[1] : url;
    }
  }

  validateUrl(url: string): boolean {
    try {
      new URL(this.normalizeUrl(url));
      return true;
    } catch {
      return false;
    }
  }

  extractShopifyDomain(url: string): string | null {
    const domain = this.extractDomain(url);

    // Check if it's a myshopify.com domain
    if (domain.endsWith('.myshopify.com')) {
      return domain.replace('.myshopify.com', '');
    }

    // For custom domains, return the full domain
    return domain;
  }
}

export default new PlatformDetectorService();
