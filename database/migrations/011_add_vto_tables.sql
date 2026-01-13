-- Migration: Add Virtual Try-On (VTO) Tables
-- Created: 2026-01-13
-- Description: Adds tables for VTO feature including body scans, measurements, try-on sessions, size recommendations, and analytics

-- VTO Settings per store
CREATE TABLE IF NOT EXISTS vto_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  mode VARCHAR(20) DEFAULT 'floating', -- 'floating' | 'inline' | 'both'
  button_position VARCHAR(20) DEFAULT 'bottom-right',
  button_text VARCHAR(50) DEFAULT 'Try On',
  primary_color VARCHAR(7) DEFAULT '#000000',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(store_id)
);

-- Body scans from users/visitors
CREATE TABLE IF NOT EXISTS body_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  visitor_id VARCHAR(255), -- Anonymous visitors
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending', -- pending | processing | completed | failed
  image_urls TEXT[], -- S3 URLs of captured photos
  mesh_url TEXT, -- S3 URL to 3D mesh (GLB/GLTF format)
  quality_score FLOAT CHECK (quality_score >= 0 AND quality_score <= 100),
  processing_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Extracted body measurements from scans
CREATE TABLE IF NOT EXISTS body_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body_scan_id UUID NOT NULL REFERENCES body_scans(id) ON DELETE CASCADE,
  height_cm FLOAT,
  weight_kg FLOAT,
  chest_cm FLOAT,
  waist_cm FLOAT,
  hips_cm FLOAT,
  inseam_cm FLOAT,
  shoulder_width_cm FLOAT,
  sleeve_length_cm FLOAT,
  neck_cm FLOAT,
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  measured_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(body_scan_id)
);

-- Try-on sessions
CREATE TABLE IF NOT EXISTS vto_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body_scan_id UUID REFERENCES body_scans(id) ON DELETE SET NULL,
  product_id VARCHAR(255), -- Shopify product ID or internal product ID
  variant_id VARCHAR(255), -- Specific product variant
  visitor_id VARCHAR(255) NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  duration_seconds INTEGER DEFAULT 0,
  garments_tried INTEGER DEFAULT 0,
  screenshot_taken BOOLEAN DEFAULT false,
  shared_social BOOLEAN DEFAULT false,
  converted BOOLEAN DEFAULT false, -- Did they add to cart/purchase?
  session_data JSONB, -- Poses, interactions, timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
);

-- Size recommendations
CREATE TABLE IF NOT EXISTS size_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body_scan_id UUID REFERENCES body_scans(id) ON DELETE SET NULL,
  product_id VARCHAR(255) NOT NULL,
  variant_id VARCHAR(255),
  recommended_size VARCHAR(10),
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  all_sizes JSONB, -- e.g., { "S": 0.1, "M": 0.7, "L": 0.2 }
  fit_advice TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- VTO Analytics events
CREATE TABLE IF NOT EXISTS vto_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL, -- body_scan_started, try_on_completed, screenshot_taken, etc.
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  visitor_id VARCHAR(255),
  session_id UUID REFERENCES vto_sessions(id) ON DELETE SET NULL,
  product_id VARCHAR(255),
  variant_id VARCHAR(255),
  metadata JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_body_scans_store ON body_scans(store_id);
CREATE INDEX IF NOT EXISTS idx_body_scans_status ON body_scans(status);
CREATE INDEX IF NOT EXISTS idx_body_scans_visitor ON body_scans(visitor_id);
CREATE INDEX IF NOT EXISTS idx_body_scans_created ON body_scans(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vto_sessions_store ON vto_sessions(store_id);
CREATE INDEX IF NOT EXISTS idx_vto_sessions_visitor ON vto_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_vto_sessions_created ON vto_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vto_events_store ON vto_events(store_id);
CREATE INDEX IF NOT EXISTS idx_vto_events_timestamp ON vto_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vto_events_store_timestamp ON vto_events(store_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vto_events_type ON vto_events(event_type);

CREATE INDEX IF NOT EXISTS idx_size_recommendations_product ON size_recommendations(product_id);

-- Add updated_at trigger for vto_settings
CREATE OR REPLACE FUNCTION update_vto_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vto_settings_updated_at
BEFORE UPDATE ON vto_settings
FOR EACH ROW
EXECUTE FUNCTION update_vto_settings_updated_at();

-- Comments for documentation
COMMENT ON TABLE vto_settings IS 'VTO widget configuration per store';
COMMENT ON TABLE body_scans IS 'User body scans for creating 3D models';
COMMENT ON TABLE body_measurements IS 'Extracted measurements from body scans';
COMMENT ON TABLE vto_sessions IS 'Virtual try-on sessions tracking user interactions';
COMMENT ON TABLE size_recommendations IS 'AI-powered size recommendations for products';
COMMENT ON TABLE vto_events IS 'Analytics events for VTO feature usage';
