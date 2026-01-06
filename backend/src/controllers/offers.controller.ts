import { Request, Response } from 'express';
import { pool } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

/**
 * Offers Controller
 * Manages store offers (both Shopify-extracted and manually created)
 */
export class OffersController {
  /**
   * List all offers for a store (Shopify discounts + manual offers)
   */
  async getStoreOffers(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;

      // Verify store ownership
      const storeResult = await pool.query(
        'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
        [storeId, userId]
      );

      if (storeResult.rows.length === 0) {
        throw createError('Store not found or access denied', 404);
      }

      // Get Shopify discounts
      const discounts = await pool.query(
        `SELECT id, code, title, description, value_type, value,
                starts_at, ends_at, is_active, usage_count, usage_limit,
                minimum_requirements, entitled_product_ids, entitled_collection_ids
         FROM extracted_discounts
         WHERE store_id = $1
         ORDER BY starts_at DESC`,
        [storeId]
      );

      // Get manual offers
      const offers = await pool.query(
        `SELECT id, title, description, offer_type, code, discount_type, discount_value,
                start_date, end_date, is_active, source, minimum_purchase,
                terms_and_conditions, created_at
         FROM store_offers
         WHERE store_id = $1
         ORDER BY created_at DESC`,
        [storeId]
      );

      res.json({
        success: true,
        data: {
          shopifyDiscounts: discounts.rows,
          manualOffers: offers.rows,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create manual offer
   */
  async createManualOffer(req: AuthRequest, res: Response) {
    try {
      const { storeId } = req.params;
      const userId = req.user!.id;
      const offerData = req.body;

      // Verify store ownership
      const storeResult = await pool.query(
        'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
        [storeId, userId]
      );

      if (storeResult.rows.length === 0) {
        throw createError('Store not found or access denied', 404);
      }

      // Validate required fields
      if (!offerData.title || !offerData.offer_type) {
        throw createError('Title and offer_type are required', 400);
      }

      // Create offer
      const result = await pool.query(
        `INSERT INTO store_offers
         (store_id, title, description, offer_type, code, discount_type, discount_value,
          minimum_purchase, start_date, end_date, is_active, source, terms_and_conditions)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'manual_entry', $12)
         RETURNING *`,
        [
          storeId,
          offerData.title,
          offerData.description || null,
          offerData.offer_type,
          offerData.code || null,
          offerData.discount_type || null,
          offerData.discount_value || null,
          offerData.minimum_purchase || null,
          offerData.start_date || null,
          offerData.end_date || null,
          offerData.is_active !== false,
          offerData.terms_and_conditions || null,
        ]
      );

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Offer created successfully',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update manual offer
   */
  async updateOffer(req: AuthRequest, res: Response) {
    try {
      const { storeId, offerId } = req.params;
      const userId = req.user!.id;
      const updateData = req.body;

      // Verify store ownership
      const storeResult = await pool.query(
        'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
        [storeId, userId]
      );

      if (storeResult.rows.length === 0) {
        throw createError('Store not found or access denied', 404);
      }

      // Build update query dynamically
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (updateData.title !== undefined) {
        fields.push(`title = $${paramCount++}`);
        values.push(updateData.title);
      }
      if (updateData.description !== undefined) {
        fields.push(`description = $${paramCount++}`);
        values.push(updateData.description);
      }
      if (updateData.offer_type !== undefined) {
        fields.push(`offer_type = $${paramCount++}`);
        values.push(updateData.offer_type);
      }
      if (updateData.code !== undefined) {
        fields.push(`code = $${paramCount++}`);
        values.push(updateData.code);
      }
      if (updateData.discount_type !== undefined) {
        fields.push(`discount_type = $${paramCount++}`);
        values.push(updateData.discount_type);
      }
      if (updateData.discount_value !== undefined) {
        fields.push(`discount_value = $${paramCount++}`);
        values.push(updateData.discount_value);
      }
      if (updateData.minimum_purchase !== undefined) {
        fields.push(`minimum_purchase = $${paramCount++}`);
        values.push(updateData.minimum_purchase);
      }
      if (updateData.start_date !== undefined) {
        fields.push(`start_date = $${paramCount++}`);
        values.push(updateData.start_date);
      }
      if (updateData.end_date !== undefined) {
        fields.push(`end_date = $${paramCount++}`);
        values.push(updateData.end_date);
      }
      if (updateData.is_active !== undefined) {
        fields.push(`is_active = $${paramCount++}`);
        values.push(updateData.is_active);
      }
      if (updateData.terms_and_conditions !== undefined) {
        fields.push(`terms_and_conditions = $${paramCount++}`);
        values.push(updateData.terms_and_conditions);
      }

      if (fields.length === 0) {
        throw createError('No fields to update', 400);
      }

      fields.push(`updated_at = NOW()`);
      values.push(offerId, storeId);

      const result = await pool.query(
        `UPDATE store_offers
         SET ${fields.join(', ')}
         WHERE id = $${paramCount} AND store_id = $${paramCount + 1}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw createError('Offer not found', 404);
      }

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Offer updated successfully',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Toggle offer active status
   */
  async toggleOfferStatus(req: AuthRequest, res: Response) {
    try {
      const { storeId, offerId } = req.params;
      const { is_active } = req.body;
      const userId = req.user!.id;

      // Verify store ownership
      const storeResult = await pool.query(
        'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
        [storeId, userId]
      );

      if (storeResult.rows.length === 0) {
        throw createError('Store not found or access denied', 404);
      }

      await pool.query(
        `UPDATE store_offers
         SET is_active = $1, updated_at = NOW()
         WHERE id = $2 AND store_id = $3`,
        [is_active, offerId, storeId]
      );

      res.json({
        success: true,
        message: `Offer ${is_active ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete manual offer
   */
  async deleteOffer(req: AuthRequest, res: Response) {
    try {
      const { storeId, offerId } = req.params;
      const userId = req.user!.id;

      // Verify store ownership
      const storeResult = await pool.query(
        'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
        [storeId, userId]
      );

      if (storeResult.rows.length === 0) {
        throw createError('Store not found or access denied', 404);
      }

      await pool.query(
        'DELETE FROM store_offers WHERE id = $1 AND store_id = $2',
        [offerId, storeId]
      );

      res.json({
        success: true,
        message: 'Offer deleted successfully',
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get single offer details
   */
  async getOffer(req: AuthRequest, res: Response) {
    try {
      const { storeId, offerId } = req.params;
      const userId = req.user!.id;

      // Verify store ownership
      const storeResult = await pool.query(
        'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
        [storeId, userId]
      );

      if (storeResult.rows.length === 0) {
        throw createError('Store not found or access denied', 404);
      }

      const result = await pool.query(
        'SELECT * FROM store_offers WHERE id = $1 AND store_id = $2',
        [offerId, storeId]
      );

      if (result.rows.length === 0) {
        throw createError('Offer not found', 404);
      }

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      throw error;
    }
  }
}

export default new OffersController();
