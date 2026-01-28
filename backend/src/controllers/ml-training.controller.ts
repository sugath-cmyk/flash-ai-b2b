/**
 * ML Training Controller
 *
 * API endpoints for:
 * - User feedback on scan results
 * - Admin dashboard for accuracy metrics
 * - Training data export
 */

import { Request, Response } from 'express';
import mlTrainingService from '../services/ml-training.service';

class MLTrainingController {

  /**
   * POST /api/ml/feedback
   * Record user feedback on scan results
   */
  async submitFeedback(req: Request, res: Response) {
    try {
      const {
        scanId,
        feedbacks // Array of { attribute, originalScore, originalGrade, correctedGrade, confidence, notes }
      } = req.body;

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      if (!scanId || !feedbacks || !Array.isArray(feedbacks) || feedbacks.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'scanId and feedbacks array required'
        });
      }

      const formattedFeedbacks = feedbacks.map((f: any) => ({
        scanId,
        userId,
        feedbackType: 'correction' as const,
        attribute: f.attribute,
        originalScore: f.originalScore,
        originalGrade: f.originalGrade,
        userCorrectedGrade: f.correctedGrade,
        confidence: f.confidence || 0.7,
        notes: f.notes,
        imageUrl: f.imageUrl,
        metadata: f.metadata
      }));

      const result = await mlTrainingService.recordBatchFeedback(formattedFeedbacks);

      res.json({
        success: true,
        message: `Recorded ${result.count} feedback items. Thank you for helping improve our accuracy!`,
        count: result.count
      });

    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/ml/feedback/quick
   * Quick feedback for a single attribute (e.g., "This is wrong")
   */
  async submitQuickFeedback(req: Request, res: Response) {
    try {
      const {
        scanId,
        attribute,
        originalScore,
        originalGrade,
        isCorrect, // true/false - quick feedback
        correctedGrade, // Optional: what it should be
        imageUrl
      } = req.body;

      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      if (!scanId || !attribute || originalScore === undefined || originalGrade === undefined) {
        return res.status(400).json({
          success: false,
          message: 'scanId, attribute, originalScore, and originalGrade required'
        });
      }

      // If user says it's correct, record confirmation
      // If user says it's wrong, record with estimated correction
      const feedbackType = isCorrect ? 'confirmation' : 'correction';

      // Estimate corrected grade if not provided
      let estimatedCorrectedGrade = correctedGrade;
      if (!isCorrect && correctedGrade === undefined) {
        // If AI said high (3-4), user probably means low (0-1)
        // If AI said low (0-1), user probably means higher (2-3)
        if (originalGrade >= 3) {
          estimatedCorrectedGrade = 1; // Assume they mean "not severe"
        } else if (originalGrade <= 1) {
          estimatedCorrectedGrade = 3; // Assume they mean "more than shown"
        } else {
          estimatedCorrectedGrade = originalGrade >= 2 ? 0 : 3;
        }
      }

      const result = await mlTrainingService.recordFeedback({
        scanId,
        userId,
        feedbackType,
        attribute,
        originalScore,
        originalGrade,
        userCorrectedGrade: isCorrect ? originalGrade : estimatedCorrectedGrade,
        confidence: isCorrect ? 0.9 : 0.6, // Higher confidence for confirmations
        imageUrl
      });

      res.json({
        success: true,
        message: isCorrect
          ? 'Thanks for confirming! This helps us know what we\'re getting right.'
          : 'Thanks for the feedback! We\'ll use this to improve our accuracy.',
        feedbackId: result.id
      });

    } catch (error: any) {
      console.error('Error submitting quick feedback:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/ml/metrics
   * Get accuracy metrics (admin only)
   */
  async getAccuracyMetrics(req: Request, res: Response) {
    try {
      const metrics = await mlTrainingService.getAccuracyMetrics();

      res.json({
        success: true,
        data: {
          metrics,
          summary: {
            averageAccuracy: metrics.length > 0
              ? metrics.reduce((sum, m) => sum + m.accuracy, 0) / metrics.length
              : 0,
            worstAttribute: metrics.length > 0
              ? metrics.reduce((worst, m) => m.accuracy < worst.accuracy ? m : worst).attribute
              : null,
            mostOverPredicted: metrics.length > 0
              ? metrics.reduce((worst, m) => m.overPredictionRate > worst.overPredictionRate ? m : worst).attribute
              : null
          }
        }
      });

    } catch (error: any) {
      console.error('Error getting metrics:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/ml/dashboard
   * Get dashboard stats (admin only)
   */
  async getDashboardStats(req: Request, res: Response) {
    try {
      const stats = await mlTrainingService.getDashboardStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error: any) {
      console.error('Error getting dashboard stats:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/ml/training-data
   * Export training data for model retraining (admin only)
   */
  async getTrainingData(req: Request, res: Response) {
    try {
      const {
        attribute,
        minConfidence,
        limit,
        excludeUsed
      } = req.query;

      const data = await mlTrainingService.getTrainingData({
        attribute: attribute as string,
        minConfidence: minConfidence ? parseFloat(minConfidence as string) : undefined,
        limit: limit ? parseInt(limit as string) : 1000,
        excludeUsedInTraining: excludeUsed === 'true'
      });

      res.json({
        success: true,
        data: {
          count: data.length,
          trainingData: data
        }
      });

    } catch (error: any) {
      console.error('Error getting training data:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * GET /api/ml/thresholds/:attribute
   * Get recommended threshold adjustments based on feedback
   */
  async getThresholdRecommendations(req: Request, res: Response) {
    try {
      const { attribute } = req.params;

      const recommendations = await mlTrainingService.calculateOptimalThresholds(attribute);

      res.json({
        success: true,
        data: {
          attribute,
          ...recommendations,
          recommendation: recommendations.currentBias === 'over'
            ? `AI is over-detecting ${attribute}. Consider increasing detection thresholds.`
            : recommendations.currentBias === 'under'
            ? `AI is under-detecting ${attribute}. Consider lowering detection thresholds.`
            : `${attribute} detection is reasonably calibrated.`
        }
      });

    } catch (error: any) {
      console.error('Error getting threshold recommendations:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/ml/expert-label
   * Record expert/dermatologist label (admin only)
   */
  async submitExpertLabel(req: Request, res: Response) {
    try {
      const {
        scanId,
        userId,
        attribute,
        originalScore,
        originalGrade,
        expertGrade,
        imageUrl,
        notes
      } = req.body;

      const expertId = (req as any).user?.id;

      const result = await mlTrainingService.recordFeedback({
        scanId,
        userId,
        feedbackType: 'expert_label',
        attribute,
        originalScore,
        originalGrade,
        expertLabel: expertGrade,
        confidence: 1.0, // Expert labels are high confidence
        imageUrl,
        notes,
        metadata: { labeledBy: expertId }
      });

      res.json({
        success: true,
        message: 'Expert label recorded',
        feedbackId: result.id
      });

    } catch (error: any) {
      console.error('Error submitting expert label:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export const mlTrainingController = new MLTrainingController();
export default mlTrainingController;
