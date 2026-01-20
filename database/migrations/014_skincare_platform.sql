-- Migration: Skincare Platform Enhancement
-- Created: 2026-01-20
-- Description: Add tables for user accounts, progress tracking, goals, routines, and learning

-- =====================================================
-- PHASE 1: USER AUTHENTICATION & PROGRESS TRACKING
-- =====================================================

-- Widget users (separate from admin users for customer privacy)
CREATE TABLE IF NOT EXISTS widget_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  email VARCHAR(255),
  phone VARCHAR(20),
  password_hash VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  display_name VARCHAR(100),
  avatar_url TEXT,
  visitor_id VARCHAR(255), -- Link to anonymous scans before registration
  skin_profile JSONB DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,
  UNIQUE(store_id, email),
  UNIQUE(store_id, phone)
);

-- Auth tokens for widget users
CREATE TABLE IF NOT EXISTS widget_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES widget_users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  token_type VARCHAR(20) DEFAULT 'access', -- 'access', 'refresh', 'magic_link'
  device_fingerprint VARCHAR(255),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP
);

-- Progress snapshots for comparing scans over time
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES widget_users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  face_scan_id UUID NOT NULL REFERENCES face_scans(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  -- Key metrics snapshot
  skin_score INTEGER,
  acne_score INTEGER,
  wrinkle_score INTEGER,
  hydration_score INTEGER,
  pigmentation_score INTEGER,
  texture_score INTEGER,
  redness_score INTEGER,
  oiliness_score INTEGER,
  skin_age_estimate INTEGER,
  -- Computed changes from previous snapshot
  previous_snapshot_id UUID REFERENCES user_progress(id),
  changes JSONB DEFAULT '{}', -- {"acne_score": -5, "hydration_score": +10}
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, face_scan_id)
);

-- Milestones for gamification
CREATE TABLE IF NOT EXISTS user_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES widget_users(id) ON DELETE CASCADE,
  milestone_type VARCHAR(50) NOT NULL, -- 'first_scan', 'week_streak', 'improvement_10%', etc.
  milestone_name VARCHAR(100),
  achieved_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, milestone_type)
);

