import { pool } from '../config/database';
import { createError } from '../middleware/errorHandler';
import bcrypt from 'bcryptjs';

interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  email?: string;
}

export class UserService {
  async getUserProfile(userId: string): Promise<any> {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, role, team_id, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw createError('User not found', 404);
    }

    return result.rows[0];
  }

  async updateUserProfile(userId: string, data: UpdateProfileData): Promise<any> {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (data.first_name !== undefined) {
      fields.push(`first_name = $${paramCount}`);
      values.push(data.first_name);
      paramCount++;
    }

    if (data.last_name !== undefined) {
      fields.push(`last_name = $${paramCount}`);
      values.push(data.last_name);
      paramCount++;
    }

    if (data.email !== undefined) {
      // Check if email is already taken by another user
      const emailCheck = await pool.query(
        `SELECT id FROM users WHERE email = $1 AND id != $2`,
        [data.email, userId]
      );

      if (emailCheck.rows.length > 0) {
        throw createError('Email already in use', 400);
      }

      fields.push(`email = $${paramCount}`);
      values.push(data.email);
      paramCount++;
    }

    if (fields.length === 0) {
      throw createError('No fields to update', 400);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const query = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, first_name, last_name, role, team_id, updated_at
    `;

    const result = await pool.query(query, values);

    return result.rows[0];
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    // Get current password hash
    const userResult = await pool.query(
      `SELECT password FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw createError('User not found', 404);
    }

    const user = userResult.rows[0];

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);

    if (!isValid) {
      throw createError('Current password is incorrect', 400);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query(
      `UPDATE users
       SET password = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [hashedPassword, userId]
    );
  }
}

export default new UserService();
