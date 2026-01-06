/**
 * Sync Shopify data for production store to ensure accurate prices
 * Run with: npx ts-node scripts/sync-production.ts
 */
import { ShopifyExtractionService } from '../src/services/shopify-api.service';
import dotenv from 'dotenv';

dotenv.config();

const PRODUCTION_STORE_ID = '62130715-ff42-4160-934e-c663fc1e7872';

async function syncProduction() {
  try {
    console.log('🔄 Starting Shopify sync for production store...\n');
    console.log(`Store ID: ${PRODUCTION_STORE_ID}`);
    console.log('This will fetch the latest product data including accurate prices.\n');

    await ShopifyExtractionService.extractStoreData(PRODUCTION_STORE_ID);

    console.log('\n✅ Sync completed successfully!');
    console.log('All prices are now up-to-date with Shopify.\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

syncProduction();
