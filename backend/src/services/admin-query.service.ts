import { pool } from '../config/database';
import queryCacheService from './query-cache.service';

/**
 * Admin Query Service
 * Provides comprehensive query analytics and search for Flash AI Admin
 */

interface QueryFilters {
  storeId: string;
  startDate?: Date;
  endDate?: Date;
  category?: string;
  searchTerm?: string;
  sentiment?: string;
  page?: number;
  limit?: number;
}

interface PopularQuery {
  query: string;
  count: number;
  category: string;
  avgResponseTime?: number;
  topics: string[];
}

interface CategoryStats {
  category: string;
  count: number;
  percentage: number;
  topQueries: Array<{ query: string; count: number }>;
}

export class AdminQueryService {
  /**
   * Search and filter queries with pagination
   */
  async searchQueries(filters: QueryFilters): Promise<any> {
    try {
      const {
        storeId,
        startDate,
        endDate,
        category,
        searchTerm,
        sentiment,
        page = 1,
        limit = 50
      } = filters;

      const offset = (page - 1) * limit;

      // Build WHERE conditions
      const conditions: string[] = ['wm.store_id = $1', 'wm.role = $2'];
      const params: any[] = [storeId, 'user'];
      let paramIndex = 3;

      if (startDate) {
        conditions.push(`wm.created_at >= $${paramIndex}`);
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        conditions.push(`wm.created_at <= $${paramIndex}`);
        params.push(endDate);
        paramIndex++;
      }

      if (category) {
        conditions.push(`wm.query_category = $${paramIndex}`);
        params.push(category);
        paramIndex++;
      }

      if (searchTerm) {
        conditions.push(`wm.content ILIKE $${paramIndex}`);
        params.push(`%${searchTerm}%`);
        paramIndex++;
      }

      if (sentiment) {
        conditions.push(`wm.sentiment = $${paramIndex}`);
        params.push(sentiment);
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total
         FROM widget_messages wm
         WHERE ${whereClause}`,
        params
      );

      const total = parseInt(countResult.rows[0].total);

      // Get paginated results with conversation and response info
      params.push(limit, offset);

      const result = await pool.query(
        `SELECT
           wm.id,
           wm.conversation_id,
           wm.content as query,
           wm.query_category as category,
           wm.query_topics as topics,
           wm.query_intent as intent,
           wm.sentiment,
           wm.created_at,
           wm.cached_from,
           wm.cache_key,
           wc.session_id,
           wc.visitor_id,
           wc.rating,
           wc.tags,
           (SELECT content FROM widget_messages
            WHERE conversation_id = wm.conversation_id
              AND role = 'assistant'
              AND created_at > wm.created_at
            ORDER BY created_at ASC
            LIMIT 1
           ) as response,
           (SELECT tokens FROM widget_messages
            WHERE conversation_id = wm.conversation_id
              AND role = 'assistant'
              AND created_at > wm.created_at
            ORDER BY created_at ASC
            LIMIT 1
           ) as tokens
         FROM widget_messages wm
         LEFT JOIN widget_conversations wc ON wm.conversation_id = wc.id
         WHERE ${whereClause}
         ORDER BY wm.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        params
      );

      return {
        queries: result.rows.map(row => ({
          id: row.id,
          conversationId: row.conversation_id,
          sessionId: row.session_id,
          visitorId: row.visitor_id,
          query: row.query,
          response: row.response,
          category: row.category,
          topics: row.topics || [],
          intent: row.intent,
          sentiment: row.sentiment,
          cached: row.cached_from !== null,
          tokens: row.tokens || 0,
          rating: row.rating,
          tags: row.tags || [],
          createdAt: row.created_at
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error: any) {
      console.error('Error searching queries:', error.message);
      throw error;
    }
  }

  /**
   * Get popular queries (most frequently asked)
   */
  async getPopularQueries(
    storeId: string,
    days: number = 30,
    limit: number = 20,
    category?: string
  ): Promise<PopularQuery[]> {
    try {
      const sinceDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

      const conditions = ['store_id = $1', 'role = $2', 'created_at >= $3'];
      const params: any[] = [storeId, 'user', sinceDate];

      if (category) {
        conditions.push('query_category = $4');
        params.push(category);
      }

      const whereClause = conditions.join(' AND ');
      params.push(limit);

      const result = await pool.query(
        `SELECT
           content as query,
           query_category as category,
           query_topics as topics,
           COUNT(*) as count
         FROM widget_messages
         WHERE ${whereClause}
         GROUP BY content, query_category, query_topics
         ORDER BY count DESC, content
         LIMIT $${params.length}`,
        params
      );

      return result.rows.map(row => ({
        query: row.query,
        count: parseInt(row.count),
        category: row.category || 'general',
        topics: row.topics || []
      }));
    } catch (error: any) {
      console.error('Error getting popular queries:', error.message);
      throw error;
    }
  }

  /**
   * Get query breakdown by category
   */
  async getCategoryBreakdown(
    storeId: string,
    days: number = 30
  ): Promise<CategoryStats[]> {
    try {
      const sinceDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

      // Get category counts
      const categoryResult = await pool.query(
        `SELECT
           COALESCE(query_category, 'general') as category,
           COUNT(*) as count
         FROM widget_messages
         WHERE store_id = $1
           AND role = 'user'
           AND created_at >= $2
         GROUP BY query_category
         ORDER BY count DESC`,
        [storeId, sinceDate]
      );

      const totalQueries = categoryResult.rows.reduce(
        (sum, row) => sum + parseInt(row.count),
        0
      );

      // For each category, get top queries
      const categories: CategoryStats[] = [];

      for (const row of categoryResult.rows) {
        const category = row.category;
        const count = parseInt(row.count);
        const percentage = totalQueries > 0 ? (count / totalQueries) * 100 : 0;

        // Get top 3 queries for this category
        const topQueriesResult = await pool.query(
          `SELECT
             content as query,
             COUNT(*) as query_count
           FROM widget_messages
           WHERE store_id = $1
             AND role = 'user'
             AND COALESCE(query_category, 'general') = $2
             AND created_at >= $3
           GROUP BY content
           ORDER BY query_count DESC
           LIMIT 3`,
          [storeId, category, sinceDate]
        );

        categories.push({
          category,
          count,
          percentage: Math.round(percentage * 10) / 10,
          topQueries: topQueriesResult.rows.map(q => ({
            query: q.query,
            count: parseInt(q.query_count)
          }))
        });
      }

      return categories;
    } catch (error: any) {
      console.error('Error getting category breakdown:', error.message);
      throw error;
    }
  }

  /**
   * Get full conversation details with all messages
   */
  async getConversationDetails(conversationId: string, storeId: string): Promise<any> {
    try {
      // Get conversation metadata
      const convResult = await pool.query(
        `SELECT * FROM widget_conversations WHERE id = $1 AND store_id = $2`,
        [conversationId, storeId]
      );

      if (convResult.rows.length === 0) {
        throw new Error('Conversation not found');
      }

      const conversation = convResult.rows[0];

      // Get all messages
      const messagesResult = await pool.query(
        `SELECT
           id,
           role,
           content,
           query_category,
           query_topics,
           query_intent,
           sentiment,
           cached_from,
           cache_key,
           model,
           tokens,
           created_at
         FROM widget_messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC`,
        [conversationId]
      );

      return {
        conversation: {
          id: conversation.id,
          storeId: conversation.store_id,
          sessionId: conversation.session_id,
          visitorId: conversation.visitor_id,
          status: conversation.status,
          rating: conversation.rating,
          feedbackText: conversation.feedback_text,
          tags: conversation.tags || [],
          totalMessages: conversation.total_messages || messagesResult.rows.length,
          resolutionStatus: conversation.resolution_status,
          createdAt: conversation.created_at,
          updatedAt: conversation.updated_at,
          resolvedAt: conversation.resolved_at
        },
        messages: messagesResult.rows.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          category: msg.query_category,
          topics: msg.query_topics || [],
          intent: msg.query_intent,
          sentiment: msg.sentiment,
          cached: msg.cached_from !== null,
          cacheKey: msg.cache_key,
          model: msg.model,
          tokens: msg.tokens || 0,
          createdAt: msg.created_at
        }))
      };
    } catch (error: any) {
      console.error('Error getting conversation details:', error.message);
      throw error;
    }
  }

  /**
   * Export queries to CSV or JSON format
   */
  async exportQueries(filters: QueryFilters, format: 'csv' | 'json'): Promise<string> {
    try {
      // Get all matching queries (no pagination for export)
      const data = await this.searchQueries({
        ...filters,
        page: 1,
        limit: 10000 // Max export limit
      });

      if (format === 'csv') {
        return this.generateCSV(data.queries);
      } else {
        return JSON.stringify({
          exportDate: new Date().toISOString(),
          storeId: filters.storeId,
          filters,
          totalRecords: data.total,
          queries: data.queries
        }, null, 2);
      }
    } catch (error: any) {
      console.error('Error exporting queries:', error.message);
      throw error;
    }
  }

  /**
   * Generate CSV format from query data
   */
  private generateCSV(queries: any[]): string {
    const headers = [
      'Date',
      'Time',
      'Session',
      'Query',
      'Response',
      'Category',
      'Topics',
      'Intent',
      'Sentiment',
      'Cached',
      'Tokens',
      'Rating'
    ];

    const rows = queries.map(q => {
      const date = new Date(q.createdAt);
      return [
        date.toISOString().split('T')[0],
        date.toISOString().split('T')[1].split('.')[0],
        q.sessionId || '',
        this.escapeCSV(q.query),
        this.escapeCSV(q.response || ''),
        q.category || '',
        q.topics.join('; '),
        q.intent || '',
        q.sentiment || '',
        q.cached ? 'Yes' : 'No',
        q.tokens,
        q.rating || ''
      ];
    });

    const csvLines = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ];

    return csvLines.join('\n');
  }

