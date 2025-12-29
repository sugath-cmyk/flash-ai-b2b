import { pool } from '../config/database';
import productIntelligenceService from '../services/product-intelligence.service';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Analyze Products Script
 * Extracts comprehensive product intelligence using AI
 *
 * Usage:
 * - Analyze all products for a store: npx ts-node src/scripts/analyze-products.ts <store-id>
 * - Analyze specific number: npx ts-node src/scripts/analyze-products.ts <store-id> 10
 * - Analyze single product: npx ts-node src/scripts/analyze-products.ts product <product-id>
 */

async function main() {
  try {
    const command = process.argv[2];
    const id = process.argv[3];
    const limit = process.argv[4] ? parseInt(process.argv[4]) : undefined;

    if (!command) {
      console.error('❌ Usage: npx ts-node src/scripts/analyze-products.ts <store-id> [limit]');
      console.error('   Or: npx ts-node src/scripts/analyze-products.ts product <product-id>');
      process.exit(1);
    }

    if (command === 'product') {
      // Analyze single product
      if (!id) {
        console.error('❌ Product ID required');
        process.exit(1);
      }

      console.log(`🧬 Analyzing product ${id}...\n`);

      const result = await productIntelligenceService.analyzeProduct(id);

      console.log('\n✅ Analysis Complete!\n');
      console.log('📊 Results:');
      console.log(`  Ingredients: ${result.ingredients.length} found`);
      console.log(`  Benefits: ${result.keyBenefits.join(', ')}`);
      console.log(`  Skin Types: ${result.skinTypes.join(', ')}`);
      console.log(`  Concerns: ${result.concerns.join(', ')}`);
      console.log(`  Category: ${result.productCategory} (${result.productSubcategory})`);
      console.log(`  Texture: ${result.texture}`);
      console.log(`  Usage: ${result.usageFrequency} (${result.usageTime.join('/')})`);
      console.log(`  Results: ${result.resultsTimeline}`);
      console.log(`  Vegan: ${result.isVegan ? 'Yes' : 'No'}`);
      console.log(`  Cruelty-Free: ${result.isCrueltyFree ? 'Yes' : 'No'}`);
      console.log(`  Pregnancy Safe: ${result.isPregnancySafe === null ? 'Unknown' : result.isPregnancySafe ? 'Yes' : 'No'}`);
      console.log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);

      if (result.ingredients.length > 0) {
        console.log(`\n  Key Ingredients:`);
        result.ingredients.slice(0, 5).forEach((ing, i) => {
          console.log(`    ${i + 1}. ${ing}`);
        });
      }
    } else {
      // Analyze store products
      const storeId = command;

      console.log('🧬 Product Intelligence Extraction\n');
      console.log('Store ID:', storeId);

      if (limit) {
        console.log(`Limit: ${limit} products`);
      } else {
        console.log('Analyzing ALL unanalyzed products');
      }

      // Check if store exists
      const storeResult = await pool.query(
        'SELECT id, store_name, domain FROM stores WHERE id = $1',
        [storeId]
      );

      if (storeResult.rows.length === 0) {
        console.error('❌ Store not found');
        process.exit(1);
      }

      console.log('Store:', storeResult.rows[0].store_name || storeResult.rows[0].domain);

      // Count products
      const countResult = await pool.query(
        `SELECT
           COUNT(*) as total,
           COUNT(*) FILTER (WHERE ingredients IS NOT NULL) as analyzed,
           COUNT(*) FILTER (WHERE ingredients IS NULL) as pending
         FROM extracted_products WHERE store_id = $1`,
        [storeId]
      );

      const counts = countResult.rows[0];
      console.log(`\nProducts: ${counts.total} total, ${counts.analyzed} analyzed, ${counts.pending} pending\n`);

      if (counts.pending === '0') {
        console.log('✅ All products already analyzed!');
        process.exit(0);
      }

      console.log('Starting analysis...\n');

      // Run analysis
      await productIntelligenceService.analyzeStoreProducts(storeId, limit);

      console.log('\n✅ All done!');
    }

    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

main();
