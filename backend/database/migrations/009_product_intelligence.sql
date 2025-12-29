-- Phase 2: Product Intelligence Enhancement Migration
-- Adds comprehensive metadata for AI-powered product intelligence

-- Add enhanced product metadata columns to extracted_products
ALTER TABLE extracted_products
ADD COLUMN IF NOT EXISTS ingredients TEXT[], -- Array of ingredient names
ADD COLUMN IF NOT EXISTS key_benefits TEXT[], -- Array of key benefits
ADD COLUMN IF NOT EXISTS skin_types TEXT[], -- Array: 'oily', 'dry', 'combination', 'sensitive', 'normal', 'mature'
ADD COLUMN IF NOT EXISTS concerns TEXT[], -- Array: 'acne', 'dark_spots', 'aging', 'hydration', 'brightening', 'oil_control', etc
ADD COLUMN IF NOT EXISTS usage_instructions TEXT, -- How to use the product
ADD COLUMN IF NOT EXISTS usage_frequency TEXT, -- 'daily', 'twice_daily', 'weekly', 'as_needed'
ADD COLUMN IF NOT EXISTS usage_time TEXT[], -- Array: 'am', 'pm', 'both'
ADD COLUMN IF NOT EXISTS application_order INTEGER, -- Layering order (1=first, 10=last)
ADD COLUMN IF NOT EXISTS results_timeline TEXT, -- Expected results timeline
ADD COLUMN IF NOT EXISTS texture TEXT, -- 'gel', 'cream', 'serum', 'oil', 'lotion', 'foam'
ADD COLUMN IF NOT EXISTS size_ml NUMERIC, -- Product size in ml
ADD COLUMN IF NOT EXISTS duration_days INTEGER, -- How many days product lasts
ADD COLUMN IF NOT EXISTS product_category TEXT, -- 'cleanser', 'moisturizer', 'serum', 'treatment', 'sunscreen', 'mask'
ADD COLUMN IF NOT EXISTS product_subcategory TEXT, -- More specific category
ADD COLUMN IF NOT EXISTS is_vegan BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_cruelty_free BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_pregnancy_safe BOOLEAN DEFAULT null, -- null = unknown, false = unsafe, true = safe
ADD COLUMN IF NOT EXISTS is_fragrance_free BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_natural BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_organic BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS contains_spf BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS spf_value INTEGER, -- SPF level if sunscreen
ADD COLUMN IF NOT EXISTS allergens TEXT[], -- Array of potential allergens
ADD COLUMN IF NOT EXISTS avoid_with TEXT[], -- Array of product IDs or ingredients to avoid mixing with
ADD COLUMN IF NOT EXISTS pair_with TEXT[], -- Array of recommended product IDs to use with
ADD COLUMN IF NOT EXISTS short_description TEXT, -- Brief 1-2 sentence description (AI-friendly)
ADD COLUMN IF NOT EXISTS ai_metadata JSONB; -- Additional AI-extracted metadata

-- Create index on commonly queried columns for performance
CREATE INDEX IF NOT EXISTS idx_products_skin_types ON extracted_products USING GIN (skin_types);
CREATE INDEX IF NOT EXISTS idx_products_concerns ON extracted_products USING GIN (concerns);
CREATE INDEX IF NOT EXISTS idx_products_ingredients ON extracted_products USING GIN (ingredients);
CREATE INDEX IF NOT EXISTS idx_products_category ON extracted_products (product_category);
CREATE INDEX IF NOT EXISTS idx_products_price ON extracted_products (price);
CREATE INDEX IF NOT EXISTS idx_products_vegan ON extracted_products (is_vegan) WHERE is_vegan = true;
CREATE INDEX IF NOT EXISTS idx_products_pregnancy_safe ON extracted_products (is_pregnancy_safe) WHERE is_pregnancy_safe = true;

