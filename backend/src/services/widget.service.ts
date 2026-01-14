import { pool } from '../config/database';
import { createError } from '../middleware/errorHandler';
import crypto from 'crypto';

interface WidgetConfig {
  widgetName?: string;
  enabled?: boolean;
  primaryColor?: string;
  position?: string;
  greetingMessage?: string;
  placeholderText?: string;
  autoOpen?: boolean;
  showBranding?: boolean;
  responseTone?: string;
  enableProductSearch?: boolean;
  enableRecommendations?: boolean;
  enableOrderTracking?: boolean;
  logoUrl?: string;
  companyName?: string;
}

export class WidgetService {
  // Get widget configuration for a store
  async getConfig(storeId: string, userId: string): Promise<any> {
    // Verify store ownership
    const storeCheck = await pool.query(
      'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
      [storeId, userId]
    );

    if (storeCheck.rows.length === 0) {
      throw createError('Store not found', 404);
    }

    let result = await pool.query(
      'SELECT * FROM widget_configs WHERE store_id = $1',
      [storeId]
    );

    // Create default config if none exists
    if (result.rows.length === 0) {
      await pool.query(
        `INSERT INTO widget_configs (store_id) VALUES ($1)`,
        [storeId]
      );

      result = await pool.query(
        'SELECT * FROM widget_configs WHERE store_id = $1',
        [storeId]
      );
    }

    return result.rows[0];
  }

  // Get widget configuration for public API (no ownership check)
  async getConfigPublic(storeId: string): Promise<any> {
    let result = await pool.query(
      'SELECT * FROM widget_configs WHERE store_id = $1',
      [storeId]
    );

    // Create default config if none exists
    if (result.rows.length === 0) {
      await pool.query(
        `INSERT INTO widget_configs (store_id) VALUES ($1)`,
        [storeId]
      );

      result = await pool.query(
        'SELECT * FROM widget_configs WHERE store_id = $1',
        [storeId]
      );
    }

    return result.rows[0];
  }

