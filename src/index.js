import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables
dotenv.config();

// Import routes
import chatRoutes from './routes/chat.js';
import adminRoutes from './routes/admin.js';
import healthRoutes from './routes/health.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ===== MIDDLEWARE =====

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ===== ROUTES =====

// Health check endpoint
app.use('/api/health', healthRoutes);

// Chat endpoints
app.use('/api/chat', chatRoutes);

// Admin endpoints
app.use('/api/admin', adminRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Accounting Assistant Bot Backend',
    version: '1.0.0',
    status: 'running',
    environment: NODE_ENV,
  });
});

// ===== ERROR HANDLING =====

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `The endpoint ${req.method} ${req.path} does not exist`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    error: true,
    statusCode,
    message,
    ...(NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ===== START SERVER =====

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║   Accounting Assistant Bot Backend                     ║
║   Environment: ${NODE_ENV.padEnd(43)}║
║   Port: ${PORT.toString().padEnd(49)}║
║   CORS Origin: ${(process.env.CORS_ORIGIN || 'All').padEnd(40)}║
╚════════════════════════════════════════════════════════╝
  `);
});

export default app;
