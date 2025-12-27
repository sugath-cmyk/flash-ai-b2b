import { Router } from 'express';
import otpController, {
  sendEmailOTPValidation,
  sendPhoneOTPValidation,
  verifyOTPValidation,
} from '../controllers/otp.controller';

const router = Router();

// Public endpoints for OTP
router.post(
  '/send-email',
  sendEmailOTPValidation,
  otpController.sendEmailOTP.bind(otpController)
);

router.post(
  '/send-phone',
  sendPhoneOTPValidation,
  otpController.sendPhoneOTP.bind(otpController)
);

router.post(
  '/verify-email',
  verifyOTPValidation,
  otpController.verifyEmailOTP.bind(otpController)
);

router.post(
  '/verify-phone',
  verifyOTPValidation,
  otpController.verifyPhoneOTP.bind(otpController)
);

export default router;
