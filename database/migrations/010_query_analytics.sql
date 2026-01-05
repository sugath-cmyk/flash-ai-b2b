-- Migration: Query Analytics & Intelligent Caching
-- Created: 2025-01-05
-- Description: Adds comprehensive query analytics, categorization, caching, and admin dashboard capabilities
-- Purpose: Convert chatbot conversations into actionable product intelligence

-- ============================================================================
-- PART 1: ENHANCE WIDGET_MESSAGES TABLE
-- Add query categorization, intent detection, and caching metadata
-- ============================================================================

-- Query categorization columns
ALTER TABLE widget_messages
ADD COLUMN IF NOT EXISTS query_category VARCHAR(50),
ADD COLUMN IF NOT EXISTS query_intent VARCHAR(50),
ADD COLUMN IF NOT EXISTS query_topics TEXT[],
ADD COLUMN IF NOT EXISTS query_metadata JSONB DEFAULT '{}'::jsonb;

-- Sentiment analysis (for future use)
ALTER TABLE widget_messages
ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20); -- positive, neutral, negative

-- Caching metadata
ALTER TABLE widget_messages
ADD COLUMN IF NOT EXISTS cached_from UUID, -- References query_cache.id if response was from cache
ADD COLUMN IF NOT EXISTS cache_key VARCHAR(64); -- MD5 hash of normalized query

COMMENT ON COLUMN widget_messages.query_category IS 'Auto-detected category: ingredients, product_inquiry, usage_instructions, shipping, returns, pricing, safety, comparison, general';
COMMENT ON COLUMN widget_messages.query_intent IS 'Detected user intent: seeking_information, seeking_guidance, purchase_intent, etc.';
COMMENT ON COLUMN widget_messages.query_topics IS 'Extracted keywords and topics from query';
COMMENT ON COLUMN widget_messages.query_metadata IS 'Additional metadata like confidence score, extracted entities';
COMMENT ON COLUMN widget_messages.sentiment IS 'Sentiment analysis of user message';
COMMENT ON COLUMN widget_messages.cached_from IS 'UUID of cached response if this was a cache hit';
COMMENT ON COLUMN widget_messages.cache_key IS 'Cache key for this query (MD5 of normalized query)';

-- ============================================================================
-- PART 2: ENHANCE WIDGET_CONVERSATIONS TABLE
-- Add feedback, ratings, tags, and resolution tracking
-- ============================================================================

ALTER TABLE widget_conversations
ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5),
ADD COLUMN IF NOT EXISTS feedback_text TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS resolution_status VARCHAR(50) DEFAULT 'unresolved',
ADD COLUMN IF NOT EXISTS total_messages INTEGER DEFAULT 0;

COMMENT ON COLUMN widget_conversations.rating IS 'User satisfaction rating (1-5 stars)';
COMMENT ON COLUMN widget_conversations.feedback_text IS 'User feedback about the conversation';
COMMENT ON COLUMN widget_conversations.tags IS 'Admin-assigned tags for categorization';
COMMENT ON COLUMN widget_conversations.resolution_status IS 'Resolution status: resolved, unresolved, escalated, pending';
COMMENT ON COLUMN widget_conversations.total_messages IS 'Total number of messages in conversation (denormalized for performance)';

-- ============================================================================
-- PART 3: CREATE QUERY_CACHE TABLE
-- Stores cached responses with similarity matching for cost optimization
-- ============================================================================

CREATE TABLE IF NOT EXISTS query_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

    -- Query identification
    cache_key VARCHAR(64) NOT NULL, -- MD5 hash of normalized query
    original_query TEXT NOT NULL, -- Original query text
    normalized_query TEXT NOT NULL, -- Normalized for similarity matching

    -- Response data
    response_content TEXT NOT NULL,

    -- Categorization
    category VARCHAR(50),
    topics TEXT[],

    -- Cache statistics
    hit_count INTEGER DEFAULT 0,
    last_hit_at TIMESTAMP,

    -- Expiration
    expires_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure one cache entry per normalized query per store
    UNIQUE(store_id, cache_key)
);

COMMENT ON TABLE query_cache IS 'Cached AI responses for similar queries to reduce API costs';
COMMENT ON COLUMN query_cache.cache_key IS 'MD5 hash of normalized query for fast lookup';
COMMENT ON COLUMN query_cache.normalized_query IS 'Lowercase, punctuation removed, common words removed, alphabetically sorted';
COMMENT ON COLUMN query_cache.hit_count IS 'Number of times this cached response was used';
COMMENT ON COLUMN query_cache.expires_at IS 'Cache expiration date (default 7 days from creation)';

-- ============================================================================
-- PART 4: CREATE QUERY_ANALYTICS_DAILY TABLE (Optional)
-- Pre-aggregated daily statistics for fast dashboard loading
-- ============================================================================

