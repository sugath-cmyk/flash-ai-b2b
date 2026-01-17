import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Check for database configuration
if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
  console.warn('⚠️  WARNING: No database configuration found (DATABASE_URL or DB_HOST)');
  console.warn('⚠️  Database-dependent features will not work');
}

// Railway and other cloud providers use DATABASE_URL
// For local development, use individual environment variables
const poolConfig: PoolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // Increased to 10s for cloud cold starts
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'flash_ai_b2b',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // Increased to 10s for cloud cold starts
    };

// Create PostgreSQL connection pool
export const pool = new Pool(poolConfig);

// Test database connection
pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  // Log the error but DON'T crash the server - let it try to recover
  console.error('❌ Database pool error (will attempt recovery):', err.message);
  // Only exit on truly fatal errors like invalid credentials
  if (err.message.includes('password authentication failed') ||
      err.message.includes('database') && err.message.includes('does not exist')) {
    console.error('💀 Fatal database error - exiting');
    process.exit(-1);
  }
});

// Helper function to execute queries
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

export default pool;
