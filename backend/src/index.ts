import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import aiRoutes from './routes/ai.routes';
import documentRoutes from './routes/document.routes';
import teamRoutes from './routes/team.routes';
import storeRoutes from './routes/store.routes';
import brandRoutes from './routes/brand.routes';
import widgetRoutes from './routes/widget.routes';
import onboardingRoutes from './routes/onboarding.routes';
import otpRoutes from './routes/otp.routes';
import shopifyRoutes from './routes/shopify.routes';
import widgetController from './controllers/widget.controller';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers

// CORS configuration - allow widget endpoints from any origin
app.use(cors({
  origin: (origin, callback) => {
    // Widget API endpoints should accept requests from any origin (public API)
    const isWidgetEndpoint = origin && origin.includes('/api/widget');

    // Allow requests from:
    // 1. Frontend URL
    // 2. No origin (e.g., mobile apps, Postman)
    // 3. File protocol (for local testing)
    if (!origin ||
        origin === (process.env.FRONTEND_URL || 'http://localhost:5173') ||
        origin.startsWith('file://')) {
      callback(null, true);
    } else {
      // For widget endpoints, allow all origins
      callback(null, true);
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev')); // Logging

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Widget script serving route (public, must be before API routes)
app.get('/widget/:storeId.js', widgetController.serveWidgetScript.bind(widgetController));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/stores', storeRoutes);

// Brand Console Routes (for store owners)
app.use('/api/brand', brandRoutes);

// Widget Public API Routes (for embedded widget)
app.use('/api/widget', widgetRoutes);

// Onboarding Routes (public + admin)
app.use('/api/onboarding', onboardingRoutes);

// OTP Routes (public)
app.use('/api/otp', otpRoutes);

// Shopify Integration Routes
app.use('/api/shopify', shopifyRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

export default app;
