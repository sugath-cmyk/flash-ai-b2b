import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../config/database';
import { createError } from '../middleware/errorHandler';

// Use existing store for demo/test - this store has working face scans
const DEMO_FALLBACK_STORE_UUID = '62130715-ff42-4160-934e-c663fc1e7872';

interface RegisterData {
  storeId: string;
  email?: string;
  phone?: string;
  password: string;
  firstName?: string;
  lastName?: string;
  visitorId?: string;
}

interface LoginData {
  storeId: string;
  email?: string;
  phone?: string;
  password: string;
}

interface WidgetUserData {
  id: string;
  storeId: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  skinProfile: Record<string, any>;
  preferences: Record<string, any>;
  isVerified: boolean;
}

interface AuthResponse {
  user: WidgetUserData;
  accessToken: string;
  refreshToken: string;
}

export class WidgetAuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private readonly JWT_EXPIRES_IN = '24h';
  private readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';
  private readonly JWT_REFRESH_EXPIRES_IN = '30d';

  async register(data: RegisterData): Promise<AuthResponse> {
    const { storeId: rawStoreId, email, phone, password, firstName, lastName, visitorId } = data;

    // Handle demo stores - use fallback UUID for database foreign key
    const isDemoStore = rawStoreId === 'demo-store' || rawStoreId === 'demo' || rawStoreId === 'test';
    const storeId = isDemoStore ? DEMO_FALLBACK_STORE_UUID : rawStoreId;

    if (!email && !phone) {
      throw createError('Email or phone is required', 400);
    }

    // Check if user already exists
    if (email) {
      const existingEmail = await pool.query(
        'SELECT id FROM widget_users WHERE store_id = $1 AND email = $2',
        [storeId, email.toLowerCase()]
      );
      if (existingEmail.rows.length > 0) {
        throw createError('Email already registered', 400);
      }
    }

    if (phone) {
      const existingPhone = await pool.query(
        'SELECT id FROM widget_users WHERE store_id = $1 AND phone = $2',
        [storeId, phone]
      );
      if (existingPhone.rows.length > 0) {
        throw createError('Phone number already registered', 400);
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate display name
    const displayName = firstName ? `${firstName}${lastName ? ' ' + lastName : ''}` : email?.split('@')[0] || phone;

    // Create user
    const result = await pool.query(
      `INSERT INTO widget_users (
        store_id, email, phone, password_hash, first_name, last_name,
        display_name, visitor_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        storeId,
        email?.toLowerCase() || null,
        phone || null,
        passwordHash,
        firstName || null,
        lastName || null,
        displayName,
        visitorId || null,
      ]
    );

    const user = result.rows[0];

    // If visitor_id provided, link existing scans to this user
    if (visitorId) {
      await this.linkVisitorScans(user.id, storeId, visitorId);
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateAndStoreRefreshToken(user);

    return {
      user: this.formatUser(user),
      accessToken,
      refreshToken,
    };
  }

  async login(data: LoginData): Promise<AuthResponse> {
    const { storeId: rawStoreId, email, phone, password } = data;

    // Handle demo stores
    const isDemoStore = rawStoreId === 'demo-store' || rawStoreId === 'demo' || rawStoreId === 'test';
    const storeId = isDemoStore ? DEMO_FALLBACK_STORE_UUID : rawStoreId;

    if (!email && !phone) {
      throw createError('Email or phone is required', 400);
    }

    // Find user
    let result;
    if (email) {
      result = await pool.query(
        `SELECT * FROM widget_users WHERE store_id = $1 AND email = $2`,
        [storeId, email.toLowerCase()]
      );
    } else {
      result = await pool.query(
        `SELECT * FROM widget_users WHERE store_id = $1 AND phone = $2`,
        [storeId, phone]
      );
    }

    if (result.rows.length === 0) {
      throw createError('Invalid credentials', 401);
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      throw createError('Account is disabled', 401);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw createError('Invalid credentials', 401);
    }

    // Update last login
    await pool.query(
      'UPDATE widget_users SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateAndStoreRefreshToken(user);

    return {
      user: this.formatUser(user),
      accessToken,
      refreshToken,
    };
  }

  async linkVisitor(userId: string, visitorId: string): Promise<{ linked: number }> {
    // Get user's store_id
    const userResult = await pool.query(
      'SELECT store_id FROM widget_users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw createError('User not found', 404);
    }

    const storeId = userResult.rows[0].store_id;

    // Update user's visitor_id
    await pool.query(
      'UPDATE widget_users SET visitor_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [visitorId, userId]
    );

    // Link existing scans
    const linkedCount = await this.linkVisitorScans(userId, storeId, visitorId);

    return { linked: linkedCount };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    // Verify token exists and is valid in database
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const tokenResult = await pool.query(
      `SELECT t.*, u.* FROM widget_auth_tokens t
       JOIN widget_users u ON t.user_id = u.id
       WHERE t.token_hash = $1 AND t.token_type = 'refresh'
       AND t.expires_at > NOW() AND t.revoked_at IS NULL`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      throw createError('Invalid or expired refresh token', 401);
    }

    const row = tokenResult.rows[0];

    // Check if user is active
    if (!row.is_active) {
      throw createError('Account is disabled', 401);
    }

    // Revoke old refresh token
    await pool.query(
      'UPDATE widget_auth_tokens SET revoked_at = NOW() WHERE token_hash = $1',
      [tokenHash]
    );

    // Generate new tokens
    const user = {
      id: row.user_id,
      store_id: row.store_id,
      email: row.email,
    };

    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = await this.generateAndStoreRefreshToken(user);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Revoke specific refresh token
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await pool.query(
        'UPDATE widget_auth_tokens SET revoked_at = NOW() WHERE user_id = $1 AND token_hash = $2',
        [userId, tokenHash]
      );
    } else {
      // Revoke all refresh tokens for user
      await pool.query(
        'UPDATE widget_auth_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
        [userId]
      );
    }
  }

  async getUserById(userId: string): Promise<WidgetUserData | null> {
    const result = await pool.query(
      'SELECT * FROM widget_users WHERE id = $1 AND is_active = true',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.formatUser(result.rows[0]);
  }

  async updateProfile(userId: string, updates: Partial<{
    firstName: string;
    lastName: string;
    displayName: string;
    avatarUrl: string;
    skinProfile: Record<string, any>;
    preferences: Record<string, any>;
  }>): Promise<WidgetUserData> {
    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.firstName !== undefined) {
      setFields.push(`first_name = $${paramIndex++}`);
      values.push(updates.firstName);
    }
    if (updates.lastName !== undefined) {
      setFields.push(`last_name = $${paramIndex++}`);
      values.push(updates.lastName);
    }
    if (updates.displayName !== undefined) {
      setFields.push(`display_name = $${paramIndex++}`);
      values.push(updates.displayName);
    }
    if (updates.avatarUrl !== undefined) {
      setFields.push(`avatar_url = $${paramIndex++}`);
      values.push(updates.avatarUrl);
    }
    if (updates.skinProfile !== undefined) {
      setFields.push(`skin_profile = $${paramIndex++}`);
      values.push(JSON.stringify(updates.skinProfile));
    }
    if (updates.preferences !== undefined) {
      setFields.push(`preferences = $${paramIndex++}`);
      values.push(JSON.stringify(updates.preferences));
    }

    if (setFields.length === 0) {
      throw createError('No valid updates provided', 400);
    }

    setFields.push(`updated_at = NOW()`);
    values.push(userId);

    const result = await pool.query(
      `UPDATE widget_users SET ${setFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw createError('User not found', 404);
    }

    return this.formatUser(result.rows[0]);
  }

  async verifyAccessToken(token: string): Promise<{ userId: string; storeId: string }> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as {
        id: string;
        storeId: string;
        type: string;
      };

      if (decoded.type !== 'widget_access') {
        throw createError('Invalid token type', 401);
      }

      return { userId: decoded.id, storeId: decoded.storeId };
    } catch (error) {
      throw createError('Invalid or expired token', 401);
    }
  }

  private async linkVisitorScans(userId: string, storeId: string, visitorId: string): Promise<number> {
    // Link face scans from visitor to user
    const scanResult = await pool.query(
      `UPDATE face_scans
       SET visitor_id = $1
       WHERE store_id = $2 AND visitor_id = $3 AND visitor_id != $1
       RETURNING id`,
      [visitorId, storeId, visitorId]
    );

    // Create progress snapshots for linked scans
    for (const scan of scanResult.rows) {
      await this.createProgressSnapshot(userId, storeId, scan.id);
    }

    return scanResult.rows.length;
  }

  private async createProgressSnapshot(userId: string, storeId: string, faceScanId: string): Promise<void> {
    try {
      // Get scan analysis results
      const scanResult = await pool.query(
        'SELECT analysis_result FROM face_scans WHERE id = $1',
        [faceScanId]
      );

      if (scanResult.rows.length === 0 || !scanResult.rows[0].analysis_result) {
        return;
      }

      const analysis = scanResult.rows[0].analysis_result;
      const scores = analysis.scores || {};

      // Check if progress snapshot already exists
      const existing = await pool.query(
        'SELECT id FROM user_progress WHERE user_id = $1 AND face_scan_id = $2',
        [userId, faceScanId]
      );

      if (existing.rows.length > 0) {
        return;
      }

      // Get previous snapshot for change calculation
      const prevSnapshot = await pool.query(
        `SELECT * FROM user_progress
         WHERE user_id = $1 AND store_id = $2
         ORDER BY snapshot_date DESC LIMIT 1`,
        [userId, storeId]
      );

      let changes = {};
      let previousSnapshotId = null;

      if (prevSnapshot.rows.length > 0) {
        const prev = prevSnapshot.rows[0];
        previousSnapshotId = prev.id;
        changes = {
          skin_score: (scores.overall || 0) - (prev.skin_score || 0),
          acne_score: (scores.acne || 0) - (prev.acne_score || 0),
          wrinkle_score: (scores.wrinkles || 0) - (prev.wrinkle_score || 0),
          hydration_score: (scores.hydration || 0) - (prev.hydration_score || 0),
          pigmentation_score: (scores.pigmentation || 0) - (prev.pigmentation_score || 0),
          texture_score: (scores.texture || 0) - (prev.texture_score || 0),
        };
      }

      // Insert progress snapshot
      await pool.query(
        `INSERT INTO user_progress (
          user_id, store_id, face_scan_id, snapshot_date,
          skin_score, acne_score, wrinkle_score, hydration_score,
          pigmentation_score, texture_score, redness_score, oiliness_score,
          skin_age_estimate, previous_snapshot_id, changes
        ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          userId,
          storeId,
          faceScanId,
          scores.overall || null,
          scores.acne || null,
          scores.wrinkles || null,
          scores.hydration || null,
          scores.pigmentation || null,
          scores.texture || null,
          scores.redness || null,
          scores.oiliness || null,
          analysis.skinAge || null,
          previousSnapshotId,
          JSON.stringify(changes),
        ]
      );
    } catch (error) {
      console.error('[WidgetAuth] Error creating progress snapshot:', error);
    }
  }

  private generateAccessToken(user: any): string {
    return jwt.sign(
      {
        id: user.id,
        storeId: user.store_id,
        email: user.email,
        type: 'widget_access',
      },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN }
    );
  }

  private async generateAndStoreRefreshToken(user: any): Promise<string> {
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Calculate expiry (30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await pool.query(
      `INSERT INTO widget_auth_tokens (user_id, token_hash, token_type, expires_at)
       VALUES ($1, $2, 'refresh', $3)`,
      [user.id, tokenHash, expiresAt]
    );

    return refreshToken;
  }

  private formatUser(user: any): WidgetUserData {
    return {
      id: user.id,
      storeId: user.store_id,
      email: user.email,
      phone: user.phone,
      firstName: user.first_name,
      lastName: user.last_name,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      skinProfile: user.skin_profile || {},
      preferences: user.preferences || {},
      isVerified: user.is_verified || false,
    };
  }
}

export default new WidgetAuthService();
