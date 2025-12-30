-- Migration 010: Query Analytics & Caching Enhancement
-- Adds query categorization, analytics metadata, and intelligent caching support
-- Author: Flash AI Team
-- Date: 2024-12-30

-- ============================================================================
-- PART 1: ENHANCE EXISTING TABLES
-- ============================================================================

-- Add query analytics columns to widget_messages
ALTER TABLE widget_messages
ADD COLUMN IF NOT EXISTS query_category TEXT, -- 'product_inquiry', 'shipping', 'returns', 'usage_instructions', 'ingredients', 'pricing', 'general'
ADD COLUMN IF NOT EXISTS query_intent TEXT, -- Detected user intent
ADD COLUMN IF NOT EXISTS query_topics TEXT[], -- Array of detected topics
ADD COLUMN IF NOT EXISTS response_quality NUMERIC, -- 0-1 quality score
ADD COLUMN IF NOT EXISTS sentiment TEXT, -- 'positive', 'neutral', 'negative'
ADD COLUMN IF NOT EXISTS product_ids TEXT[], -- Array of product IDs mentioned
ADD COLUMN IF NOT EXISTS cached_from UUID, -- Reference to message ID if response was cached
ADD COLUMN IF NOT EXISTS cache_key TEXT, -- Query similarity hash for caching
ADD COLUMN IF NOT EXISTS query_metadata JSONB; -- Additional metadata

-- Add conversation metadata enhancements
ALTER TABLE widget_conversations
ADD COLUMN IF NOT EXISTS tags TEXT[], -- Custom tags for filtering
ADD COLUMN IF NOT EXISTS rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- Customer satisfaction rating (1-5)
ADD COLUMN IF NOT EXISTS feedback_text TEXT, -- Customer feedback
ADD COLUMN IF NOT EXISTS total_messages INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS resolution_status TEXT DEFAULT 'active'; -- 'active', 'resolved', 'escalated'

-- ============================================================================
-- PART 2: CREATE NEW TABLES
-- ============================================================================

-- Query cache table for storing similar query responses
CREATE TABLE IF NOT EXISTS query_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  cache_key TEXT NOT NULL, -- Normalized query hash
  original_query TEXT NOT NULL, -- Original user query
  normalized_query TEXT NOT NULL, -- Normalized version for matching
  response_content TEXT NOT NULL,
  category TEXT,
  topics TEXT[],
  hit_count INTEGER DEFAULT 0, -- Number of times this cache was used
  last_hit_at TIMESTAMP,
  confidence_score NUMERIC DEFAULT 1.0, -- 0-1 confidence in cached response
  expires_at TIMESTAMP, -- Cache expiry
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(store_id, cache_key)
);

-- Analytics aggregation table for performance
CREATE TABLE IF NOT EXISTS query_analytics_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  category TEXT,
  query_count INTEGER DEFAULT 0,
  unique_queries INTEGER DEFAULT 0,
  avg_response_time NUMERIC, -- milliseconds
  cache_hit_rate NUMERIC, -- percentage
  sentiment_positive INTEGER DEFAULT 0,
  sentiment_neutral INTEGER DEFAULT 0,
  sentiment_negative INTEGER DEFAULT 0,
  top_queries JSONB, -- Array of {query, count}
  top_products TEXT[], -- Most mentioned product IDs
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(store_id, date, category)
);

