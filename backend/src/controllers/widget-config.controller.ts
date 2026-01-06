import { Request, Response } from 'express';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth';

/**
 * Widget Configuration Controller
 * Handles widget customization settings
 */

/**
 * Get widget configuration for a store
 */
export const getWidgetConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { storeId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Check store access
    const storeResult = await pool.query(
      `SELECT user_id FROM stores WHERE id = $1`,
      [storeId]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    const store = storeResult.rows[0];

    // Check permissions
    if (store.user_id !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this store',
      });
    }

    // Get widget configuration
    const configResult = await pool.query(
      `SELECT * FROM widget_configs WHERE store_id = $1`,
      [storeId]
    );

    if (configResult.rows.length === 0) {
      // Return default configuration if none exists
      return res.json({
        success: true,
        data: null,
        message: 'No configuration found, using defaults',
      });
    }

    const config = configResult.rows[0];

    // Parse JSONB fields
    const parsedConfig = {
      ...config,
      quick_questions: config.quick_questions || [],
      allowed_domains: config.allowed_domains || [],
    };

    res.json({
      success: true,
      data: parsedConfig,
    });
  } catch (error: any) {
    console.error('Get widget config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get widget configuration',
      error: error.message,
    });
  }
};

/**
 * Update widget configuration for a store
 */
export const updateWidgetConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { storeId } = req.params;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const config = req.body;

    // Check store access
    const storeResult = await pool.query(
      `SELECT user_id FROM stores WHERE id = $1`,
      [storeId]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Store not found',
      });
    }

    const store = storeResult.rows[0];

    // Check permissions
    if (store.user_id !== userId && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to modify this store',
      });
    }

    // Check if configuration exists
    const existingConfig = await pool.query(
      `SELECT id FROM widget_configs WHERE store_id = $1`,
      [storeId]
    );

    if (existingConfig.rows.length === 0) {
      // Create new configuration
      await pool.query(
        `INSERT INTO widget_configs (
          store_id, widget_name, enabled, primary_color, secondary_color,
          text_color, background_color, position, widget_size, button_style,
          greeting_message, placeholder_text, button_text, powered_by_text,
          show_branding, auto_open, auto_open_delay, enable_sound,
          enable_typing_indicator, enable_product_search, enable_recommendations,
          enable_order_tracking, response_tone, quick_questions, custom_css,
          custom_js, logo_url, company_name
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28
        )`,
        [
          storeId,
          config.widget_name || 'AI Chat Assistant',
          config.enabled !== undefined ? config.enabled : true,
          config.primary_color || '#10b981',
          config.secondary_color || '#059669',
          config.text_color || '#1f2937',
          config.background_color || '#ffffff',
          config.position || 'bottom-right',
          config.widget_size || 'medium',
          config.button_style || 'pill',
          config.greeting_message || 'Hi! How can I help you today?',
          config.placeholder_text || 'Ask me anything...',
          config.button_text || 'Ask Anything',
          config.powered_by_text || 'Powered by Flash AI',
          config.show_branding !== undefined ? config.show_branding : true,
          config.auto_open || false,
          config.auto_open_delay || 0,
          config.enable_sound !== undefined ? config.enable_sound : true,
          config.enable_typing_indicator !== undefined ? config.enable_typing_indicator : true,
          config.enable_product_search !== undefined ? config.enable_product_search : true,
          config.enable_recommendations !== undefined ? config.enable_recommendations : true,
          config.enable_order_tracking || false,
          config.response_tone || 'friendly',
          JSON.stringify(config.quick_questions || []),
          config.custom_css || null,
          config.custom_js || null,
          config.logo_url || null,
          config.company_name || null,
        ]
      );
    } else {
      // Update existing configuration
      await pool.query(
        `UPDATE widget_configs SET
          widget_name = $2,
          enabled = $3,
          primary_color = $4,
          secondary_color = $5,
          text_color = $6,
          background_color = $7,
          position = $8,
          widget_size = $9,
          button_style = $10,
          greeting_message = $11,
          placeholder_text = $12,
          button_text = $13,
          powered_by_text = $14,
          show_branding = $15,
          auto_open = $16,
          auto_open_delay = $17,
          enable_sound = $18,
          enable_typing_indicator = $19,
          enable_product_search = $20,
          enable_recommendations = $21,
          enable_order_tracking = $22,
          response_tone = $23,
          quick_questions = $24,
          custom_css = $25,
          custom_js = $26,
          logo_url = $27,
          company_name = $28,
          updated_at = NOW()
        WHERE store_id = $1`,
        [
          storeId,
          config.widget_name || 'AI Chat Assistant',
          config.enabled !== undefined ? config.enabled : true,
          config.primary_color || '#10b981',
          config.secondary_color || '#059669',
          config.text_color || '#1f2937',
          config.background_color || '#ffffff',
          config.position || 'bottom-right',
          config.widget_size || 'medium',
          config.button_style || 'pill',
          config.greeting_message || 'Hi! How can I help you today?',
          config.placeholder_text || 'Ask me anything...',
          config.button_text || 'Ask Anything',
          config.powered_by_text || 'Powered by Flash AI',
          config.show_branding !== undefined ? config.show_branding : true,
          config.auto_open || false,
          config.auto_open_delay || 0,
          config.enable_sound !== undefined ? config.enable_sound : true,
          config.enable_typing_indicator !== undefined ? config.enable_typing_indicator : true,
          config.enable_product_search !== undefined ? config.enable_product_search : true,
          config.enable_recommendations !== undefined ? config.enable_recommendations : true,
          config.enable_order_tracking || false,
          config.response_tone || 'friendly',
          JSON.stringify(config.quick_questions || []),
          config.custom_css || null,
          config.custom_js || null,
          config.logo_url || null,
          config.company_name || null,
        ]
      );
    }

    res.json({
      success: true,
      message: 'Widget configuration updated successfully',
    });
  } catch (error: any) {
    console.error('Update widget config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update widget configuration',
      error: error.message,
    });
  }
};

/**
 * Get public widget configuration (for widget embed)
 */
export const getPublicWidgetConfig = async (req: Request, res: Response) => {
  try {
    const { storeId } = req.params;

    // Get widget configuration
    const configResult = await pool.query(
      `SELECT * FROM widget_configs WHERE store_id = $1 AND enabled = true`,
      [storeId]
    );

    if (configResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Widget not found or disabled',
      });
    }

    const config = configResult.rows[0];

    // Only return safe public fields
    const publicConfig = {
      primary_color: config.primary_color,
      secondary_color: config.secondary_color,
      text_color: config.text_color,
      background_color: config.background_color,
      position: config.position,
      widget_size: config.widget_size,
      button_style: config.button_style,
      widget_name: config.widget_name,
      button_text: config.button_text,
      powered_by_text: config.powered_by_text,
      show_branding: config.show_branding,
      greeting_message: config.greeting_message,
      placeholder_text: config.placeholder_text,
      auto_open: config.auto_open,
      auto_open_delay: config.auto_open_delay,
      enable_sound: config.enable_sound,
      enable_typing_indicator: config.enable_typing_indicator,
      quick_questions: config.quick_questions || [],
      custom_css: config.custom_css,
    };

    res.json({
      success: true,
      data: publicConfig,
    });
  } catch (error: any) {
    console.error('Get public widget config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get widget configuration',
      error: error.message,
    });
  }
};
