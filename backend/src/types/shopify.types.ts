// Shopify Integration Types

export interface ShopifyOAuthState {
  id: string;
  state_token: string;
  user_id: string;
  shop_domain: string;
  redirect_uri?: string;
  scopes: string;
  expires_at: Date;
  used: boolean;
  created_at: Date;
}

export interface ShopifyStore {
  id: string;
  user_id: string;
  platform: string;
  store_url: string;
  store_name?: string;
  domain?: string;
  shopify_shop_domain?: string;
  shopify_access_token?: string;
  shopify_scopes?: string;
  shopify_installed_at?: Date;
  auto_sync_enabled?: boolean;
  sync_frequency?: string;
  sync_status?: string;
  last_sync?: Date;
  metadata?: any;
  created_at: Date;
  updated_at: Date;
}

export interface ShopifyAccessTokenResponse {
  access_token: string;
  scope: string;
}

export interface ShopifyShop {
  id: number;
  name: string;
  email: string;
  domain: string;
  myshopify_domain: string;
  currency: string;
  timezone: string;
  shop_owner: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  country_name?: string;
  zip?: string;
  money_format?: string;
  plan_name?: string;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  created_at: string;
  updated_at: string;
  published_at: string;
  handle: string;
  tags: string;
  status: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  options: ShopifyOption[];
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  position: number;
  inventory_quantity: number;
  compare_at_price?: string;
  barcode?: string;
  weight?: number;
  weight_unit?: string;
  image_id?: number;
}

export interface ShopifyImage {
  id: number;
  product_id: number;
  position: number;
  src: string;
  width: number;
  height: number;
  alt?: string;
}

export interface ShopifyOption {
  id: number;
  product_id: number;
  name: string;
  position: number;
  values: string[];
}

export interface ShopifyCollection {
  id: number;
  handle: string;
  title: string;
  body_html?: string;
  sort_order?: string;
  image?: {
    src: string;
    alt?: string;
  };
  published_at?: string;
  updated_at: string;
}

export interface ShopifyPage {
  id: number;
  title: string;
  body_html: string;
  handle: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  shop_id: number;
}

export interface ShopifyWebhook {
  id: number;
  topic: string;
  address: string;
  format: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookSubscription {
  id: string;
  store_id: string;
  webhook_id: string;
  topic: string;
  address: string;
  format: string;
  status: string;
  last_triggered?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookEvent {
  id: string;
  store_id: string;
  topic: string;
  webhook_id: string;
  payload: any;
  headers?: any;
  processed: boolean;
  error_message?: string;
  created_at: Date;
  processed_at?: Date;
}

export const SHOPIFY_SCOPES = [
  'read_products',
  'write_products',
  'read_product_listings',
  'read_collections',
  'read_inventory',
  'read_customers',
  'read_orders',
  'read_content',
  'read_themes',
  'read_price_rules',
  'read_discounts',
  'read_analytics',
  'read_shop_data',
];

export const WEBHOOK_TOPICS = [
  'products/create',
  'products/update',
  'products/delete',
  'collections/create',
  'collections/update',
  'collections/delete',
  'orders/create',
  'orders/updated',
  'customers/create',
  'customers/update',
] as const;

export type WebhookTopic = typeof WEBHOOK_TOPICS[number];