  // Update widget configuration
  async updateConfig(storeId: string, userId: string, config: WidgetConfig): Promise<any> {
    // Verify store ownership
    const storeCheck = await pool.query(
      'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
      [storeId, userId]
    );

    if (storeCheck.rows.length === 0) {
      throw createError('Store not found', 404);
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(config).forEach(([key, value]) => {
      if (value !== undefined) {
        // Convert camelCase to snake_case
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        updates.push(`${snakeKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      throw createError('No valid updates provided', 400);
    }

    values.push(storeId);
    const query = `
      UPDATE widget_configs
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE store_id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  // Generate API key for widget authentication
  async generateApiKey(storeId: string, userId: string, keyName: string): Promise<{ apiKey: string; apiSecret: string }> {
    // Verify store ownership
    const storeCheck = await pool.query(
      'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
      [storeId, userId]
    );

    if (storeCheck.rows.length === 0) {
      throw createError('Store not found', 404);
    }

    // Generate secure API key and secret
    const apiKey = 'sk_' + crypto.randomBytes(24).toString('hex');
    const apiSecret = crypto.randomBytes(48).toString('hex');

    // Hash the secret for storage
    const secretHash = crypto
      .createHash('sha256')
      .update(apiSecret)
      .digest('hex');

    await pool.query(
      `INSERT INTO widget_api_keys (store_id, key_name, api_key, api_secret)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (store_id, key_name)
       DO UPDATE SET api_key = EXCLUDED.api_key, api_secret = EXCLUDED.api_secret, created_at = CURRENT_TIMESTAMP`,
      [storeId, keyName, apiKey, secretHash]
    );

    // Return the unhashed secret only once (user must save it)
    return { apiKey, apiSecret };
  }

  // Get API keys for a store
  async getApiKeys(storeId: string, userId: string): Promise<any[]> {
    // Verify store ownership
    const storeCheck = await pool.query(
      'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
      [storeId, userId]
    );

    if (storeCheck.rows.length === 0) {
      throw createError('Store not found', 404);
    }

    const result = await pool.query(
      `SELECT id, key_name, api_key, is_active, last_used_at, expires_at, created_at
       FROM widget_api_keys
       WHERE store_id = $1
       ORDER BY created_at DESC`,
      [storeId]
    );

    return result.rows;
  }

  // Get active API key for a store (public, no auth check)
  async getActiveApiKey(storeId: string): Promise<any[]> {
    const result = await pool.query(
      `SELECT api_key, key_name, created_at
       FROM widget_api_keys
       WHERE store_id = $1 AND is_active = true
       ORDER BY created_at DESC
       LIMIT 1`,
      [storeId]
    );

    return result.rows;
  }

  // Verify API key (for widget authentication)
  async verifyApiKey(apiKey: string): Promise<{ storeId: string; isValid: boolean }> {
    const result = await pool.query(
      `SELECT store_id, is_active, expires_at
       FROM widget_api_keys
       WHERE api_key = $1`,
      [apiKey]
    );

    if (result.rows.length === 0) {
      return { storeId: '', isValid: false };
    }

    const key = result.rows[0];

    // Check if key is active and not expired
    const isExpired = key.expires_at && new Date(key.expires_at) < new Date();
    const isValid = key.is_active && !isExpired;

    if (isValid) {
      // Update last_used_at
      await pool.query(
        'UPDATE widget_api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE api_key = $1',
        [apiKey]
      );
    }

    return { storeId: key.store_id, isValid };
  }

  // Track analytics event
  async trackEvent(storeId: string, eventType: string, eventData: any, sessionInfo: any): Promise<void> {
    await pool.query(
      `INSERT INTO widget_analytics (
        store_id, event_type, event_data, session_id, visitor_id,
        page_url, referrer, device_type, browser
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        storeId,
        eventType,
        JSON.stringify(eventData),
        sessionInfo.sessionId,
        sessionInfo.visitorId,
        sessionInfo.pageUrl,
        sessionInfo.referrer,
        sessionInfo.deviceType,
        sessionInfo.browser,
      ]
    );
  }

  // Get analytics for a store
  async getAnalytics(storeId: string, userId: string, days: number = 30): Promise<any> {
    // Verify store ownership
    const storeCheck = await pool.query(
      'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
      [storeId, userId]
    );

    if (storeCheck.rows.length === 0) {
      throw createError('Store not found', 404);
    }

    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get event counts from actual conversations and messages
    const eventCounts = await pool.query(
      `SELECT
        'conversations' as event_type,
        COUNT(*)::text as count
       FROM widget_conversations
       WHERE store_id = $1 AND created_at >= $2
       UNION ALL
       SELECT
        'messages' as event_type,
        COUNT(*)::text as count
       FROM widget_messages
       WHERE conversation_id IN (
         SELECT id FROM widget_conversations WHERE store_id = $1 AND created_at >= $2
       )
       UNION ALL
       SELECT
        'user_queries' as event_type,
        COUNT(*)::text as count
       FROM widget_messages
       WHERE conversation_id IN (
         SELECT id FROM widget_conversations WHERE store_id = $1 AND created_at >= $2
       ) AND role = 'user'
       UNION ALL
       SELECT
        'ai_responses' as event_type,
        COUNT(*)::text as count
       FROM widget_messages
       WHERE conversation_id IN (
         SELECT id FROM widget_conversations WHERE store_id = $1 AND created_at >= $2
       ) AND role = 'assistant'
       ORDER BY count DESC`,
      [storeId, since]
    );

    // Get daily active sessions from conversations
    const dailySessions = await pool.query(
      `SELECT
        DATE(created_at) as date,
        COUNT(DISTINCT session_id)::text as sessions
       FROM widget_conversations
       WHERE store_id = $1 AND created_at >= $2
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [storeId, since]
    );

    // Get total unique visitors from conversations
    const uniqueVisitors = await pool.query(
      `SELECT COUNT(DISTINCT visitor_id) as count
       FROM widget_conversations
       WHERE store_id = $1 AND created_at >= $2 AND visitor_id IS NOT NULL`,
      [storeId, since]
    );

    // Get widget conversation stats
    const conversationStats = await pool.query(
      `SELECT
        COUNT(*)::text as total_conversations,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END)::text as resolved_conversations,
        COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)))::text, '0') as avg_resolution_time
       FROM widget_conversations
       WHERE store_id = $1 AND created_at >= $2`,
      [storeId, since]
    );

    return {
      eventCounts: eventCounts.rows,
      dailySessions: dailySessions.rows,
      uniqueVisitors: uniqueVisitors.rows[0]?.count || 0,
      conversationStats: conversationStats.rows[0],
    };
  }

  // Get widget embed code
  async getEmbedCode(storeId: string, userId: string): Promise<string> {
    // Verify store ownership and get API key
    const result = await pool.query(
      `SELECT wak.api_key
       FROM stores s
       JOIN widget_api_keys wak ON s.id = wak.store_id
       WHERE s.id = $1 AND s.user_id = $2 AND wak.is_active = true
       LIMIT 1`,
      [storeId, userId]
    );

    if (result.rows.length === 0) {
      throw createError('No active API key found. Please generate an API key first.', 404);
    }

    const apiKey = result.rows[0].api_key;

    // Generate embed code
    const embedCode = `<!-- Flash AI Chat Widget -->
<script>
  (function() {
    window.flashAIConfig = {
      apiKey: '${apiKey}',
      storeId: '${storeId}'
    };
    var script = document.createElement('script');
    script.src = 'https://widget.flashai.com/widget.js';
    script.async = true;
    document.head.appendChild(script);
  })();
</script>
<!-- End Flash AI Chat Widget -->`;

    return embedCode;
  }

  // Check if chatbot is enabled for a store
  async getChatbotEnabled(storeId: string): Promise<{ enabled: boolean }> {
    try {
      const result = await pool.query(
        'SELECT chatbot_enabled FROM widget_settings WHERE store_id = $1',
        [storeId]
      );

      if (result.rows.length === 0) {
        // Default to enabled if no settings found
        return { enabled: true };
      }

      return { enabled: result.rows[0].chatbot_enabled };
    } catch (error) {
      console.error('Error checking chatbot enabled status:', error);
      // Default to enabled on error
      return { enabled: true };
    }
  }

  // Check if VTO is enabled for a store
  async getVTOEnabled(storeId: string): Promise<{ enabled: boolean }> {
    try {
      const result = await pool.query(
        'SELECT vto_enabled FROM widget_settings WHERE store_id = $1',
        [storeId]
      );

      if (result.rows.length === 0) {
        // Default to disabled if no settings found
        return { enabled: false };
      }

      return { enabled: result.rows[0].vto_enabled };
    } catch (error) {
      console.error('Error checking VTO enabled status:', error);
      // Default to disabled on error
      return { enabled: false };
    }
  }

  // Get VTO settings for a store
  async getVTOSettings(storeId: string): Promise<any> {
    try {
      const result = await pool.query(
        `SELECT vto_enabled, vto_mode, vto_position, vto_button_text, vto_primary_color
         FROM widget_settings WHERE store_id = $1`,
        [storeId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting VTO settings:', error);
      return null;
    }
  }
}

export default new WidgetService();
