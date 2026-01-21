-- Migration: Phased Routine System with Calendar Tracking
-- Based on International Dermatology Standards (AAD, Skin Cancer Foundation)
-- Date: 2026-01-21

-- ============================================================================
-- 1. Add user profile fields for age and skincare experience
-- ============================================================================

-- Add age and skincare profile to widget_users
ALTER TABLE widget_users ADD COLUMN IF NOT EXISTS age_range VARCHAR(20); -- 'teens', '20s', '30s', '40s', '50s', '60+'
ALTER TABLE widget_users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE widget_users ADD COLUMN IF NOT EXISTS skincare_experience VARCHAR(20); -- 'none', 'basic', 'intermediate', 'advanced'
ALTER TABLE widget_users ADD COLUMN IF NOT EXISTS skin_sensitivity VARCHAR(20); -- 'very_sensitive', 'moderate', 'tolerant'
ALTER TABLE widget_users ADD COLUMN IF NOT EXISTS routine_consistency VARCHAR(20); -- 'struggling', 'sometimes', 'consistent'
ALTER TABLE widget_users ADD COLUMN IF NOT EXISTS used_actives TEXT[]; -- ['retinol', 'vitamin_c', 'acids', 'niacinamide']
ALTER TABLE widget_users ADD COLUMN IF NOT EXISTS questionnaire_completed_at TIMESTAMP;

-- ============================================================================
-- 2. Create routine_phases table for tracking user's current phase
-- ============================================================================

CREATE TABLE IF NOT EXISTS routine_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES widget_users(id) ON DELETE CASCADE,
  phase_number INTEGER NOT NULL DEFAULT 1, -- 1: Foundation, 2: First Active, 3: Build Tolerance, 4: Full Routine
  phase_name VARCHAR(50) NOT NULL, -- 'foundation', 'first_active', 'build_tolerance', 'full_routine'
  started_at TIMESTAMP DEFAULT NOW(),
  target_end_at TIMESTAMP, -- Calculated: started_at + phase duration
  primary_concern VARCHAR(50), -- Top priority goal type (e.g., 'clear_acne')
  secondary_concern VARCHAR(50), -- Second priority goal type
  primary_active VARCHAR(100), -- The active ingredient being introduced (e.g., 'niacinamide')
  current_frequency VARCHAR(20) DEFAULT 'daily', -- 'daily', '2x_week', '3x_week', 'every_other_day'
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, phase_number)
);

-- Index for fast phase lookups
CREATE INDEX IF NOT EXISTS idx_routine_phases_user ON routine_phases(user_id, phase_number);
CREATE INDEX IF NOT EXISTS idx_routine_phases_active ON routine_phases(user_id) WHERE completed_at IS NULL;

-- ============================================================================
-- 3. Add phase tracking to routine_steps
-- ============================================================================

-- Add phase-related columns to routine_steps
ALTER TABLE routine_steps ADD COLUMN IF NOT EXISTS min_phase INTEGER DEFAULT 1; -- Minimum phase to show this step
ALTER TABLE routine_steps ADD COLUMN IF NOT EXISTS is_active_step BOOLEAN DEFAULT false; -- Is this an "active" ingredient step
ALTER TABLE routine_steps ADD COLUMN IF NOT EXISTS frequency_by_phase JSONB DEFAULT '{}'; -- {"1": "skip", "2": "2x_week", "3": "3x_week", "4": "daily"}

-- ============================================================================
-- 4. Enhance routine_logs for calendar tracking
-- ============================================================================

-- Add date field for calendar queries
ALTER TABLE routine_logs ADD COLUMN IF NOT EXISTS log_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE routine_logs ADD COLUMN IF NOT EXISTS routine_type VARCHAR(10); -- 'am' or 'pm' for separate tracking

-- Index for calendar queries
CREATE INDEX IF NOT EXISTS idx_routine_logs_calendar ON routine_logs(user_id, log_date, routine_type);
CREATE INDEX IF NOT EXISTS idx_routine_logs_month ON routine_logs(user_id, log_date);

-- ============================================================================
-- 5. Create phase advancement history for tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS phase_advancement_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES widget_users(id) ON DELETE CASCADE,
  from_phase INTEGER NOT NULL,
  to_phase INTEGER NOT NULL,
  advancement_type VARCHAR(20), -- 'manual', 'delayed', 'skipped_back'
  reason TEXT, -- Optional reason for manual advancement
  advanced_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phase_advancement_user ON phase_advancement_logs(user_id, advanced_at DESC);

-- ============================================================================
-- 6. Phase templates reference (read-only config)
-- ============================================================================