  /**
   * Escape CSV values
   */
  private escapeCSV(value: string): string {
    if (!value) return '';
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    const escaped = value.replace(/"/g, '""');
    if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
      return `"${escaped}"`;
    }
    return escaped;
  }

  /**
   * Get overall query statistics
   */
  async getQueryStats(storeId: string, days: number = 30): Promise<any> {
    try {
      const sinceDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

      // Total queries
      const totalResult = await pool.query(
        `SELECT COUNT(*) as total
         FROM widget_messages
         WHERE store_id = $1 AND role = 'user' AND created_at >= $2`,
        [storeId, sinceDate]
      );

      // Cached queries
      const cachedResult = await pool.query(
        `SELECT COUNT(*) as cached
         FROM widget_messages
         WHERE store_id = $1 AND role = 'assistant' AND cached_from IS NOT NULL AND created_at >= $2`,
        [storeId, sinceDate]
      );

      // Average tokens per query
      const tokensResult = await pool.query(
        `SELECT AVG(tokens) as avg_tokens
         FROM widget_messages
         WHERE store_id = $1 AND role = 'assistant' AND cached_from IS NULL AND created_at >= $2`,
        [storeId, sinceDate]
      );

      // Conversations
      const conversationsResult = await pool.query(
        `SELECT COUNT(*) as total, AVG(total_messages) as avg_messages
         FROM widget_conversations
         WHERE store_id = $1 AND created_at >= $2`,
        [storeId, sinceDate]
      );

      // Get cache stats
      const cacheStats = await queryCacheService.getCacheStats(storeId, days);

      const totalQueries = parseInt(totalResult.rows[0].total);
      const cachedQueries = parseInt(cachedResult.rows[0].cached);

      return {
        totalQueries,
        uniqueConversations: parseInt(conversationsResult.rows[0].total),
        avgMessagesPerConversation: Math.round(parseFloat(conversationsResult.rows[0].avg_messages || 0) * 10) / 10,
        cacheHitRate: totalQueries > 0 ? Math.round((cachedQueries / totalQueries) * 100) / 100 : 0,
        avgTokensPerQuery: Math.round(parseFloat(tokensResult.rows[0].avg_tokens || 0)),
        cacheStats,
        timeRange: {
          start: sinceDate.toISOString(),
          end: new Date().toISOString(),
          days
        }
      };
    } catch (error: any) {
      console.error('Error getting query stats:', error.message);
      throw error;
    }
  }
}

export default new AdminQueryService();
