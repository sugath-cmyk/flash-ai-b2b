-- Migration: Add Face Scan Tables
-- Created: 2026-01-14
-- Description: Add tables for face scanning and product recommendations

-- Face scans table (stores captured face data)
CREATE TABLE IF NOT EXISTS face_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  visitor_id VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Scan status
  status VARCHAR(20) DEFAULT 'pending', -- pending | processing | completed | failed

  -- Image URLs (stored in S3)
  front_image_url TEXT,
  left_profile_url TEXT,
  right_profile_url TEXT,

  -- Processing results
  quality_score FLOAT,
  processing_time_ms INTEGER,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  -- Indexes
  INDEX idx_face_scans_store (store_id),
  INDEX idx_face_scans_visitor (visitor_id),
  INDEX idx_face_scans_status (status),
  INDEX idx_face_scans_created (created_at DESC)
);

-- Face analysis results (extracted features)
CREATE TABLE IF NOT EXISTS face_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  face_scan_id UUID NOT NULL REFERENCES face_scans(id) ON DELETE CASCADE,

  -- Overall skin score (0-100)
  skin_score INTEGER,

  -- Skin tone analysis
  skin_tone VARCHAR(50), -- fair | light | medium | tan | dark | deep
  skin_undertone VARCHAR(50), -- cool | neutral | warm
  skin_hex_color VARCHAR(7), -- Hex color code

  -- Face shape
  face_shape VARCHAR(50), -- oval | round | square | heart | diamond | oblong

  -- Facial features
  eye_color VARCHAR(50),
  hair_color VARCHAR(50),

  -- Feature measurements (for product sizing)
  face_width_cm FLOAT,
  face_length_cm FLOAT,
  eye_spacing_cm FLOAT,

  -- SKIN CONCERN METRICS (0-100 scores, higher = more concern)

  -- Pigmentation Issues
  pigmentation_score INTEGER, -- Overall pigmentation score
  dark_spots_count INTEGER, -- Number of dark spots detected
  dark_spots_severity FLOAT, -- Average severity (0-1)
  sun_damage_score INTEGER, -- Sun damage assessment
  melasma_detected BOOLEAN, -- Melasma presence
  hyperpigmentation_areas JSONB, -- [{x, y, width, height, severity}]

  -- Acne & Blemishes
  acne_score INTEGER, -- Overall acne severity
  whitehead_count INTEGER,
  blackhead_count INTEGER,
  pimple_count INTEGER,
  inflammation_level FLOAT, -- 0-1 scale
  acne_locations JSONB, -- [{x, y, type, severity}]

  -- Wrinkles & Aging
  wrinkle_score INTEGER, -- Overall wrinkle severity
  fine_lines_count INTEGER,
  deep_wrinkles_count INTEGER,
  forehead_lines_severity FLOAT,
  crows_feet_severity FLOAT,
  nasolabial_folds_severity FLOAT,
  wrinkle_areas JSONB, -- [{x, y, type, severity}]

  -- Skin Texture
  texture_score INTEGER, -- Overall texture quality (100 = smooth)
  pore_size_average FLOAT, -- Average pore size in mm
  enlarged_pores_count INTEGER,
  roughness_level FLOAT, -- 0-1 scale
  smoothness_score INTEGER, -- 0-100
  texture_map JSONB, -- Texture quality map

  -- Redness & Sensitivity
  redness_score INTEGER, -- Overall redness level
  sensitivity_level VARCHAR(20), -- low | medium | high
  irritation_detected BOOLEAN,
  rosacea_indicators BOOLEAN,
  redness_areas JSONB, -- [{x, y, width, height, intensity}]

  -- Hydration & Oiliness
  hydration_score INTEGER, -- 0-100 (higher = better hydrated)
  hydration_level VARCHAR(20), -- dry | normal | oily
  oiliness_score INTEGER, -- 0-100
  t_zone_oiliness FLOAT,
  dry_patches_detected BOOLEAN,
  hydration_map JSONB, -- Hydration levels by face region

  -- Additional Metrics
  skin_age_estimate INTEGER, -- Estimated skin age in years
  skin_firmness_score INTEGER,
  under_eye_darkness INTEGER, -- Dark circles severity
  puffiness_score INTEGER, -- Under-eye puffiness

  -- Confidence scores
  skin_tone_confidence FLOAT,
  face_shape_confidence FLOAT,
  analysis_confidence FLOAT, -- Overall analysis confidence

  -- Visual overlay data
  problem_areas_overlay JSONB, -- Highlighted problem areas for UI
  heatmap_data JSONB, -- Heatmap for various metrics

  -- Additional data
  metadata JSONB, -- Additional analysis data

  analyzed_at TIMESTAMP DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(face_scan_id)
);

