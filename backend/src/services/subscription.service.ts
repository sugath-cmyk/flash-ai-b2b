import { pool } from '../config/database';
import { createError } from '../middleware/errorHandler';

interface SubscriptionPlan {
  name: string;
  interval: 'monthly' | 'annual';
  amount: number;
  messageLimit: number;
}

const PLANS: Record<string, SubscriptionPlan> = {
  starter: {
    name: 'starter',
    interval: 'monthly',
    amount: 29.00,
    messageLimit: 1000,
  },
  professional: {
    name: 'professional',
    interval: 'monthly',
    amount: 99.00,
    messageLimit: 5000,
  },
  enterprise: {
    name: 'enterprise',
    interval: 'monthly',
    amount: 299.00,
    messageLimit: 20000,
  },
};

export class SubscriptionService {
  // Get subscription for a store
  async getSubscription(storeId: string, userId: string): Promise<any> {
    // Verify store ownership
    const storeCheck = await pool.query(
      'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
      [storeId, userId]
    );

    if (storeCheck.rows.length === 0) {
      throw createError('Store not found', 404);
    }

    const result = await pool.query(
      'SELECT * FROM subscriptions WHERE store_id = $1',
      [storeId]
    );

    if (result.rows.length === 0) {
      // Create default starter subscription
      return await this.createSubscription(storeId, 'starter', 'monthly');
    }

    return result.rows[0];
  }

  // Create subscription
  async createSubscription(storeId: string, planName: string, interval: string = 'monthly'): Promise<any> {
    const plan = PLANS[planName];
    if (!plan) {
      throw createError('Invalid plan name', 400);
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + (interval === 'annual' ? 12 : 1));

    // Set trial period (14 days)
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 14);

    const result = await pool.query(
      `INSERT INTO subscriptions (
        store_id, plan_name, plan_interval, amount, currency, status,
        trial_ends_at, current_period_start, current_period_end,
        message_limit, messages_used
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (store_id)
      DO UPDATE SET
        plan_name = EXCLUDED.plan_name,
        plan_interval = EXCLUDED.plan_interval,
        amount = EXCLUDED.amount,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        message_limit = EXCLUDED.message_limit,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        storeId,
        planName,
        interval,
        plan.amount,
        'USD',
        'active',
        trialEnd,
        now,
        periodEnd,
        plan.messageLimit,
        0,
      ]
    );

    return result.rows[0];
  }

  // Update subscription plan
  async updateSubscription(storeId: string, userId: string, planName: string, interval: string = 'monthly'): Promise<any> {
    // Verify store ownership
    const storeCheck = await pool.query(
      'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
      [storeId, userId]
    );

    if (storeCheck.rows.length === 0) {
      throw createError('Store not found', 404);
    }

    const plan = PLANS[planName];
    if (!plan) {
      throw createError('Invalid plan name', 400);
    }

    const result = await pool.query(
      `UPDATE subscriptions
       SET plan_name = $1, plan_interval = $2, amount = $3, message_limit = $4, updated_at = CURRENT_TIMESTAMP
       WHERE store_id = $5
       RETURNING *`,
      [planName, interval, plan.amount, plan.messageLimit, storeId]
    );

    if (result.rows.length === 0) {
      // Create if doesn't exist
      return await this.createSubscription(storeId, planName, interval);
    }

    return result.rows[0];
  }

  // Cancel subscription
  async cancelSubscription(storeId: string, userId: string): Promise<any> {
    // Verify store ownership
    const storeCheck = await pool.query(
      'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
      [storeId, userId]
    );

    if (storeCheck.rows.length === 0) {
      throw createError('Store not found', 404);
    }

    const result = await pool.query(
      `UPDATE subscriptions
       SET status = 'canceled', canceled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE store_id = $1
       RETURNING *`,
      [storeId]
    );

    return result.rows[0];
  }

  // Track message usage
  async trackMessageUsage(storeId: string): Promise<void> {
    await pool.query(
      `UPDATE subscriptions
       SET messages_used = messages_used + 1
       WHERE store_id = $1`,
      [storeId]
    );
  }

  // Check if message limit exceeded
  async checkMessageLimit(storeId: string): Promise<{ allowed: boolean; remaining: number }> {
    const result = await pool.query(
      `SELECT message_limit, messages_used, status, trial_ends_at, current_period_end
       FROM subscriptions
       WHERE store_id = $1`,
      [storeId]
    );

    if (result.rows.length === 0) {
      return { allowed: false, remaining: 0 };
    }

    const sub = result.rows[0];

    // Check if subscription is active or in trial
    const now = new Date();
    const inTrial = sub.trial_ends_at && new Date(sub.trial_ends_at) > now;
    const isActive = sub.status === 'active' || inTrial;

    if (!isActive) {
      return { allowed: false, remaining: 0 };
    }

    const remaining = sub.message_limit - sub.messages_used;
    return {
      allowed: remaining > 0,
      remaining: Math.max(0, remaining),
    };
  }

  // Get available plans
  getAvailablePlans(): any[] {
    return Object.entries(PLANS).map(([key, plan]) => ({
      id: key,
      name: plan.name,
      price: plan.amount,
      interval: plan.interval,
      messageLimit: plan.messageLimit,
      features: this.getPlanFeatures(key),
    }));
  }

  private getPlanFeatures(planName: string): string[] {
    const baseFeatures = [
      'AI-powered chat widget',
      'Product recommendations',
      'Analytics dashboard',
      'Email support',
    ];

    const features: Record<string, string[]> = {
      starter: [
        ...baseFeatures,
        '1,000 messages/month',
        'Basic customization',
        'Standard support',
      ],
      professional: [
        ...baseFeatures,
        '5,000 messages/month',
        'Advanced customization',
        'Priority support',
        'Custom branding',
        'Order tracking integration',
      ],
      enterprise: [
        ...baseFeatures,
        '20,000 messages/month',
        'Full customization',
        'Dedicated support',
        'White-label solution',
        'API access',
        'Custom integrations',
        'SLA guarantee',
      ],
    };

    return features[planName] || baseFeatures;
  }

  // Get invoices for a store
  async getInvoices(storeId: string, userId: string): Promise<any[]> {
    // Verify store ownership
    const storeCheck = await pool.query(
      'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
      [storeId, userId]
    );

    if (storeCheck.rows.length === 0) {
      throw createError('Store not found', 404);
    }

    const result = await pool.query(
      `SELECT * FROM invoices
       WHERE store_id = $1
       ORDER BY invoice_date DESC
       LIMIT 12`,
      [storeId]
    );

    return result.rows;
  }

  // Create invoice
  async createInvoice(storeId: string, subscriptionId: string, amount: number): Promise<any> {
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 7);

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const result = await pool.query(
      `INSERT INTO invoices (
        subscription_id, store_id, invoice_number, amount, currency,
        status, invoice_date, due_date, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        subscriptionId,
        storeId,
        invoiceNumber,
        amount,
        'USD',
        'paid',
        now,
        dueDate,
        'Monthly subscription',
      ]
    );

    return result.rows[0];
  }
}

export default new SubscriptionService();
