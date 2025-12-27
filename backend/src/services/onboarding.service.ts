import { pool } from '../config/database';
import { createError } from '../middleware/errorHandler';
import bcrypt from 'bcryptjs';

interface OnboardingData {
  brandName: string;
  contactName: string;
  email: string;
  phone: string;
  storeUrl: string;
  storePlatform: string;
  businessAddress: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  gstNumber?: string;
  monthlyTraffic?: string;
  currentSupport?: string;
  hearAboutUs?: string;
  additionalInfo?: string;
  adminUsername: string;
  adminPassword: string;
}

export class OnboardingService {
  // Submit onboarding request
  async submitOnboarding(data: OnboardingData): Promise<any> {
    // Check if email already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [data.email]
    );

    if (existingUser.rows.length > 0) {
      throw createError('An account with this email already exists', 400);
    }

    const existingRequest = await pool.query(
      'SELECT id FROM onboarding_requests WHERE email = $1',
      [data.email]
    );

    if (existingRequest.rows.length > 0) {
      throw createError('An application with this email already exists', 400);
    }

    // Hash the admin password
    const hashedPassword = await bcrypt.hash(data.adminPassword, 10);

    const result = await pool.query(
      `INSERT INTO onboarding_requests (
        brand_name, contact_name, email, phone, store_url, store_platform,
        business_address, city, state, zip_code, country, gst_number,
        monthly_traffic, current_support, hear_about_us, additional_info,
        admin_username, admin_password_hash, email_verified, phone_verified, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, true, true, 'pending')
      RETURNING id, brand_name, email, admin_username, status, created_at`,
      [
        data.brandName, data.contactName, data.email, data.phone,
        data.storeUrl, data.storePlatform, data.businessAddress,
        data.city, data.state, data.zipCode, data.country,
        data.gstNumber, data.monthlyTraffic, data.currentSupport,
        data.hearAboutUs, data.additionalInfo, data.adminUsername,
        hashedPassword
      ]
    );

    return result.rows[0];
  }

  // Get all onboarding requests (admin)
  async getAllRequests(status?: string): Promise<any[]> {
    let query = 'SELECT * FROM onboarding_requests';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get single onboarding request
  async getRequest(id: string): Promise<any> {
    const result = await pool.query(
      'SELECT * FROM onboarding_requests WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw createError('Onboarding request not found', 404);
    }

    return result.rows[0];
  }

  // Update onboarding request
  async updateRequest(id: string, userId: string, data: Partial<OnboardingData> & { status?: string; adminNotes?: string }): Promise<any> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Build dynamic update query
    Object.keys(data).forEach((key) => {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${snakeKey} = $${paramCount}`);
      values.push((data as any)[key]);
      paramCount++;
    });

    if (fields.length === 0) {
      throw createError('No fields to update', 400);
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE onboarding_requests
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    return result.rows[0];
  }

  // Approve onboarding request and create brand account
  async approveRequest(requestId: string, adminId: string): Promise<any> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get onboarding request
      const requestResult = await client.query(
        'SELECT * FROM onboarding_requests WHERE id = $1',
        [requestId]
      );

      if (requestResult.rows.length === 0) {
        throw createError('Onboarding request not found', 404);
      }

      const request = requestResult.rows[0];

      if (request.status === 'approved') {
        throw createError('Request already approved', 400);
      }

      // Create store
      const storeResult = await client.query(
        `INSERT INTO stores (user_id, platform, store_url, store_name, domain, sync_status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         RETURNING id`,
        [
          adminId,  // Temporarily assign to admin, will change to brand owner
          request.store_platform,
          request.store_url,
          request.brand_name,
          new URL(request.store_url).hostname
        ]
      );

      const storeId = storeResult.rows[0].id;

      // Use stored admin credentials from onboarding request
      const adminUsername = request.admin_username;
      const adminPasswordHash = request.admin_password_hash;

      if (!adminPasswordHash) {
        throw createError('Admin credentials not found in onboarding request', 400);
      }

      // Create brand owner user with provided credentials
      const userResult = await client.query(
        `INSERT INTO users (email, password, first_name, last_name, role, store_id)
         VALUES ($1, $2, $3, $4, 'brand_owner', $5)
         RETURNING id`,
        [
          request.email,
          adminPasswordHash,  // Use stored hashed password
          request.contact_name.split(' ')[0],
          request.contact_name.split(' ').slice(1).join(' ') || request.contact_name,
          storeId
        ]
      );

      const userId = userResult.rows[0].id;

      // Update store owner
      await client.query(
        'UPDATE stores SET user_id = $1 WHERE id = $2',
        [userId, storeId]
      );

      // Create brand profile
      await client.query(
        `INSERT INTO brand_profiles (
          store_id, user_id, brand_name, contact_name, email, phone,
          business_address, city, state, zip_code, country, gst_number, website_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          storeId, userId, request.brand_name, request.contact_name,
          request.email, request.phone, request.business_address,
          request.city, request.state, request.zip_code, request.country,
          request.gst_number, request.store_url
        ]
      );

      // Update onboarding request status
      await client.query(
        `UPDATE onboarding_requests
         SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [adminId, requestId]
      );

      await client.query('COMMIT');

      return {
        storeId,
        userId,
        email: request.email,
        username: adminUsername,
        message: 'Brand owner account created successfully. User can now login with their provided credentials.',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Reject onboarding request
  async rejectRequest(requestId: string, adminId: string, reason?: string): Promise<any> {
    const result = await pool.query(
      `UPDATE onboarding_requests
       SET status = 'rejected', approved_by = $1, approved_at = CURRENT_TIMESTAMP, admin_notes = $2
       WHERE id = $3
       RETURNING *`,
      [adminId, reason, requestId]
    );

    if (result.rows.length === 0) {
      throw createError('Onboarding request not found', 404);
    }

    return result.rows[0];
  }

  // Delete onboarding request
  async deleteRequest(id: string): Promise<void> {
    const result = await pool.query(
      'DELETE FROM onboarding_requests WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      throw createError('Onboarding request not found', 404);
    }
  }
}

export default new OnboardingService();
