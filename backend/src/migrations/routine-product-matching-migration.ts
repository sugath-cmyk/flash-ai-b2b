/**
 * Routine Product Matching Migration
 * Adds columns for actual product matching and scan-based recommendations
 */

export const ROUTINE_PRODUCT_MATCHING_MIGRATION_SQL = `
-- Migration: Routine Product Matching
-- Created: 2026-01-28
-- Description: Add columns for actual product matching, scan-based reasoning, and phase support

-- Add new columns to routine_steps for actual product matching
ALTER TABLE routine_steps ADD COLUMN IF NOT EXISTS recommendation_reason TEXT;
ALTER TABLE routine_steps ADD COLUMN IF NOT EXISTS scan_score INTEGER;
ALTER TABLE routine_steps ADD COLUMN IF NOT EXISTS concern_addressed VARCHAR(50);
ALTER TABLE routine_steps ADD COLUMN IF NOT EXISTS is_active_step BOOLEAN DEFAULT false;
ALTER TABLE routine_steps ADD COLUMN IF NOT EXISTS min_phase INTEGER DEFAULT 1;

-- Add routine phases table for graduated routine system
CREATE TABLE IF NOT EXISTS routine_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES widget_users(id) ON DELETE CASCADE,
  phase_number INTEGER NOT NULL,
  phase_name VARCHAR(50) NOT NULL,
  started_at TIMESTAMP DEFAULT NOW(),
  target_end_at TIMESTAMP,
  primary_concern VARCHAR(50),
  secondary_concern VARCHAR(50),
  primary_active VARCHAR(50),
  current_frequency VARCHAR(50) DEFAULT 'daily',
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, phase_number)
);

-- Phase advancement logs for tracking user progress
CREATE TABLE IF NOT EXISTS phase_advancement_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES widget_users(id) ON DELETE CASCADE,
  from_phase INTEGER NOT NULL,
  to_phase INTEGER NOT NULL,
  advancement_type VARCHAR(20) NOT NULL, -- 'manual', 'auto', 'skip'
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add questionnaire fields to widget_users
ALTER TABLE widget_users ADD COLUMN IF NOT EXISTS skincare_experience VARCHAR(20);
ALTER TABLE widget_users ADD COLUMN IF NOT EXISTS skin_sensitivity VARCHAR(20);
ALTER TABLE widget_users ADD COLUMN IF NOT EXISTS routine_consistency VARCHAR(20);
ALTER TABLE widget_users ADD COLUMN IF NOT EXISTS used_actives TEXT[];
ALTER TABLE widget_users ADD COLUMN IF NOT EXISTS age_range VARCHAR(10);
ALTER TABLE widget_users ADD COLUMN IF NOT EXISTS questionnaire_completed_at TIMESTAMP;

-- Indexes for phase management
CREATE INDEX IF NOT EXISTS idx_routine_phases_user ON routine_phases(user_id, phase_number);
CREATE INDEX IF NOT EXISTS idx_routine_phases_active ON routine_phases(user_id, completed_at) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_phase_logs_user ON phase_advancement_logs(user_id, created_at DESC);
`;

// Function to run the migration
export async function runRoutineProductMatchingMigration(pool: any): Promise<void> {
  try {
    console.log('[Migration] Starting Routine Product Matching migration...');
    await pool.query(ROUTINE_PRODUCT_MATCHING_MIGRATION_SQL);
    console.log('[Migration] Routine Product Matching migration completed successfully');
  } catch (error: any) {
    console.error('[Migration] Routine Product Matching migration failed:', error.message);
    throw error;
  }
}
