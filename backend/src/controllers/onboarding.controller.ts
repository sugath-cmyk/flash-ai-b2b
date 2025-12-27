import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import onboardingService from '../services/onboarding.service';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

export const submitOnboardingValidation = [
  body('brandName').trim().notEmpty().withMessage('Brand name is required'),
  body('contactName').trim().notEmpty().withMessage('Contact name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('storeUrl').isURL().withMessage('Valid store URL is required'),
  body('storePlatform').trim().notEmpty().withMessage('Store platform is required'),
  body('businessAddress').trim().notEmpty().withMessage('Business address is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('state').trim().notEmpty().withMessage('State is required'),
  body('zipCode').trim().notEmpty().withMessage('ZIP code is required'),
  body('adminUsername').trim().isLength({ min: 3 }).withMessage('Admin username must be at least 3 characters'),
  body('adminPassword').isLength({ min: 8 }).withMessage('Admin password must be at least 8 characters'),
];

export class OnboardingController {
  // Public: Submit onboarding request
  async submitOnboarding(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const result = await onboardingService.submitOnboarding(req.body);

      res.json({
        success: true,
        message: 'Onboarding request submitted successfully',
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }

  // Admin: Get all onboarding requests
  async getAllRequests(req: AuthRequest, res: Response) {
    try {
      const { status } = req.query;
      const requests = await onboardingService.getAllRequests(status as string);

      res.json({
        success: true,
        data: requests,
      });
    } catch (error) {
      throw error;
    }
  }

  // Admin: Get single onboarding request
  async getRequest(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const request = await onboardingService.getRequest(id);

      res.json({
        success: true,
        data: request,
      });
    } catch (error) {
      throw error;
    }
  }

  // Admin: Update onboarding request
  async updateRequest(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const updated = await onboardingService.updateRequest(id, userId, req.body);

      res.json({
        success: true,
        message: 'Onboarding request updated',
        data: updated,
      });
    } catch (error) {
      throw error;
    }
  }

  // Admin: Approve onboarding request
  async approveRequest(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const adminId = req.user!.id;

      const result = await onboardingService.approveRequest(id, adminId);

      res.json({
        success: true,
        message: 'Brand onboarded successfully',
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }

  // Admin: Reject onboarding request
  async rejectRequest(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const adminId = req.user!.id;
      const { reason } = req.body;

      const result = await onboardingService.rejectRequest(id, adminId, reason);

      res.json({
        success: true,
        message: 'Onboarding request rejected',
        data: result,
      });
    } catch (error) {
      throw error;
    }
  }

  // Admin: Delete onboarding request
  async deleteRequest(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await onboardingService.deleteRequest(id);

      res.json({
        success: true,
        message: 'Onboarding request deleted',
      });
    } catch (error) {
      throw error;
    }
  }
}

export default new OnboardingController();