-- Indexes for Phase 1
CREATE INDEX IF NOT EXISTS idx_widget_users_visitor ON widget_users(visitor_id);
CREATE INDEX IF NOT EXISTS idx_widget_users_store_email ON widget_users(store_id, email);
CREATE INDEX IF NOT EXISTS idx_widget_users_store_phone ON widget_users(store_id, phone);
CREATE INDEX IF NOT EXISTS idx_widget_auth_tokens_user ON widget_auth_tokens(user_id, token_type);
CREATE INDEX IF NOT EXISTS idx_progress_user_date ON user_progress(user_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_progress_store ON user_progress(store_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_milestones_user ON user_milestones(user_id);

-- =====================================================
-- PHASE 2: GOAL SETTING & SKINCARE ROUTINES
-- =====================================================

-- Goal templates (predefined goals)
CREATE TABLE IF NOT EXISTS goal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  goal_type VARCHAR(50) NOT NULL, -- 'clear_acne', 'reduce_wrinkles', etc.
  target_metric VARCHAR(50) NOT NULL, -- 'acne_score', 'wrinkle_score', etc.
  default_improvement_percent INTEGER DEFAULT 20,
  typical_duration_weeks INTEGER DEFAULT 8,
  recommended_products JSONB DEFAULT '[]', -- Categories of products
  icon VARCHAR(50),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User goals
CREATE TABLE IF NOT EXISTS user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES widget_users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  template_id UUID REFERENCES goal_templates(id),
  goal_type VARCHAR(50) NOT NULL,
  goal_name VARCHAR(100),
  target_metric VARCHAR(50) NOT NULL,
  baseline_value INTEGER, -- Starting value when goal was set
  current_value INTEGER,
  target_value INTEGER,
  start_date DATE DEFAULT CURRENT_DATE,
  target_date DATE,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'paused', 'abandoned'
  progress_percent INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- User skincare routines
CREATE TABLE IF NOT EXISTS user_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES widget_users(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(100) DEFAULT 'My Routine',
  routine_type VARCHAR(10) NOT NULL, -- 'am', 'pm', 'weekly'
  is_active BOOLEAN DEFAULT true,
  generated_from_goals BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Routine steps
CREATE TABLE IF NOT EXISTS routine_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID NOT NULL REFERENCES user_routines(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_type VARCHAR(50) NOT NULL, -- 'cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen', etc.
  product_id VARCHAR(255), -- Link to extracted_products
  custom_product_name VARCHAR(255), -- For products not in catalog
  custom_product_brand VARCHAR(255),
  instructions TEXT,
  duration_seconds INTEGER,
  is_optional BOOLEAN DEFAULT false,
  frequency VARCHAR(50) DEFAULT 'daily', -- 'daily', 'every_other_day', '2x_week', '1x_week'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Routine completion logs
CREATE TABLE IF NOT EXISTS routine_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES widget_users(id) ON DELETE CASCADE,
  routine_id UUID NOT NULL REFERENCES user_routines(id) ON DELETE CASCADE,
  completed_at TIMESTAMP DEFAULT NOW(),
  steps_completed INTEGER[], -- Array of step_order numbers completed
  total_steps INTEGER,
  completion_percent INTEGER,
  skin_feeling VARCHAR(20), -- 'great', 'good', 'okay', 'irritated', 'bad'
  notes TEXT
);

-- Indexes for Phase 2
CREATE INDEX IF NOT EXISTS idx_user_goals_user_status ON user_goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_goals_store ON user_goals(store_id, status);
CREATE INDEX IF NOT EXISTS idx_user_routines_user ON user_routines(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_routine_steps_routine ON routine_steps(routine_id, step_order);
CREATE INDEX IF NOT EXISTS idx_routine_logs_user ON routine_logs(user_id, completed_at DESC);

-- Insert default goal templates
INSERT INTO goal_templates (name, description, goal_type, target_metric, default_improvement_percent, typical_duration_weeks, icon, display_order) VALUES
('Clear Acne', 'Reduce breakouts and blemishes for clearer skin', 'clear_acne', 'acne_score', 30, 8, 'sparkles', 1),
('Reduce Wrinkles', 'Minimize fine lines and wrinkles for youthful skin', 'reduce_wrinkles', 'wrinkle_score', 20, 12, 'clock', 2),
('Hydrate Skin', 'Boost moisture levels for plump, healthy skin', 'improve_hydration', 'hydration_score', 25, 4, 'droplet', 3),
('Even Skin Tone', 'Fade dark spots and achieve uniform complexion', 'even_tone', 'pigmentation_score', 25, 10, 'sun', 4),
('Smooth Texture', 'Refine pores and improve skin smoothness', 'smooth_texture', 'texture_score', 20, 6, 'feather', 5),
('Reduce Redness', 'Calm sensitive skin and minimize redness', 'reduce_redness', 'redness_score', 25, 6, 'heart', 6),
('Control Oil', 'Balance sebum production for matte skin', 'control_oil', 'oiliness_score', 30, 4, 'shield', 7)
ON CONFLICT DO NOTHING;

-- =====================================================
-- PHASE 3: LEARNING BOT & FEEDBACK SYSTEM
-- =====================================================

-- Explicit feedback on recommendations
CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES widget_users(id) ON DELETE SET NULL,
  visitor_id VARCHAR(255),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  face_scan_id UUID REFERENCES face_scans(id) ON DELETE SET NULL,
  recommendation_id UUID REFERENCES face_scan_recommendations(id) ON DELETE SET NULL,
  product_id VARCHAR(255) NOT NULL,
  feedback_type VARCHAR(20) NOT NULL, -- 'rating', 'helpful', 'not_helpful', 'purchased', 'dismissed'
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  -- Post-purchase follow-up
  purchased BOOLEAN DEFAULT false,
  purchase_date DATE,
  effectiveness_rating INTEGER CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5),
  would_recommend BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Behavioral signals for learning
CREATE TABLE IF NOT EXISTS behavior_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES widget_users(id) ON DELETE SET NULL,
  visitor_id VARCHAR(255),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  session_id UUID,
  signal_type VARCHAR(50) NOT NULL, -- 'product_view', 'product_click', 'add_to_cart', 'purchase', 'return_scan', etc.
  product_id VARCHAR(255),
  face_scan_id UUID REFERENCES face_scans(id) ON DELETE SET NULL,
  duration_seconds INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Aggregated anonymous insights (for model training)
CREATE TABLE IF NOT EXISTS aggregated_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  insight_type VARCHAR(50) NOT NULL, -- 'product_effectiveness', 'concern_improvement', 'ingredient_success'
  concern VARCHAR(50), -- 'acne', 'wrinkles', 'pigmentation', etc.
  product_category VARCHAR(50),
  ingredient_key VARCHAR(100),
  sample_size INTEGER NOT NULL,
  avg_rating DECIMAL(3,2),
  avg_improvement DECIMAL(5,2),
  conversion_rate DECIMAL(5,4),
  confidence_score DECIMAL(3,2),
  period_start DATE,
  period_end DATE,
  computed_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for Phase 3
CREATE INDEX IF NOT EXISTS idx_feedback_product ON recommendation_feedback(product_id, feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON recommendation_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_store ON recommendation_feedback(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_type ON behavior_signals(signal_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_user ON behavior_signals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_store ON behavior_signals(store_id, signal_type);
CREATE INDEX IF NOT EXISTS idx_insights_concern ON aggregated_insights(concern, insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_store ON aggregated_insights(store_id, computed_at DESC);

-- =====================================================
-- PHASE 4: SAFETY CHECKER
-- =====================================================

-- User allergen profiles
CREATE TABLE IF NOT EXISTS user_allergens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES widget_users(id) ON DELETE CASCADE,
  allergen_type VARCHAR(100) NOT NULL, -- 'fragrance', 'nuts', 'gluten', 'sulfates', etc.
  allergen_name VARCHAR(255),
  severity VARCHAR(20) DEFAULT 'moderate', -- 'mild', 'moderate', 'severe'
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, allergen_type)
);

-- User safety preferences
CREATE TABLE IF NOT EXISTS user_safety_preferences (
  user_id UUID PRIMARY KEY REFERENCES widget_users(id) ON DELETE CASCADE,
  is_pregnant BOOLEAN DEFAULT false,
  is_breastfeeding BOOLEAN DEFAULT false,
  avoid_fragrance BOOLEAN DEFAULT false,
  avoid_alcohol BOOLEAN DEFAULT false,
  avoid_parabens BOOLEAN DEFAULT false,
  avoid_sulfates BOOLEAN DEFAULT false,
  sensitivity_level VARCHAR(20) DEFAULT 'normal', -- 'normal', 'sensitive', 'very_sensitive'
  skin_conditions TEXT[], -- ['eczema', 'psoriasis', 'rosacea']
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Product safety scans (user-submitted products for analysis)
CREATE TABLE IF NOT EXISTS product_safety_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES widget_users(id) ON DELETE SET NULL,
  visitor_id VARCHAR(255),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  scan_type VARCHAR(20) NOT NULL, -- 'barcode', 'text_input', 'image_ocr'
  product_name VARCHAR(255),
  brand VARCHAR(255),
  ingredients_raw TEXT, -- Raw input from user
  ingredients_parsed TEXT[], -- Parsed array
  safety_report JSONB, -- Full analysis result
  overall_safety VARCHAR(20), -- 'safe', 'caution', 'avoid'
  flagged_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for Phase 4
CREATE INDEX IF NOT EXISTS idx_user_allergens ON user_allergens(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_scans_user ON product_safety_scans(user_id, created_at DESC);

-- =====================================================
-- PHASE 5: AI CHAT KNOWLEDGE BASE
-- =====================================================

-- Skincare knowledge base for AI Q&A
CREATE TABLE IF NOT EXISTS skincare_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL, -- 'ingredients', 'routines', 'concerns', 'myths', 'tips'
  topic VARCHAR(255) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  short_answer TEXT, -- Brief version for quick responses
  sources TEXT[], -- Scientific references
  keywords TEXT[],
  related_concerns TEXT[],
  related_ingredients TEXT[],
  difficulty_level VARCHAR(20) DEFAULT 'beginner', -- 'beginner', 'intermediate', 'advanced'
  is_active BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON skincare_knowledge(category, is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_keywords ON skincare_knowledge USING GIN(keywords);

-- =====================================================
-- PHASE 6: PREDICTIVE VISUALIZATION
-- =====================================================

-- User predictions
CREATE TABLE IF NOT EXISTS user_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES widget_users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES user_goals(id) ON DELETE CASCADE,
  face_scan_id UUID REFERENCES face_scans(id) ON DELETE SET NULL,
  metric VARCHAR(50) NOT NULL,
  prediction_date DATE NOT NULL,
  current_value INTEGER,
  predicted_value INTEGER,
  confidence_low INTEGER, -- Lower bound of confidence interval
  confidence_high INTEGER, -- Upper bound
  confidence_score DECIMAL(3,2),
  prediction_model VARCHAR(50), -- 'linear', 'exponential', 'historical_avg'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Generated face previews
CREATE TABLE IF NOT EXISTS face_previews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES widget_users(id) ON DELETE CASCADE,
  face_scan_id UUID NOT NULL REFERENCES face_scans(id) ON DELETE CASCADE,
  preview_type VARCHAR(50) NOT NULL, -- 'overlay', 'side_by_side', 'morph'
  timeframe_weeks INTEGER NOT NULL,
  preview_url TEXT,
  preview_data JSONB, -- Coordinates, adjustments, overlay data
  generation_model VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_predictions_user ON user_predictions(user_id, prediction_date DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_goal ON user_predictions(goal_id);
CREATE INDEX IF NOT EXISTS idx_previews_user ON face_previews(user_id, created_at DESC);
