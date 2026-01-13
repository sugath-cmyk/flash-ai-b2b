import { Request, Response } from 'express';
import pool from '../config/database';

/**
 * Get widget settings for a store (chatbot + VTO)
 */
export async function getWidgetSettings(req: Request, res: Response) {
  try {
    const { storeId } = req.params;

    // Get widget settings
    const result = await pool.query(
      `SELECT
        chatbot_enabled,
        chatbot_mode,
        chatbot_position,
        chatbot_button_text,
        chatbot_primary_color,
        chatbot_welcome_message,
        chatbot_avatar_url,
        chatbot_tone,
        vto_enabled,
        vto_mode,
        vto_position,
        vto_button_text,
        vto_primary_color,
        widget_border_radius,
        widget_shadow,
        widget_animation,
        widget_z_index,
        created_at,
        updated_at
       FROM widget_settings
       WHERE store_id = $1`,
      [storeId]
    );

    if (result.rows.length === 0) {
      // Create default settings if not exists
      const insertResult = await pool.query(
        `INSERT INTO widget_settings (store_id, chatbot_enabled, vto_enabled)
         VALUES ($1, true, false)
         RETURNING *`,
        [storeId]
      );
      return res.json({ data: insertResult.rows[0] });
    }

    res.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Error getting widget settings:', error);
    res.status(500).json({
      error: 'Failed to get widget settings',
      message: error.message
    });
  }
}

/**
 * Update widget settings
 */
export async function updateWidgetSettings(req: Request, res: Response) {
  try {
    const { storeId } = req.params;
    const settings = req.body;

    // Build dynamic UPDATE query based on provided fields
    const updateFields = [];
    const values = [];
    let paramCounter = 1;

    // Chatbot settings
    if (settings.chatbot_enabled !== undefined) {
      updateFields.push(`chatbot_enabled = $${paramCounter++}`);
      values.push(settings.chatbot_enabled);
    }
    if (settings.chatbot_mode) {
      updateFields.push(`chatbot_mode = $${paramCounter++}`);
      values.push(settings.chatbot_mode);
    }
    if (settings.chatbot_position) {
      updateFields.push(`chatbot_position = $${paramCounter++}`);
      values.push(settings.chatbot_position);
    }
    if (settings.chatbot_button_text) {
      updateFields.push(`chatbot_button_text = $${paramCounter++}`);
      values.push(settings.chatbot_button_text);
    }
    if (settings.chatbot_primary_color) {
      updateFields.push(`chatbot_primary_color = $${paramCounter++}`);
      values.push(settings.chatbot_primary_color);
    }
    if (settings.chatbot_welcome_message) {
      updateFields.push(`chatbot_welcome_message = $${paramCounter++}`);
      values.push(settings.chatbot_welcome_message);
    }
    if (settings.chatbot_avatar_url) {
      updateFields.push(`chatbot_avatar_url = $${paramCounter++}`);
      values.push(settings.chatbot_avatar_url);
    }
    if (settings.chatbot_tone) {
      updateFields.push(`chatbot_tone = $${paramCounter++}`);
      values.push(settings.chatbot_tone);
    }

    // VTO settings
    if (settings.vto_enabled !== undefined) {
      updateFields.push(`vto_enabled = $${paramCounter++}`);
      values.push(settings.vto_enabled);
    }
    if (settings.vto_mode) {
      updateFields.push(`vto_mode = $${paramCounter++}`);
      values.push(settings.vto_mode);
    }
    if (settings.vto_position) {
      updateFields.push(`vto_position = $${paramCounter++}`);
      values.push(settings.vto_position);
    }
    if (settings.vto_button_text) {
      updateFields.push(`vto_button_text = $${paramCounter++}`);
      values.push(settings.vto_button_text);
    }
    if (settings.vto_primary_color) {
      updateFields.push(`vto_primary_color = $${paramCounter++}`);
      values.push(settings.vto_primary_color);
    }

    // Global widget settings
    if (settings.widget_border_radius !== undefined) {
      updateFields.push(`widget_border_radius = $${paramCounter++}`);
      values.push(settings.widget_border_radius);
    }
    if (settings.widget_shadow !== undefined) {
      updateFields.push(`widget_shadow = $${paramCounter++}`);
      values.push(settings.widget_shadow);
    }
    if (settings.widget_animation !== undefined) {
      updateFields.push(`widget_animation = $${paramCounter++}`);
      values.push(settings.widget_animation);
    }
    if (settings.widget_z_index !== undefined) {
      updateFields.push(`widget_z_index = $${paramCounter++}`);
      values.push(settings.widget_z_index);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(storeId);

    const query = `
      UPDATE widget_settings
      SET ${updateFields.join(', ')}
      WHERE store_id = $${paramCounter}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      // If no row found, create one
      const insertResult = await pool.query(
        `INSERT INTO widget_settings (store_id, chatbot_enabled, vto_enabled)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [storeId, settings.chatbot_enabled ?? true, settings.vto_enabled ?? false]
      );
      return res.json({
        data: insertResult.rows[0],
        message: 'Widget settings created successfully'
      });
    }

    res.json({
      data: result.rows[0],
      message: 'Widget settings updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating widget settings:', error);
    res.status(500).json({
      error: 'Failed to update widget settings',
      message: error.message
    });
  }
}

/**
 * Toggle widget on/off
 */
export async function toggleWidget(req: Request, res: Response) {
  try {
    const { storeId } = req.params;
    const { widgetType, enabled } = req.body; // widgetType: 'chatbot' | 'vto'

    if (!['chatbot', 'vto'].includes(widgetType)) {
      return res.status(400).json({ error: 'Invalid widget type' });
    }

    const field = widgetType === 'chatbot' ? 'chatbot_enabled' : 'vto_enabled';

    const result = await pool.query(
      `UPDATE widget_settings
       SET ${field} = $1, updated_at = NOW()
       WHERE store_id = $2
       RETURNING *`,
      [enabled, storeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Widget settings not found' });
    }

    res.json({
      data: result.rows[0],
      message: `${widgetType} widget ${enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error: any) {
    console.error('Error toggling widget:', error);
    res.status(500).json({
      error: 'Failed to toggle widget',
      message: error.message
    });
  }
}