-- ============================================================================
-- PART 3: CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexes for widget_messages analytics
CREATE INDEX IF NOT EXISTS idx_messages_category ON widget_messages (query_category) WHERE role = 'user';
CREATE INDEX IF NOT EXISTS idx_messages_store_created ON widget_messages (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_cache_key ON widget_messages (cache_key) WHERE cache_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_product_ids ON widget_messages USING GIN (product_ids);
CREATE INDEX IF NOT EXISTS idx_messages_topics ON widget_messages USING GIN (query_topics);
CREATE INDEX IF NOT EXISTS idx_messages_sentiment ON widget_messages (sentiment) WHERE sentiment IS NOT NULL;

-- Indexes for widget_conversations
CREATE INDEX IF NOT EXISTS idx_conversations_rating ON widget_conversations (rating) WHERE rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_tags ON widget_conversations USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_conversations_resolution ON widget_conversations (resolution_status);

-- Indexes for query_cache
CREATE INDEX IF NOT EXISTS idx_query_cache_store ON query_cache (store_id);
CREATE INDEX IF NOT EXISTS idx_query_cache_key ON query_cache (store_id, cache_key);
CREATE INDEX IF NOT EXISTS idx_query_cache_expires ON query_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_query_cache_category ON query_cache (category);
CREATE INDEX IF NOT EXISTS idx_query_cache_hit_count ON query_cache (hit_count DESC);

-- Indexes for query_analytics_daily
CREATE INDEX IF NOT EXISTS idx_analytics_daily_store ON query_analytics_daily (store_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_category ON query_analytics_daily (category);

-- ============================================================================
-- PART 4: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate query similarity using Jaccard similarity
CREATE OR REPLACE FUNCTION calculate_query_similarity(
  query1 TEXT,
  query2 TEXT
) RETURNS NUMERIC AS $$
DECLARE
  words1 TEXT[];
  words2 TEXT[];
  common_words INTEGER;
  total_words INTEGER;
BEGIN
  -- Normalize and split into words
  words1 := string_to_array(lower(regexp_replace(query1, '[^a-zA-Z0-9\s]', '', 'g')), ' ');
  words2 := string_to_array(lower(regexp_replace(query2, '[^a-zA-Z0-9\s]', '', 'g')), ' ');

  -- Remove empty strings
  words1 := array_remove(words1, '');
  words2 := array_remove(words2, '');

  -- Calculate Jaccard similarity (intersection / union)
  common_words := (
    SELECT COUNT(DISTINCT w)
    FROM unnest(words1) w
    WHERE w = ANY(words2)
  );

  total_words := (
    SELECT COUNT(DISTINCT w)
    FROM (
      SELECT unnest(words1) AS w
      UNION
      SELECT unnest(words2) AS w
    ) combined
  );

  IF total_words = 0 THEN
    RETURN 0;
  END IF;

  RETURN common_words::NUMERIC / total_words::NUMERIC;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to find similar cached queries above a threshold
CREATE OR REPLACE FUNCTION find_similar_cached_queries(
  p_store_id UUID,
  p_query TEXT,
  p_similarity_threshold NUMERIC DEFAULT 0.7,
  p_limit INTEGER DEFAULT 5
) RETURNS TABLE (
  cache_id UUID,
  original_query TEXT,
  response_content TEXT,
  similarity_score NUMERIC,
  hit_count INTEGER,
  category TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    qc.id,
    qc.original_query,
    qc.response_content,
    calculate_query_similarity(p_query, qc.normalized_query) AS similarity,
    qc.hit_count,
    qc.category
  FROM query_cache qc
  WHERE qc.store_id = p_store_id
    AND (qc.expires_at IS NULL OR qc.expires_at > NOW())
    AND calculate_query_similarity(p_query, qc.normalized_query) >= p_similarity_threshold
  ORDER BY similarity DESC, hit_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to normalize queries for consistent caching
CREATE OR REPLACE FUNCTION normalize_query(
  query TEXT
) RETURNS TEXT AS $$
BEGIN
  -- Convert to lowercase, remove punctuation, trim whitespace
  RETURN TRIM(regexp_replace(lower(query), '[^a-z0-9\s]', '', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- PART 5: ADD COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN widget_messages.query_category IS 'Auto-categorized query type: product_inquiry, shipping, returns, usage_instructions, ingredients, pricing, general';
COMMENT ON COLUMN widget_messages.query_intent IS 'Detected user intent from the query';
COMMENT ON COLUMN widget_messages.query_topics IS 'Array of detected topics/keywords from query';
COMMENT ON COLUMN widget_messages.cache_key IS 'Hash key for finding similar queries and caching responses';
COMMENT ON COLUMN widget_messages.cached_from IS 'Reference to cache entry ID if this response was served from cache';
COMMENT ON COLUMN widget_messages.sentiment IS 'Detected sentiment: positive, neutral, or negative';

COMMENT ON COLUMN widget_conversations.rating IS 'Customer satisfaction rating from 1-5 stars';
COMMENT ON COLUMN widget_conversations.tags IS 'Custom tags for categorizing and filtering conversations';
COMMENT ON COLUMN widget_conversations.resolution_status IS 'Conversation status: active, resolved, or escalated';

COMMENT ON TABLE query_cache IS 'Stores cached responses for similar queries to reduce AI API costs';
COMMENT ON COLUMN query_cache.cache_key IS 'Unique hash of normalized query for fast lookups';
COMMENT ON COLUMN query_cache.hit_count IS 'Number of times this cached response was reused';
COMMENT ON COLUMN query_cache.confidence_score IS 'Confidence level in cached response (0-1)';

COMMENT ON TABLE query_analytics_daily IS 'Daily aggregated analytics for dashboard performance and reporting';
COMMENT ON COLUMN query_analytics_daily.cache_hit_rate IS 'Percentage of queries served from cache on this day';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 010 (Query Analytics & Caching) completed successfully';
  RAISE NOTICE 'New tables created: query_cache, query_analytics_daily';
  RAISE NOTICE 'Enhanced tables: widget_messages, widget_conversations';
  RAISE NOTICE 'Functions added: calculate_query_similarity, find_similar_cached_queries, normalize_query';
END $$;
