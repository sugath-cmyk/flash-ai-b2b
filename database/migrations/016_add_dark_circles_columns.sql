-- Migration: Add Dark Circles Detail Columns
-- Created: 2026-01-29
-- Description: Add left/right severity and regions columns for dark circles analysis

-- Add dark circles detail columns to face_analysis
ALTER TABLE face_analysis
ADD COLUMN IF NOT EXISTS dark_circles_left_severity FLOAT,
ADD COLUMN IF NOT EXISTS dark_circles_right_severity FLOAT,
ADD COLUMN IF NOT EXISTS dark_circles_regions JSONB;

-- Add comments
COMMENT ON COLUMN face_analysis.dark_circles_left_severity IS 'Dark circles severity for left eye (0-1 scale)';
COMMENT ON COLUMN face_analysis.dark_circles_right_severity IS 'Dark circles severity for right eye (0-1 scale)';
COMMENT ON COLUMN face_analysis.dark_circles_regions IS 'Detailed regions with bounding boxes and severity';
