import { pool } from '../config/database';
import { createHash } from 'crypto';

/**
 * Query Cache Service
 * Implements intelligent response caching with similarity matching to reduce AI costs
 */

interface CachedResponse {
  id: string;
  originalQuery: string;
  responseContent: string;
  category: string | null;
  hitCount: number;
  similarity: number;
  cacheKey: string;
}

interface CacheMetadata {
  category?: string;
  topics?: string[];
  intent?: string;
  expiresIn?: number; // Seconds until expiration
}

export class QueryCacheService {
  // Default cache expiration: 7 days
  private readonly DEFAULT_CACHE_EXPIRY_DAYS = 7;

  // Default similarity threshold: 70%
  private readonly DEFAULT_SIMILARITY_THRESHOLD = 0.7;

  // Common words to remove for normalization
  private readonly commonWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'do', 'does', 'did',
    'can', 'could', 'will', 'would', 'should', 'may', 'might', 'must',
    'please', 'help', 'me', 'i', 'you', 'my', 'your', 'this', 'that'
  ]);

  /**
   * Find a cached response for a similar query
   */
  async findCachedResponse(
    storeId: string,
    query: string,
    threshold: number = this.DEFAULT_SIMILARITY_THRESHOLD
  ): Promise<CachedResponse | null> {
    try {
      // Normalize the query for comparison
      const normalizedQuery = this.normalizeQuery(query);

      // Use the database function to find similar cached queries
      const result = await pool.query(
        `SELECT * FROM find_similar_cached_queries($1, $2, $3, 1)`,
        [storeId, normalizedQuery, threshold]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      return {
        id: row.cache_id,
        originalQuery: row.original_query,
        responseContent: row.response_content,
        category: row.category,
        hitCount: row.hit_count,
        similarity: row.similarity_score,
        cacheKey: this.generateCacheKey(normalizedQuery)
      };
    } catch (error: any) {
      console.error('Error finding cached response:', error.message);
      return null;
    }
  }

  /**
   * Cache a query response for future reuse
   */
  async cacheResponse(
    storeId: string,
    query: string,
    response: string,
    metadata: CacheMetadata = {}
  ): Promise<void> {
    try {
      const normalizedQuery = this.normalizeQuery(query);
      const cacheKey = this.generateCacheKey(normalizedQuery);

      // Calculate expiration date
      const expirySeconds = metadata.expiresIn || (this.DEFAULT_CACHE_EXPIRY_DAYS * 24 * 60 * 60);
      const expiresAt = new Date(Date.now() + (expirySeconds * 1000));

      // Insert or update cache entry
      await pool.query(
        `INSERT INTO query_cache
         (store_id, cache_key, original_query, normalized_query, response_content, category, topics, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (store_id, cache_key)
         DO UPDATE SET
           response_content = EXCLUDED.response_content,
           category = EXCLUDED.category,
           topics = EXCLUDED.topics,
           expires_at = EXCLUDED.expires_at,
           updated_at = NOW()`,
        [
          storeId,
          cacheKey,
          query.trim(),
          normalizedQuery,
          response,
          metadata.category || null,
          metadata.topics || [],
          expiresAt
        ]
      );

      console.log(`✅ Cached response for query: "${query.substring(0, 50)}..."`);
    } catch (error: any) {
      console.error('Error caching response:', error.message);
      // Don't throw - caching failure shouldn't break the flow
    }
  }

  /**
   * Record a cache hit and update statistics
   */
  async recordCacheHit(cacheId: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE query_cache
         SET hit_count = hit_count + 1,
             last_hit_at = NOW()
         WHERE id = $1`,
        [cacheId]
      );
    } catch (error: any) {
      console.error('Error recording cache hit:', error.message);
      // Don't throw - stat tracking failure shouldn't break the flow
    }
  }

  /**
   * Normalize a query for consistent comparison
   * - Convert to lowercase
   * - Remove punctuation
   * - Remove common words
   * - Remove extra whitespace
   * - Sort words alphabetically (for better matching)
   */
  normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove punctuation
      .split(/\s+/) // Split into words
      .filter(word => word.length > 2 && !this.commonWords.has(word)) // Remove short words and common words
      .sort() // Sort alphabetically for consistent ordering
      .join(' ')
      .trim();
  }

  /**
   * Generate a unique cache key from normalized query
   */
  generateCacheKey(normalizedQuery: string): string {
    return createHash('md5')
      .update(normalizedQuery)
      .digest('hex');
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpiredCache(): Promise<number> {
    try {
      const result = await pool.query(
        `DELETE FROM query_cache
         WHERE expires_at IS NOT NULL AND expires_at < NOW()
         RETURNING id`
      );

      const deletedCount = result.rowCount || 0;
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned ${deletedCount} expired cache entries`);
      }

      return deletedCount;
    } catch (error: any) {
      console.error('Error cleaning expired cache:', error.message);
      return 0;
    }
  }

  /**
   * Get cache statistics for a store
   */
  async getCacheStats(storeId: string, days: number = 30): Promise<any> {
    try {
      const sinceDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

      // Get total cached responses
      const totalResult = await pool.query(
        `SELECT COUNT(*) as total
         FROM query_cache
         WHERE store_id = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
        [storeId]
      );

      // Get cache hit/miss stats from messages
      const statsResult = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE cached_from IS NOT NULL) as cache_hits,
           COUNT(*) FILTER (WHERE cached_from IS NULL AND role = 'assistant') as cache_misses,
           SUM(tokens) FILTER (WHERE cached_from IS NULL AND role = 'assistant') as tokens_used,
           SUM(tokens) FILTER (WHERE cached_from IS NOT NULL) as tokens_saved
         FROM widget_messages
         WHERE store_id = $1 AND created_at >= $2`,
        [storeId, sinceDate]
      );

      // Get top cached queries
      const topQueriesResult = await pool.query(
        `SELECT original_query, hit_count, category
         FROM query_cache
         WHERE store_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY hit_count DESC
         LIMIT 10`,
        [storeId]
      );

      const stats = statsResult.rows[0];
      const cacheHits = parseInt(stats.cache_hits || 0);
      const cacheMisses = parseInt(stats.cache_misses || 0);
      const totalQueries = cacheHits + cacheMisses;

      const cacheHitRate = totalQueries > 0 ? cacheHits / totalQueries : 0;

      // Estimate cost savings (Claude Sonnet 4.5 pricing: ~$3 per 1M input tokens, ~$15 per 1M output tokens)
      // Average: ~$9 per 1M tokens
      const tokensSaved = parseInt(stats.tokens_saved || 0);
      const estimatedDollarsSaved = (tokensSaved / 1000000) * 9;

      return {
        totalCachedResponses: parseInt(totalResult.rows[0].total || 0),
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
        cacheHitCount: cacheHits,
        cacheMissCount: cacheMisses,
        costSavings: {
          tokensSaved,
          estimatedDollarsSaved: Math.round(estimatedDollarsSaved * 100) / 100
        },
        topCachedQueries: topQueriesResult.rows.map(row => ({
          query: row.original_query,
          hitCount: row.hit_count,
          category: row.category
        }))
      };
    } catch (error: any) {
      console.error('Error getting cache stats:', error.message);
      throw error;
    }
  }

  /**
   * Invalidate cache for a specific store (useful for store updates)
   */
  async invalidateStoreCache(storeId: string): Promise<number> {
    try {
      const result = await pool.query(
        `DELETE FROM query_cache WHERE store_id = $1 RETURNING id`,
        [storeId]
      );

      const deletedCount = result.rowCount || 0;
      console.log(`🗑️ Invalidated ${deletedCount} cache entries for store ${storeId}`);

      return deletedCount;
    } catch (error: any) {
      console.error('Error invalidating cache:', error.message);
      return 0;
    }
  }

  /**
   * Get similar queries for analysis (useful for admin dashboard)
   */
  async getSimilarQueries(
    storeId: string,
    query: string,
    limit: number = 5
  ): Promise<Array<{ query: string; similarity: number }>> {
    try {
      const normalizedQuery = this.normalizeQuery(query);

      const result = await pool.query(
        `SELECT * FROM find_similar_cached_queries($1, $2, 0.5, $3)`,
        [storeId, normalizedQuery, limit]
      );

      return result.rows.map(row => ({
        query: row.original_query,
        similarity: row.similarity_score
      }));
    } catch (error: any) {
      console.error('Error getting similar queries:', error.message);
      return [];
    }
  }
}

export default new QueryCacheService();