-- Product recommendations (based on face analysis)
CREATE TABLE IF NOT EXISTS face_scan_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  face_scan_id UUID NOT NULL REFERENCES face_scans(id) ON DELETE CASCADE,
  product_id VARCHAR(255) NOT NULL, -- Shopify product ID

  -- Recommendation details
  recommendation_type VARCHAR(50), -- skin_tone_match | face_shape_match | complementary | trending
  confidence_score FLOAT,
  reason TEXT, -- Why this product was recommended

  -- Product snapshot (in case product gets deleted)
  product_title TEXT,
  product_image_url TEXT,
  product_price DECIMAL(10, 2),

  -- Ranking
  rank INTEGER, -- Order of recommendation

  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_recommendations_scan (face_scan_id),
  INDEX idx_recommendations_product (product_id),
  INDEX idx_recommendations_rank (face_scan_id, rank)
);

-- Face scan sessions (tracking user journey)
CREATE TABLE IF NOT EXISTS face_scan_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  face_scan_id UUID REFERENCES face_scans(id) ON DELETE SET NULL,
  visitor_id VARCHAR(255) NOT NULL,

  -- Session tracking
  products_viewed INTEGER DEFAULT 0,
  products_clicked INTEGER DEFAULT 0,
  added_to_cart BOOLEAN DEFAULT false,
  converted BOOLEAN DEFAULT false, -- Did they purchase?

  -- Duration
  duration_seconds INTEGER,

  -- Session data
  session_data JSONB,

  created_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,

  INDEX idx_face_sessions_store (store_id),
  INDEX idx_face_sessions_scan (face_scan_id),
  INDEX idx_face_sessions_created (created_at DESC)
);

-- Face scan analytics events
CREATE TABLE IF NOT EXISTS face_scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL, -- scan_started | scan_completed | recommendation_viewed | product_clicked | etc.
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  visitor_id VARCHAR(255),
  face_scan_id UUID REFERENCES face_scans(id) ON DELETE SET NULL,
  session_id UUID REFERENCES face_scan_sessions(id) ON DELETE SET NULL,
  product_id VARCHAR(255),

  -- Event metadata
  metadata JSONB,

  timestamp TIMESTAMP DEFAULT NOW(),

  INDEX idx_face_events_store_timestamp (store_id, timestamp DESC),
  INDEX idx_face_events_type (event_type),
  INDEX idx_face_events_scan (face_scan_id)
);

-- Widget settings extension for face scan
ALTER TABLE widget_settings
ADD COLUMN IF NOT EXISTS face_scan_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS face_scan_mode VARCHAR(20) DEFAULT 'floating', -- floating | inline | both
ADD COLUMN IF NOT EXISTS face_scan_position VARCHAR(20) DEFAULT 'bottom-right',
ADD COLUMN IF NOT EXISTS face_scan_button_text VARCHAR(50) DEFAULT 'Find My Shade',
ADD COLUMN IF NOT EXISTS face_scan_primary_color VARCHAR(7) DEFAULT '#8B5CF6';

-- Comments for documentation
COMMENT ON TABLE face_scans IS 'Stores captured face photos and processing status';
COMMENT ON TABLE face_analysis IS 'Extracted facial features and characteristics from face scans';
COMMENT ON TABLE face_scan_recommendations IS 'Product recommendations based on face analysis';
COMMENT ON TABLE face_scan_sessions IS 'User sessions tracking face scan journey and conversions';
COMMENT ON TABLE face_scan_events IS 'Analytics events for face scan feature';