CREATE TABLE IF NOT EXISTS phase_templates (
  phase_number INTEGER PRIMARY KEY,
  phase_name VARCHAR(50) NOT NULL,
  duration_weeks INTEGER, -- NULL for ongoing (Phase 4)
  description TEXT,
  am_step_types TEXT[], -- Required AM steps for this phase
  pm_step_types TEXT[], -- Required PM steps for this phase
  active_frequency VARCHAR(20), -- Default frequency for actives
  tips JSONB DEFAULT '[]' -- Array of tips/guidance for this phase
);

-- Insert phase template data
INSERT INTO phase_templates (phase_number, phase_name, duration_weeks, description, am_step_types, pm_step_types, active_frequency, tips)
VALUES
  (1, 'Foundation', 2, 'Build healthy habits with core essentials. Focus on consistency, not complexity.',
   ARRAY['cleanser', 'moisturizer', 'sunscreen'],
   ARRAY['cleanser', 'moisturizer'],
   'daily',
   '[
     {"text": "Apply sunscreen every morning, even on cloudy days", "icon": "☀️"},
     {"text": "Use lukewarm water, not hot, when cleansing", "icon": "💧"},
     {"text": "Pat dry gently, don''t rub your face", "icon": "✋"}
   ]'::jsonb
  ),
  (2, 'First Active', 2, 'Introduce your first treatment product slowly. Start with 2x per week.',
   ARRAY['cleanser', 'moisturizer', 'sunscreen'],
   ARRAY['cleanser', 'serum', 'moisturizer'],
   '2x_week',
   '[
     {"text": "Apply treatment serum before moisturizer", "icon": "✨"},
     {"text": "Skip treatment nights if skin feels irritated", "icon": "⚠️"},
     {"text": "Slight tingling is normal, burning is not", "icon": "🔥"}
   ]'::jsonb
  ),
  (3, 'Build Tolerance', 2, 'Increase treatment frequency as skin adjusts. You''re building long-term resilience.',
   ARRAY['cleanser', 'moisturizer', 'sunscreen'],
   ARRAY['cleanser', 'serum', 'moisturizer'],
   '3x_week',
   '[
     {"text": "Now using treatment 3x per week", "icon": "📈"},
     {"text": "Continue monitoring for irritation", "icon": "👀"},
     {"text": "Results take 4-8 weeks to show", "icon": "⏰"}
   ]'::jsonb
  ),
  (4, 'Full Routine', NULL, 'Your complete personalized routine. Continue every other day, then daily if tolerated.',
   ARRAY['cleanser', 'toner', 'serum', 'eye_cream', 'moisturizer', 'sunscreen'],
   ARRAY['cleanser', 'exfoliant', 'toner', 'serum', 'treatment', 'eye_cream', 'moisturizer'],
   'every_other_day',
   '[
     {"text": "You''ve built a strong foundation!", "icon": "🎉"},
     {"text": "Listen to your skin and adjust as needed", "icon": "👂"},
     {"text": "Reassess routine every 3-6 months", "icon": "📅"}
   ]'::jsonb
  )
ON CONFLICT (phase_number) DO UPDATE SET
  phase_name = EXCLUDED.phase_name,
  duration_weeks = EXCLUDED.duration_weeks,
  description = EXCLUDED.description,
  am_step_types = EXCLUDED.am_step_types,
  pm_step_types = EXCLUDED.pm_step_types,
  active_frequency = EXCLUDED.active_frequency,
  tips = EXCLUDED.tips;

-- ============================================================================
-- 7. Age-based skin cycle reference (for UI/education)
-- ============================================================================

-- Skin cycle duration varies significantly by age (source: clinical dermatology research)
COMMENT ON COLUMN widget_users.age_range IS 'Age ranges and their skin cycle durations:
  teens: 14-21 days
  20s: 21-28 days
  30s: 28-35 days
  40s: 35-45 days
  50s: 45-60 days
  60+: 60-90 days

  Product efficacy should be judged after at least 1 full skin cycle.';

-- ============================================================================
-- 8. Update existing routine_steps to have phase info
-- ============================================================================

-- Mark basic steps as Phase 1
UPDATE routine_steps SET min_phase = 1, is_active_step = false
WHERE step_type IN ('cleanser', 'moisturizer', 'sunscreen');

-- Mark serums/actives as Phase 2+
UPDATE routine_steps SET min_phase = 2, is_active_step = true,
  frequency_by_phase = '{"1": "skip", "2": "2x_week", "3": "3x_week", "4": "every_other_day"}'::jsonb
WHERE step_type IN ('serum', 'treatment', 'exfoliant');

-- Mark optional/advanced steps as Phase 4
UPDATE routine_steps SET min_phase = 4, is_active_step = false
WHERE step_type IN ('toner', 'eye_cream', 'face_oil', 'makeup_remover');