-- Create a new table for ingredient details (for future expansion)
CREATE TABLE IF NOT EXISTS ingredient_database (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_name TEXT UNIQUE NOT NULL,
  common_names TEXT[], -- Alternative names
  inci_name TEXT, -- International Nomenclature of Cosmetic Ingredients name
  description TEXT,
  benefits TEXT[],
  concerns TEXT[], -- What skin concerns it addresses
  skin_types TEXT[], -- Compatible skin types
  is_pregnancy_safe BOOLEAN DEFAULT null,
  is_allergen BOOLEAN DEFAULT false,
  typical_concentration_min NUMERIC, -- Typical % range
  typical_concentration_max NUMERIC,
  ph_range_min NUMERIC,
  ph_range_max NUMERIC,
  conflicts_with TEXT[], -- Array of ingredient names that conflict
  synergizes_with TEXT[], -- Array of ingredient names that work well together
  usage_time TEXT[], -- 'am', 'pm', 'both'
  category TEXT, -- 'active', 'humectant', 'emollient', 'preservative', etc
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for ingredient database
CREATE INDEX IF NOT EXISTS idx_ingredient_name ON ingredient_database (ingredient_name);
CREATE INDEX IF NOT EXISTS idx_ingredient_category ON ingredient_database (category);

-- Create a junction table for product-ingredient relationships with concentrations
CREATE TABLE IF NOT EXISTS product_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES extracted_products(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredient_database(id) ON DELETE CASCADE,
  concentration NUMERIC, -- If known
  position INTEGER, -- Position in ingredient list (1=first)
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_product_ingredients_product ON product_ingredients (product_id);
CREATE INDEX IF NOT EXISTS idx_product_ingredients_ingredient ON product_ingredients (ingredient_id);

-- Add a table for tracking AI analysis of products
CREATE TABLE IF NOT EXISTS product_ai_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES extracted_products(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL, -- 'ingredient_extraction', 'benefit_analysis', 'safety_check'
  model_used TEXT, -- AI model version used
  input_data JSONB, -- What was analyzed
  output_data JSONB, -- Analysis results
  confidence_score NUMERIC, -- 0-1 confidence
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_product ON product_ai_analysis (product_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_type ON product_ai_analysis (analysis_type);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_status ON product_ai_analysis (status);

-- Add a function to calculate product compatibility score
CREATE OR REPLACE FUNCTION calculate_product_match_score(
  p_skin_type TEXT,
  p_concerns TEXT[],
  p_preferences JSONB,
  product_id UUID
) RETURNS NUMERIC AS $$
DECLARE
  score NUMERIC := 0;
  product RECORD;
BEGIN
  SELECT * INTO product FROM extracted_products WHERE id = product_id;

  -- Skin type match (30 points)
  IF p_skin_type = ANY(product.skin_types) THEN
    score := score + 30;
  END IF;

  -- Concern match (40 points max - 10 per matching concern)
  score := score + (10 * (
    SELECT COUNT(*)
    FROM unnest(p_concerns) AS concern
    WHERE concern = ANY(product.concerns)
    LIMIT 4
  ));

  -- Preference match (30 points)
  IF (p_preferences->>'vegan')::BOOLEAN = true AND product.is_vegan THEN
    score := score + 10;
  END IF;

  IF (p_preferences->>'cruelty_free')::BOOLEAN = true AND product.is_cruelty_free THEN
    score := score + 10;
  END IF;

  IF (p_preferences->>'fragrance_free')::BOOLEAN = true AND product.is_fragrance_free THEN
    score := score + 10;
  END IF;

  RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON COLUMN extracted_products.ingredients IS 'Array of ingredient names extracted from product description';
COMMENT ON COLUMN extracted_products.skin_types IS 'Array of compatible skin types: oily, dry, combination, sensitive, normal, mature';
COMMENT ON COLUMN extracted_products.concerns IS 'Array of skin concerns addressed: acne, dark_spots, aging, hydration, brightening, oil_control, redness, pores, texture, dullness';
COMMENT ON COLUMN extracted_products.product_category IS 'Primary category: cleanser, toner, serum, moisturizer, treatment, sunscreen, mask, exfoliant, eye_cream, lip_care';
COMMENT ON COLUMN extracted_products.ai_metadata IS 'Additional metadata extracted by AI: ingredient analysis, benefits, recommendations, etc';
