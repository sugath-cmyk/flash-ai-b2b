import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import otpService from '../services/otp.service';
import { createError } from '../middleware/errorHandler';

export const sendEmailOTPValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
];

export const sendPhoneOTPValidation = [
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
];

export const verifyOTPValidation = [
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('phone').optional().trim().notEmpty().withMessage('Valid phone required'),
  body('otpCode').trim().isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
];

class OTPController {
  async sendEmailOTP(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { email } = req.body;
      const result = await otpService.sendEmailOTP(email);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  async sendPhoneOTP(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { phone } = req.body;
      const result = await otpService.sendPhoneOTP(phone);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyEmailOTP(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { email, otpCode } = req.body;
      const isValid = await otpService.verifyEmailOTP(email, otpCode);

      if (!isValid) {
        throw createError('Invalid or expired OTP', 400);
      }

      res.json({
        success: true,
        message: 'Email verified successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyPhoneOTP(req: Request, res: Response, next: NextFunction) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { phone, otpCode } = req.body;
      const isValid = await otpService.verifyPhoneOTP(phone, otpCode);

      if (!isValid) {
        throw createError('Invalid or expired OTP', 400);
      }

      res.json({
        success: true,
        message: 'Phone verified successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new OTPController();
