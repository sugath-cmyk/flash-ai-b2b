-- Migration: Add Widget Settings
-- Created: 2026-01-13
-- Description: Centralized widget management for chatbot and VTO widgets

-- Widget Settings - Master configuration for all widgets
CREATE TABLE IF NOT EXISTS widget_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Chatbot Widget
  chatbot_enabled BOOLEAN DEFAULT true,
  chatbot_mode VARCHAR(20) DEFAULT 'floating', -- 'floating' | 'inline' | 'both'
  chatbot_position VARCHAR(20) DEFAULT 'bottom-right',
  chatbot_button_text VARCHAR(50) DEFAULT 'Chat',
  chatbot_primary_color VARCHAR(7) DEFAULT '#000000',
  chatbot_welcome_message TEXT DEFAULT 'Hi! How can I help you today?',
  chatbot_avatar_url TEXT,
  chatbot_tone VARCHAR(20) DEFAULT 'friendly', -- 'friendly' | 'professional' | 'casual'

  -- VTO Widget (duplicate from vto_settings for centralized management)
  vto_enabled BOOLEAN DEFAULT false,
  vto_mode VARCHAR(20) DEFAULT 'floating',
  vto_position VARCHAR(20) DEFAULT 'bottom-right',
  vto_button_text VARCHAR(50) DEFAULT 'Try On',
  vto_primary_color VARCHAR(7) DEFAULT '#000000',

  -- Global Widget Settings
  widget_border_radius INTEGER DEFAULT 8, -- in pixels
  widget_shadow BOOLEAN DEFAULT true,
  widget_animation BOOLEAN DEFAULT true,
  widget_z_index INTEGER DEFAULT 999999,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(store_id)
);

-- Migrate existing VTO settings to widget_settings
INSERT INTO widget_settings (
  store_id,
  vto_enabled,
  vto_mode,
  vto_position,
  vto_button_text,
  vto_primary_color,
  created_at,
  updated_at
)
SELECT
  store_id,
  enabled,
  mode,
  button_position,
  button_text,
  primary_color,
  created_at,
  updated_at
FROM vto_settings
ON CONFLICT (store_id) DO UPDATE SET
  vto_enabled = EXCLUDED.vto_enabled,
  vto_mode = EXCLUDED.vto_mode,
  vto_position = EXCLUDED.vto_position,
  vto_button_text = EXCLUDED.vto_button_text,
  vto_primary_color = EXCLUDED.vto_primary_color,
  updated_at = NOW();

-- Create widget_settings for all existing stores that don't have settings yet
INSERT INTO widget_settings (store_id, chatbot_enabled, vto_enabled)
SELECT id, true, false
FROM stores
WHERE id NOT IN (SELECT store_id FROM widget_settings)
ON CONFLICT (store_id) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_widget_settings_store_id ON widget_settings(store_id);
CREATE INDEX IF NOT EXISTS idx_widget_settings_chatbot_enabled ON widget_settings(chatbot_enabled);
CREATE INDEX IF NOT EXISTS idx_widget_settings_vto_enabled ON widget_settings(vto_enabled);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_widget_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_widget_settings_updated_at ON widget_settings;
CREATE TRIGGER update_widget_settings_updated_at
  BEFORE UPDATE ON widget_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_widget_settings_updated_at();

-- NOTE: We keep vto_settings table for backward compatibility and detailed VTO-specific settings
-- widget_settings serves as the master on/off switch and basic config
-- vto_settings can have additional VTO-specific configuration
