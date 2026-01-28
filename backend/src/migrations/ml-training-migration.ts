/**
 * ML Training Data Migration
 *
 * Creates tables for:
 * - scan_feedback: User/expert feedback on scan results
 * - ml_accuracy_metrics: Aggregated accuracy tracking
 * - ml_threshold_history: History of threshold adjustments
 */

import pool from '../config/database';

export async function runMLTrainingMigration(): Promise<void> {
  console.log('Running ML Training Data migration...');

  try {
    // 1. Create scan_feedback table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scan_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scan_id UUID NOT NULL,
        user_id UUID NOT NULL,
        feedback_type VARCHAR(50) NOT NULL, -- 'correction', 'confirmation', 'expert_label'
        attribute VARCHAR(50) NOT NULL, -- 'acne', 'dark_circles', 'pigmentation', etc.
        original_score INTEGER NOT NULL, -- AI's original score (0-100)
        original_grade INTEGER NOT NULL, -- AI's original grade (0-4)
        user_corrected_grade INTEGER, -- User's correction (0-4)
        expert_label INTEGER, -- Dermatologist/expert label (0-4)
        confidence DECIMAL(3,2) DEFAULT 0.7, -- User's confidence in feedback
        notes TEXT,
        image_url TEXT, -- S3/Cloud URL of the image for training
        metadata JSONB DEFAULT '{}',
        used_in_training BOOLEAN DEFAULT false,
        training_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT valid_feedback_type CHECK (feedback_type IN ('correction', 'confirmation', 'expert_label')),
        CONSTRAINT valid_original_grade CHECK (original_grade >= 0 AND original_grade <= 4),
        CONSTRAINT valid_user_grade CHECK (user_corrected_grade IS NULL OR (user_corrected_grade >= 0 AND user_corrected_grade <= 4)),
        CONSTRAINT valid_expert_label CHECK (expert_label IS NULL OR (expert_label >= 0 AND expert_label <= 4)),
        CONSTRAINT valid_confidence CHECK (confidence >= 0 AND confidence <= 1)
      )
    `);
    console.log('Created scan_feedback table');

    // 2. Create indexes for scan_feedback
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_scan_feedback_scan_id ON scan_feedback(scan_id);
      CREATE INDEX IF NOT EXISTS idx_scan_feedback_user_id ON scan_feedback(user_id);
      CREATE INDEX IF NOT EXISTS idx_scan_feedback_attribute ON scan_feedback(attribute);
      CREATE INDEX IF NOT EXISTS idx_scan_feedback_created_at ON scan_feedback(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_scan_feedback_training ON scan_feedback(used_in_training, confidence DESC)
        WHERE image_url IS NOT NULL AND (user_corrected_grade IS NOT NULL OR expert_label IS NOT NULL);
    `);
    console.log('Created scan_feedback indexes');

    // 3. Create ml_accuracy_metrics table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ml_accuracy_metrics (
        attribute VARCHAR(50) PRIMARY KEY,
        total_predictions INTEGER DEFAULT 0,
        correct_predictions INTEGER DEFAULT 0, -- Within 1 grade
        total_error DECIMAL(10,2) DEFAULT 0, -- Sum of absolute errors
        over_predictions INTEGER DEFAULT 0, -- AI predicted higher than human
        under_predictions INTEGER DEFAULT 0, -- AI predicted lower than human
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created ml_accuracy_metrics table');

    // 4. Create ml_threshold_history table (track threshold changes)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ml_threshold_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        attribute VARCHAR(50) NOT NULL,
        threshold_name VARCHAR(100) NOT NULL, -- e.g., 'contrast_threshold', 'saturation_min'
        old_value DECIMAL(10,4),
        new_value DECIMAL(10,4) NOT NULL,
        reason TEXT, -- Why the change was made
        feedback_sample_size INTEGER, -- How many feedback points informed this change
        expected_improvement DECIMAL(5,2), -- Expected accuracy improvement
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        applied_by VARCHAR(100) -- 'auto' or admin user ID
      )
    `);
    console.log('Created ml_threshold_history table');

    // 5. Create ml_training_queue table (for async training jobs)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ml_training_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        attribute VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
        training_data_count INTEGER DEFAULT 0,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        metrics_before JSONB,
        metrics_after JSONB,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created ml_training_queue table');

    // 6. Initialize accuracy metrics for all attributes
    const attributes = [
      'acne', 'dark_circles', 'pigmentation', 'redness',
      'wrinkles', 'hydration', 'oiliness', 'pores', 'texture'
    ];

    for (const attr of attributes) {
      await pool.query(`
        INSERT INTO ml_accuracy_metrics (attribute)
        VALUES ($1)
        ON CONFLICT (attribute) DO NOTHING
      `, [attr]);
    }
    console.log('Initialized accuracy metrics for all attributes');

    // 7. Create view for easy accuracy reporting
    await pool.query(`
      CREATE OR REPLACE VIEW ml_accuracy_report AS
      SELECT
        attribute,
        total_predictions,
        correct_predictions,
        CASE WHEN total_predictions > 0
          THEN ROUND(correct_predictions::decimal / total_predictions * 100, 1)
          ELSE 0
        END as accuracy_percent,
        CASE WHEN total_predictions > 0
          THEN ROUND(total_error / total_predictions, 2)
          ELSE 0
        END as mean_absolute_error,
        CASE WHEN total_predictions > 0
          THEN ROUND(over_predictions::decimal / total_predictions * 100, 1)
          ELSE 0
        END as over_prediction_percent,
        CASE WHEN total_predictions > 0
          THEN ROUND(under_predictions::decimal / total_predictions * 100, 1)
          ELSE 0
        END as under_prediction_percent,
        last_updated
      FROM ml_accuracy_metrics
      ORDER BY accuracy_percent ASC
    `);
    console.log('Created ml_accuracy_report view');

    console.log('ML Training Data migration completed successfully');

  } catch (error) {
    console.error('ML Training migration error:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  runMLTrainingMigration()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export default runMLTrainingMigration;
