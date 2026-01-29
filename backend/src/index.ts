// Startup diagnostic - MUST be first
console.log('='.repeat(60));
console.log('🚀 FLASH AI BACKEND v3.0.0 STARTING');
console.log('='.repeat(60));
console.log('🔧 Backend starting... Node:', process.version, 'PID:', process.pid);
console.log('🔧 Working directory:', process.cwd());
console.log('🔧 __dirname:', __dirname);

// Catch any unhandled errors during startup
process.on('uncaughtException', (err) => {
  console.error('💀 UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💀 UNHANDLED REJECTION:', reason);
});

// Core imports that should never fail
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables EARLY
dotenv.config();

console.log('✅ Core modules loaded');
console.log('🔧 NODE_ENV:', process.env.NODE_ENV);
console.log('🔧 DATABASE_URL exists:', !!process.env.DATABASE_URL);

const app: Application = express();
const PORT = process.env.PORT || 3000;

// CRITICAL: Register basic endpoints BEFORE any other imports
// These will work even if route imports fail
app.get('/ping', (req: Request, res: Response) => {
  res.send('pong-v3.0.0-' + Date.now());
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    node: process.version,
    env: process.env.NODE_ENV || 'development',
    dbConfigured: !!process.env.DATABASE_URL,
    hasStaticFiles: true,
  });
});

app.get('/debug', (req: Request, res: Response) => {
  res.json({
    cwd: process.cwd(),
    dirname: __dirname,
    nodeVersion: process.version,
    platform: process.platform,
    env: process.env.NODE_ENV,
    port: PORT,
    memoryUsage: process.memoryUsage(),
  });
});

// Root redirect for skinchecker.in domain
app.get('/', (req: Request, res: Response) => {
  res.redirect('/skinchecker.html');
});

console.log('✅ Basic endpoints registered (/ping, /health, /debug, /)');

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: true, // Allow all origins for now
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));
console.log('✅ Static files served from:', path.join(__dirname, 'public'));

console.log('✅ Middleware configured');

// Track which routes loaded successfully
const loadedRoutes: string[] = [];
const failedRoutes: string[] = [];

// Helper to safely load a route
function safeLoadRoute(routePath: string, mountPath: string) {
  try {
    const route = require(routePath).default;
    app.use(mountPath, route);
    loadedRoutes.push(mountPath);
    console.log(`✅ Route loaded: ${mountPath}`);
  } catch (error: any) {
    failedRoutes.push(`${mountPath}: ${error.message}`);
    console.error(`❌ Failed to load route ${mountPath}:`, error.message);
  }
}

// Helper to safely load a controller
function safeLoadController(controllerPath: string): any {
  try {
    const controller = require(controllerPath).default;
    console.log(`✅ Controller loaded: ${controllerPath}`);
    return controller;
  } catch (error: any) {
    console.error(`❌ Failed to load controller ${controllerPath}:`, error.message);
    return null;
  }
}

// Load middleware
let errorHandler: any, notFoundHandler: any;
try {
  errorHandler = require('./middleware/errorHandler').errorHandler;
  notFoundHandler = require('./middleware/notFoundHandler').notFoundHandler;
  console.log('✅ Error handlers loaded');
} catch (error: any) {
  console.error('❌ Failed to load error handlers:', error.message);
}

// Load controllers
const widgetController = safeLoadController('./controllers/widget.controller');
const brandController = safeLoadController('./controllers/brand.controller');

// Widget script routes (if controller loaded)
if (widgetController) {
  app.options('/widget/:storeId.js', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(200);
  });
  app.get('/widget/:storeId.js', widgetController.serveWidgetScript.bind(widgetController));

  app.options('/vto/:storeId.js', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(200);
  });
  app.get('/vto/:storeId.js', widgetController.serveVTOWidgetScript.bind(widgetController));
  console.log('✅ Widget script routes registered');
}

// VTO styles route - NO CACHE to ensure latest version
app.get('/widget/vto-styles.css', (req, res) => {
  try {
    const cssPath = path.join(__dirname, './widget/vto-styles.css');
    res.setHeader('Content-Type', 'text/css');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(cssPath);
  } catch (error) {
    console.error('Error serving VTO styles:', error);
    res.status(404).send('/* VTO styles not found */');
  }
});

// Load API routes dynamically
console.log('📡 Loading API routes...');
safeLoadRoute('./routes/auth.routes', '/api/auth');
safeLoadRoute('./routes/user.routes', '/api/users');
safeLoadRoute('./routes/ai.routes', '/api/ai');
safeLoadRoute('./routes/document.routes', '/api/documents');
safeLoadRoute('./routes/team.routes', '/api/teams');
safeLoadRoute('./routes/store.routes', '/api/stores');
safeLoadRoute('./routes/brand.routes', '/api/brand');
safeLoadRoute('./routes/widget.routes', '/api/widget');
safeLoadRoute('./routes/vto.routes', '/api/vto');
safeLoadRoute('./routes/face-scan.routes', '/api/face-scan');
safeLoadRoute('./routes/onboarding.routes', '/api/onboarding');
safeLoadRoute('./routes/otp.routes', '/api/otp');
safeLoadRoute('./routes/shopify.routes', '/api/shopify');
safeLoadRoute('./routes/admin.routes', '/api/admin');
safeLoadRoute('./routes/maintenance.routes', '/api/maintenance');

// Widget user auth and progress routes (Phase 1 - Skincare Platform)
safeLoadRoute('./routes/widget-auth.routes', '/api/widget/auth');
safeLoadRoute('./routes/progress.routes', '/api/widget/progress');

// Goals and routines routes (Phase 2 - Skincare Platform)
safeLoadRoute('./routes/goals.routes', '/api/widget/goals');
safeLoadRoute('./routes/routines.routes', '/api/widget/routines');

// Feedback and learning routes (Phase 3 - Skincare Platform)
safeLoadRoute('./routes/feedback.routes', '/api/widget/feedback');

// Safety checker routes (Phase 4 - Skincare Platform)
safeLoadRoute('./routes/safety.routes', '/api/widget/safety');

// Knowledge base routes (Phase 5 - Skincare Platform)
safeLoadRoute('./routes/knowledge.routes', '/api/widget/knowledge');

// Prediction and visualization routes (Phase 6 - Skincare Platform)
safeLoadRoute('./routes/prediction.routes', '/api/widget/predictions');

// ML Training and Feedback routes (Continuous Learning System)
safeLoadRoute('./routes/ml-training.routes', '/api/ml');

// Route status endpoint
app.get('/routes-status', (req: Request, res: Response) => {
  res.json({
    loaded: loadedRoutes,
    failed: failedRoutes,
    total: loadedRoutes.length + failedRoutes.length,
    success: loadedRoutes.length,
  });
});

// 404 handler
if (notFoundHandler) {
  app.use(notFoundHandler);
} else {
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found', path: req.path });
  });
}

// Error handler
if (errorHandler) {
  app.use(errorHandler);
} else {
  app.use((err: any, req: Request, res: Response, next: any) => {
    console.error('Error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });
}

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Routes status: ${loadedRoutes.length} loaded, ${failedRoutes.length} failed`);

  if (failedRoutes.length > 0) {
    console.log('⚠️  Failed routes:', failedRoutes);
  }
});

// Handle server errors
server.on('error', (err: any) => {
  console.error('💀 Server error:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
});

export default app;
// Deploy trigger: Wed Jan 28 23:09:15 IST 2026
// Trigger deploy Wed Jan 28 23:49:27 IST 2026
// Deploy trigger Thu Jan 29 02:37:52 IST 2026