CREATE TABLE IF NOT EXISTS query_analytics_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Query counts
    total_queries INTEGER DEFAULT 0,
    cached_queries INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,

    -- Category breakdown
    category_breakdown JSONB DEFAULT '{}'::jsonb, -- {"ingredients": 45, "product_inquiry": 120, ...}

    -- Popular queries (top 10)
    popular_queries JSONB DEFAULT '[]'::jsonb, -- [{"query": "...", "count": 15}, ...]

    -- Performance metrics
    avg_response_time_ms INTEGER,
    avg_tokens_per_query INTEGER,

    -- Cost tracking
    total_tokens_used INTEGER DEFAULT 0,
    total_tokens_saved INTEGER DEFAULT 0,
    estimated_cost_usd DECIMAL(10,4) DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(store_id, date)
);

COMMENT ON TABLE query_analytics_daily IS 'Pre-aggregated daily analytics for fast dashboard performance';

-- ============================================================================
-- PART 5: CREATE INDEXES FOR PERFORMANCE
-- Optimize query search, filtering, and analytics aggregations
-- ============================================================================

-- Widget messages indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_widget_messages_category ON widget_messages(query_category);
CREATE INDEX IF NOT EXISTS idx_widget_messages_intent ON widget_messages(query_intent);
CREATE INDEX IF NOT EXISTS idx_widget_messages_topics ON widget_messages USING GIN(query_topics);
CREATE INDEX IF NOT EXISTS idx_widget_messages_created_at ON widget_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_widget_messages_sentiment ON widget_messages(sentiment);
CREATE INDEX IF NOT EXISTS idx_widget_messages_cached_from ON widget_messages(cached_from);
CREATE INDEX IF NOT EXISTS idx_widget_messages_cache_key ON widget_messages(cache_key);
CREATE INDEX IF NOT EXISTS idx_widget_messages_store_created ON widget_messages(store_id, created_at);
CREATE INDEX IF NOT EXISTS idx_widget_messages_role ON widget_messages(role);

-- Widget conversations indexes for filtering
CREATE INDEX IF NOT EXISTS idx_widget_conversations_rating ON widget_conversations(rating);
CREATE INDEX IF NOT EXISTS idx_widget_conversations_resolution ON widget_conversations(resolution_status);
CREATE INDEX IF NOT EXISTS idx_widget_conversations_tags ON widget_conversations USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_widget_conversations_created_at ON widget_conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_widget_conversations_store_created ON widget_conversations(store_id, created_at);

-- Query cache indexes
CREATE INDEX IF NOT EXISTS idx_query_cache_store ON query_cache(store_id);
CREATE INDEX IF NOT EXISTS idx_query_cache_key ON query_cache(store_id, cache_key);
CREATE INDEX IF NOT EXISTS idx_query_cache_category ON query_cache(category);
CREATE INDEX IF NOT EXISTS idx_query_cache_normalized ON query_cache(normalized_query);
CREATE INDEX IF NOT EXISTS idx_query_cache_expires ON query_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_query_cache_hit_count ON query_cache(hit_count DESC);

-- Daily analytics indexes
CREATE INDEX IF NOT EXISTS idx_query_analytics_daily_store ON query_analytics_daily(store_id);
CREATE INDEX IF NOT EXISTS idx_query_analytics_daily_date ON query_analytics_daily(date);
CREATE INDEX IF NOT EXISTS idx_query_analytics_daily_store_date ON query_analytics_daily(store_id, date);

-- ============================================================================
-- PART 6: CREATE DATABASE FUNCTIONS
-- Similarity matching and utility functions
-- ============================================================================

-- Function to calculate Jaccard similarity between two arrays
CREATE OR REPLACE FUNCTION array_jaccard_similarity(arr1 TEXT[], arr2 TEXT[])
RETURNS FLOAT AS $$
DECLARE
    intersection_size INTEGER;
    union_size INTEGER;
BEGIN
    -- Handle empty arrays
    IF array_length(arr1, 1) IS NULL OR array_length(arr2, 1) IS NULL THEN
        RETURN 0.0;
    END IF;

    -- Calculate intersection size
    SELECT COUNT(*)
    INTO intersection_size
    FROM (
        SELECT unnest(arr1)
        INTERSECT
        SELECT unnest(arr2)
    ) AS intersection;

    -- Calculate union size
    SELECT COUNT(DISTINCT val)
    INTO union_size
    FROM (
        SELECT unnest(arr1) AS val
        UNION ALL
        SELECT unnest(arr2) AS val
    ) AS union_vals;

    -- Return Jaccard similarity
    IF union_size = 0 THEN
        RETURN 0.0;
    END IF;

    RETURN intersection_size::FLOAT / union_size::FLOAT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION array_jaccard_similarity IS 'Calculate Jaccard similarity coefficient between two text arrays (0.0 to 1.0)';

