import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('❌ Too many Redis reconnection attempts');
        return new Error('Too many retries');
      }
      return retries * 100; // Exponential backoff
    }
  }
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis error:', err);
});

redisClient.on('reconnecting', () => {
  console.log('🔄 Redis reconnecting...');
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
  }
})();

// Helper functions for common operations
export const cacheGet = async (key: string): Promise<string | null> => {
  try {
    return await redisClient.get(key);
  } catch (error) {
    console.error('Redis GET error:', error);
    return null;
  }
};

export const cacheSet = async (key: string, value: string, expirationSeconds?: number): Promise<void> => {
  try {
    if (expirationSeconds) {
      await redisClient.setEx(key, expirationSeconds, value);
    } else {
      await redisClient.set(key, value);
    }
  } catch (error) {
    console.error('Redis SET error:', error);
  }
};

export const cacheDel = async (key: string): Promise<void> => {
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error('Redis DEL error:', error);
  }
};

// ============================================================================
// ANALYTICS CACHING HELPERS
// ============================================================================

/**
 * Cache popular queries result (5 minute TTL for frequent updates)
 */
export const cachePopularQueries = async (storeId: string, data: any): Promise<void> => {
  try {
    await cacheSet(`analytics:popular_queries:${storeId}`, JSON.stringify(data), 300);
  } catch (error) {
    console.error('Error caching popular queries:', error);
  }
};

/**
 * Get cached popular queries
 */
export const getCachedPopularQueries = async (storeId: string): Promise<any | null> => {
  try {
    const cached = await cacheGet(`analytics:popular_queries:${storeId}`);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Error getting cached popular queries:', error);
    return null;
  }
};

/**
 * Cache category breakdown (5 minute TTL)
 */
export const cacheCategoryStats = async (storeId: string, data: any): Promise<void> => {
  try {
    await cacheSet(`analytics:category_stats:${storeId}`, JSON.stringify(data), 300);
  } catch (error) {
    console.error('Error caching category stats:', error);
  }
};

/**
 * Get cached category stats
 */
export const getCachedCategoryStats = async (storeId: string): Promise<any | null> => {
  try {
    const cached = await cacheGet(`analytics:category_stats:${storeId}`);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Error getting cached category stats:', error);
    return null;
  }
};

/**
 * Cache query search results (1 minute TTL for real-time feel)
 */
export const cacheQuerySearch = async (searchKey: string, data: any): Promise<void> => {
  try {
    await cacheSet(`analytics:search:${searchKey}`, JSON.stringify(data), 60);
  } catch (error) {
    console.error('Error caching query search:', error);
  }
};

/**
 * Get cached query search results
 */
export const getCachedQuerySearch = async (searchKey: string): Promise<any | null> => {
  try {
    const cached = await cacheGet(`analytics:search:${searchKey}`);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Error getting cached query search:', error);
    return null;
  }
};

/**
 * Cache overall query stats (5 minute TTL)
 */
export const cacheQueryStats = async (storeId: string, days: number, data: any): Promise<void> => {
  try {
    await cacheSet(`analytics:stats:${storeId}:${days}d`, JSON.stringify(data), 300);
  } catch (error) {
    console.error('Error caching query stats:', error);
  }
};

/**
 * Get cached query stats
 */
export const getCachedQueryStats = async (storeId: string, days: number): Promise<any | null> => {
  try {
    const cached = await cacheGet(`analytics:stats:${storeId}:${days}d`);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Error getting cached query stats:', error);
    return null;
  }
};

/**
 * Invalidate all analytics cache for a store
 */
export const invalidateAnalyticsCache = async (storeId: string): Promise<void> => {
  try {
    const pattern = `analytics:*:${storeId}*`;
    // Note: This is a simplified approach. In production, consider using Redis SCAN
    await cacheDel(`analytics:popular_queries:${storeId}`);
    await cacheDel(`analytics:category_stats:${storeId}`);
    await cacheDel(`analytics:stats:${storeId}:30d`);
    await cacheDel(`analytics:stats:${storeId}:7d`);
    console.log(`🗑️ Invalidated analytics cache for store ${storeId}`);
  } catch (error) {
    console.error('Error invalidating analytics cache:', error);
  }
};

export default redisClient;
