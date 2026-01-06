#!/bin/bash

# Run migration on Render backend
echo "🔍 Checking migration status..."
curl -s https://flash-ai-backend-rld7.onrender.com/api/migrate/status

echo ""
echo ""
echo "🚀 Running migration..."
curl -X POST https://flash-ai-backend-rld7.onrender.com/api/migrate/run-discounts-migration \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: FlashAI-2026-Secure-Migration-Key"

echo ""
echo ""
echo "✅ Verifying migration completed..."
curl -s https://flash-ai-backend-rld7.onrender.com/api/migrate/status

echo ""
echo ""
echo "🎉 Migration complete! Test the bot at: https://zorohshop.shop"