-- Function to find similar cached queries
-- Drop existing function if it exists (with any signature)
DROP FUNCTION IF EXISTS find_similar_cached_queries CASCADE;

CREATE FUNCTION find_similar_cached_queries(
    p_store_id UUID,
    p_normalized_query TEXT,
    p_threshold FLOAT DEFAULT 0.7,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    cache_id UUID,
    original_query TEXT,
    normalized_query TEXT,
    response_content TEXT,
    category VARCHAR(50),
    hit_count INTEGER,
    similarity_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        qc.id,
        qc.original_query,
        qc.normalized_query,
        qc.response_content,
        qc.category,
        qc.hit_count,
        array_jaccard_similarity(
            string_to_array(qc.normalized_query, ' '),
            string_to_array(p_normalized_query, ' ')
        ) AS similarity
    FROM query_cache qc
    WHERE qc.store_id = p_store_id
      AND (qc.expires_at IS NULL OR qc.expires_at > NOW())
      AND array_jaccard_similarity(
            string_to_array(qc.normalized_query, ' '),
            string_to_array(p_normalized_query, ' ')
          ) >= p_threshold
    ORDER BY similarity DESC, qc.hit_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION find_similar_cached_queries IS 'Find cached responses similar to a given query using Jaccard similarity';

-- ============================================================================
-- PART 7: CREATE TRIGGERS
-- Auto-update timestamps and maintain denormalized counts
-- ============================================================================

-- Trigger for query_cache updated_at
DROP TRIGGER IF EXISTS update_query_cache_updated_at ON query_cache;
CREATE TRIGGER update_query_cache_updated_at
BEFORE UPDATE ON query_cache
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for query_analytics_daily updated_at
DROP TRIGGER IF EXISTS update_query_analytics_daily_updated_at ON query_analytics_daily;
CREATE TRIGGER update_query_analytics_daily_updated_at
BEFORE UPDATE ON query_analytics_daily
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update total_messages count in widget_conversations
DROP FUNCTION IF EXISTS update_conversation_message_count CASCADE;

CREATE FUNCTION update_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE widget_conversations
        SET total_messages = total_messages + 1,
            updated_at = NOW()
        WHERE id = NEW.conversation_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE widget_conversations
        SET total_messages = GREATEST(total_messages - 1, 0),
            updated_at = NOW()
        WHERE id = OLD.conversation_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain message count
DROP TRIGGER IF EXISTS maintain_conversation_message_count ON widget_messages;
CREATE TRIGGER maintain_conversation_message_count
AFTER INSERT OR DELETE ON widget_messages
FOR EACH ROW EXECUTE FUNCTION update_conversation_message_count();

-- ============================================================================
-- PART 8: BACKFILL TOTAL_MESSAGES (One-time)
-- Update existing conversations with current message counts
-- ============================================================================

UPDATE widget_conversations wc
SET total_messages = (
    SELECT COUNT(*)
    FROM widget_messages wm
    WHERE wm.conversation_id = wc.id
)
WHERE total_messages = 0 OR total_messages IS NULL;

-- ============================================================================
-- PART 9: DATA GOVERNANCE & CLEANUP
-- Scheduled cleanup functions (to be run via cron or scheduled jobs)
-- ============================================================================

-- Function to clean expired cache entries
DROP FUNCTION IF EXISTS clean_expired_cache CASCADE;

CREATE FUNCTION clean_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM query_cache
    WHERE expires_at IS NOT NULL AND expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION clean_expired_cache IS 'Delete expired cache entries. Run daily via cron/scheduler.';

-- Function to archive old conversations (soft delete)
DROP FUNCTION IF EXISTS archive_old_conversations CASCADE;

CREATE FUNCTION archive_old_conversations(days_old INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    UPDATE widget_conversations
    SET status = 'archived'
    WHERE created_at < NOW() - (days_old || ' days')::INTERVAL
      AND status != 'archived';

    GET DIAGNOSTICS archived_count = ROW_COUNT;

    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION archive_old_conversations IS 'Archive conversations older than specified days (default 365)';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify migration success
DO $$
BEGIN
    RAISE NOTICE '✅ Query Analytics Migration Complete!';
    RAISE NOTICE '📊 Added columns: query_category, query_intent, query_topics, sentiment, cache metadata';
    RAISE NOTICE '💾 Created tables: query_cache, query_analytics_daily';
    RAISE NOTICE '🔍 Created indexes for fast analytics queries';
    RAISE NOTICE '⚙️  Created functions: array_jaccard_similarity, find_similar_cached_queries, cleanup functions';
    RAISE NOTICE '🎯 Ready for admin analytics dashboard and intelligent query caching!';
END $$;
