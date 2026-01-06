/**
 * Create API key for Zoroh store
 */
import { pool } from '../src/config/database';
import { randomBytes } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

async function createApiKey() {
  try {
    const storeId = '77e65b2a-ce51-4e64-a75e-0d3d5a4b4b84'; // Zoroh store

    console.log('🔑 Creating API key for Zoroh store...\n');

    // Generate a secure API key and secret
    const apiKey = 'sk_' + randomBytes(30).toString('hex'); // 'sk_' (3) + 60 hex chars = 63 chars total
    const apiSecret = randomBytes(64).toString('hex'); // 128 hex chars for secret

    // Check if API key already exists
    const existingResult = await pool.query(
      'SELECT api_key FROM widget_api_keys WHERE store_id = $1 AND is_active = true',
      [storeId]
    );

    if (existingResult.rows.length > 0) {
      console.log('✅ API key already exists for this store:');
      console.log(`   ${existingResult.rows[0].api_key}\n`);
      process.exit(0);
    }

    // Insert API key
    await pool.query(
      `INSERT INTO widget_api_keys (store_id, key_name, api_key, api_secret, is_active, created_at)
       VALUES ($1, $2, $3, $4, true, NOW())`,
      [storeId, 'Production Widget Key', apiKey, apiSecret]
    );

    console.log('✅ API key created successfully!\n');
    console.log(`Store ID: ${storeId}`);
    console.log(`API Key:  ${apiKey}`);
    console.log(`API Secret: ${apiSecret}\n`);
    console.log('🎉 The widget should now work on https://zorohshop.shop\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error creating API key:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createApiKey();
