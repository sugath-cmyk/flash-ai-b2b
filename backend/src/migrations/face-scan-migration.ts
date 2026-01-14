/**
 * Face Scan Migration SQL
 * This is inlined so it's available in production after build
 */

export const FACE_SCAN_MIGRATION_SQL = `
-- Migration: Add Face Scan Tables
-- Created: 2026-01-14
-- Description: Add tables for face scanning and product recommendations

-- Face scans table (stores captured face data)
CREATE TABLE IF NOT EXISTS face_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  visitor_id VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending',
  front_image_url TEXT,
  left_profile_url TEXT,
  right_profile_url TEXT,
  quality_score FLOAT,
  processing_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Face analysis results (extracted features)
CREATE TABLE IF NOT EXISTS face_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  face_scan_id UUID NOT NULL REFERENCES face_scans(id) ON DELETE CASCADE,
  skin_score INTEGER,
  skin_tone VARCHAR(50),
  skin_undertone VARCHAR(50),
  skin_hex_color VARCHAR(7),
  face_shape VARCHAR(50),
  eye_color VARCHAR(50),
  hair_color VARCHAR(50),
  face_width_cm FLOAT,
  face_length_cm FLOAT,
  eye_spacing_cm FLOAT,
  pigmentation_score INTEGER,
  dark_spots_count INTEGER,
  dark_spots_severity FLOAT,
  sun_damage_score INTEGER,
  melasma_detected BOOLEAN,
  hyperpigmentation_areas JSONB,
  acne_score INTEGER,
  whitehead_count INTEGER,
  blackhead_count INTEGER,
  pimple_count INTEGER,
  inflammation_level FLOAT,
  acne_locations JSONB,
  wrinkle_score INTEGER,
  fine_lines_count INTEGER,
  deep_wrinkles_count INTEGER,
  forehead_lines_severity FLOAT,
  crows_feet_severity FLOAT,
  nasolabial_folds_severity FLOAT,
  wrinkle_areas JSONB,
  texture_score INTEGER,
  pore_size_average FLOAT,
  enlarged_pores_count INTEGER,
  roughness_level FLOAT,
  smoothness_score INTEGER,
  texture_map JSONB,
  redness_score INTEGER,
  sensitivity_level VARCHAR(20),
  irritation_detected BOOLEAN,
  rosacea_indicators BOOLEAN,
  redness_areas JSONB,
  hydration_score INTEGER,
  hydration_level VARCHAR(20),
  oiliness_score INTEGER,
  t_zone_oiliness FLOAT,
  dry_patches_detected BOOLEAN,
  hydration_map JSONB,
  skin_age_estimate INTEGER,
  skin_firmness_score INTEGER,
  under_eye_darkness INTEGER,
  puffiness_score INTEGER,
  skin_tone_confidence FLOAT,
  face_shape_confidence FLOAT,
  analysis_confidence FLOAT,
  problem_areas_overlay JSONB,
  heatmap_data JSONB,
  metadata JSONB,
  analyzed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(face_scan_id)
);

-- Product recommendations
CREATE TABLE IF NOT EXISTS face_scan_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  face_scan_id UUID NOT NULL REFERENCES face_scans(id) ON DELETE CASCADE,
  product_id VARCHAR(255) NOT NULL,
  recommendation_type VARCHAR(50),
  confidence_score FLOAT,
  reason TEXT,
  product_title TEXT,
  product_image_url TEXT,
  product_price DECIMAL(10, 2),
  rank INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Face scan sessions
CREATE TABLE IF NOT EXISTS face_scan_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  face_scan_id UUID REFERENCES face_scans(id) ON DELETE SET NULL,
  visitor_id VARCHAR(255) NOT NULL,
  products_viewed INTEGER DEFAULT 0,
  products_clicked INTEGER DEFAULT 0,
  added_to_cart BOOLEAN DEFAULT false,
  converted BOOLEAN DEFAULT false,
  duration_seconds INTEGER,
  session_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
);

-- Face scan events
CREATE TABLE IF NOT EXISTS face_scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  visitor_id VARCHAR(255),
  face_scan_id UUID REFERENCES face_scans(id) ON DELETE SET NULL,
  session_id UUID REFERENCES face_scan_sessions(id) ON DELETE SET NULL,
  product_id VARCHAR(255),
  metadata JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Widget settings extension
ALTER TABLE widget_settings
ADD COLUMN IF NOT EXISTS face_scan_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS face_scan_mode VARCHAR(20) DEFAULT 'floating',
ADD COLUMN IF NOT EXISTS face_scan_position VARCHAR(20) DEFAULT 'bottom-right',
ADD COLUMN IF NOT EXISTS face_scan_button_text VARCHAR(50) DEFAULT 'Find My Shade',
ADD COLUMN IF NOT EXISTS face_scan_primary_color VARCHAR(7) DEFAULT '#8B5CF6';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_face_scans_store ON face_scans(store_id);
CREATE INDEX IF NOT EXISTS idx_face_scans_visitor ON face_scans(visitor_id);
CREATE INDEX IF NOT EXISTS idx_face_scans_status ON face_scans(status);
CREATE INDEX IF NOT EXISTS idx_face_scans_created ON face_scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_scan ON face_scan_recommendations(face_scan_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_product ON face_scan_recommendations(product_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_rank ON face_scan_recommendations(face_scan_id, rank);
CREATE INDEX IF NOT EXISTS idx_face_sessions_store ON face_scan_sessions(store_id);
CREATE INDEX IF NOT EXISTS idx_face_sessions_scan ON face_scan_sessions(face_scan_id);
CREATE INDEX IF NOT EXISTS idx_face_sessions_created ON face_scan_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_face_events_store_timestamp ON face_scan_events(store_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_face_events_type ON face_scan_events(event_type);
CREATE INDEX IF NOT EXISTS idx_face_events_scan ON face_scan_events(face_scan_id);

-- Comments
COMMENT ON TABLE face_scans IS 'Stores captured face photos and processing status';
COMMENT ON TABLE face_analysis IS 'Extracted facial features and characteristics from face scans';
COMMENT ON TABLE face_scan_recommendations IS 'Product recommendations based on face analysis';
COMMENT ON TABLE face_scan_sessions IS 'User sessions tracking face scan journey and conversions';
COMMENT ON TABLE face_scan_events IS 'Analytics events for face scan feature';
`;
