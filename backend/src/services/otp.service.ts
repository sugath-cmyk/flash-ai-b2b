import { pool } from '../config/database';
import nodemailer from 'nodemailer';
import { createError } from '../middleware/errorHandler';

export class OTPService {
  private transporter?: nodemailer.Transporter;

  constructor() {
    // Configure email transporter
    // For development, using a test account or console log
    // In production, use real SMTP credentials
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // Development mode - log emails to console
      console.log('⚠️  Email service running in development mode - OTPs will be logged to console');
    }
  }

  // Generate 6-digit OTP
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Send OTP via email
  async sendEmailOTP(email: string): Promise<{ success: boolean; message: string }> {
    try {
      // Generate OTP
      const otpCode = this.generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Delete any existing OTPs for this email
      await pool.query(
        'DELETE FROM otp_verifications WHERE email = $1 AND otp_type = $2',
        [email, 'email']
      );

      // Store OTP in database
      await pool.query(
        `INSERT INTO otp_verifications (email, otp_code, otp_type, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [email, otpCode, 'email', expiresAt]
      );

      // Send email
      if (this.transporter) {
        await this.transporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@askflash.ai',
          to: email,
          subject: 'Verify your email - AskFlash.ai',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #000;">Email Verification</h2>
              <p style="font-size: 16px; color: #333;">Your verification code is:</p>
              <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #000; margin: 20px 0;">
                ${otpCode}
              </div>
              <p style="font-size: 14px; color: #666;">This code will expire in 10 minutes.</p>
              <p style="font-size: 14px; color: #666;">If you didn't request this code, please ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              <p style="font-size: 12px; color: #999;">AskFlash.ai - Conversational Shopping AI</p>
            </div>
          `,
        });
      } else {
        // Development mode - log to console
        console.log('📧 EMAIL OTP for', email, ':', otpCode);
        console.log('   Expires at:', expiresAt.toISOString());
      }

      return {
        success: true,
        message: 'OTP sent to your email address',
      };
    } catch (error) {
      console.error('Error sending email OTP:', error);
      throw createError('Failed to send email OTP', 500);
    }
  }

  // Send OTP via SMS
  async sendPhoneOTP(phone: string): Promise<{ success: boolean; message: string }> {
    try {
      // Generate OTP
      const otpCode = this.generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Delete any existing OTPs for this phone
      await pool.query(
        'DELETE FROM otp_verifications WHERE phone = $1 AND otp_type = $2',
        [phone, 'phone']
      );

      // Store OTP in database
      await pool.query(
        `INSERT INTO otp_verifications (phone, otp_code, otp_type, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [phone, otpCode, 'phone', expiresAt]
      );

      // In production, integrate with SMS service like Twilio
      // For now, log to console for development
      console.log('📱 SMS OTP for', phone, ':', otpCode);
      console.log('   Expires at:', expiresAt.toISOString());

      // TODO: Integrate with Twilio or other SMS service
      // Example:
      // await twilioClient.messages.create({
      //   body: `Your AskFlash.ai verification code is: ${otpCode}. Valid for 10 minutes.`,
      //   to: phone,
      //   from: process.env.TWILIO_PHONE_NUMBER,
      // });

      return {
        success: true,
        message: 'OTP sent to your phone number',
      };
    } catch (error) {
      console.error('Error sending phone OTP:', error);
      throw createError('Failed to send phone OTP', 500);
    }
  }

  // Verify email OTP
  async verifyEmailOTP(email: string, otpCode: string): Promise<boolean> {
    try {
      const result = await pool.query(
        `SELECT * FROM otp_verifications
         WHERE email = $1 AND otp_code = $2 AND otp_type = $3
         AND expires_at > NOW() AND verified = FALSE
         ORDER BY created_at DESC LIMIT 1`,
        [email, otpCode, 'email']
      );

      if (result.rows.length === 0) {
        return false;
      }

      // Mark as verified
      await pool.query(
        'UPDATE otp_verifications SET verified = TRUE, updated_at = NOW() WHERE id = $1',
        [result.rows[0].id]
      );

      return true;
    } catch (error) {
      console.error('Error verifying email OTP:', error);
      return false;
    }
  }

  // Verify phone OTP
  async verifyPhoneOTP(phone: string, otpCode: string): Promise<boolean> {
    try {
      const result = await pool.query(
        `SELECT * FROM otp_verifications
         WHERE phone = $1 AND otp_code = $2 AND otp_type = $3
         AND expires_at > NOW() AND verified = FALSE
         ORDER BY created_at DESC LIMIT 1`,
        [phone, otpCode, 'phone']
      );

      if (result.rows.length === 0) {
        return false;
      }

      // Mark as verified
      await pool.query(
        'UPDATE otp_verifications SET verified = TRUE, updated_at = NOW() WHERE id = $1',
        [result.rows[0].id]
      );

      return true;
    } catch (error) {
      console.error('Error verifying phone OTP:', error);
      return false;
    }
  }

  // Clean up expired OTPs (should be called periodically)
  async cleanupExpiredOTPs(): Promise<void> {
    try {
      await pool.query('DELETE FROM otp_verifications WHERE expires_at < NOW()');
    } catch (error) {
      console.error('Error cleaning up expired OTPs:', error);
    }
  }
}

export default new OTPService();
