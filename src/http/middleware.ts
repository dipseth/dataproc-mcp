/**
 * HTTP Middleware setup for MCP server
 * Configures CORS, rate limiting, security headers, and request handling
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';
import { HttpTransportConfig } from '../transport/http-transport.js';

/**
 * Setup all middleware for the Express app
 */
export function setupMiddleware(app: Express, config: HttpTransportConfig): void {
  logger.debug('Setting up HTTP middleware');

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // CORS configuration
  if (config.enableCors) {
    app.use(cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Allow localhost and development origins
        const allowedOrigins = [
          /^http:\/\/localhost:\d+$/,
          /^http:\/\/127\.0\.0\.1:\d+$/,
          /^http:\/\/0\.0\.0\.0:\d+$/,
        ];
        
        const isAllowed = allowedOrigins.some(pattern => pattern.test(origin));
        callback(null, isAllowed);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
      exposedHeaders: ['X-Total-Count', 'X-Request-ID'],
    }));
  }

  // Rate limiting
  if (config.enableRateLimit) {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes',
      },
      standardHeaders: true,
      legacyHeaders: false,
      // Skip rate limiting for health checks
      skip: (req) => req.path === '/health',
    });
    app.use(limiter);
  }

  // JSON parsing with size limit
  app.use(express.json({ 
    limit: '10mb',
    type: ['application/json', 'text/plain'],
  }));

  // URL-encoded parsing
  app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb',
  }));

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = generateRequestId();
    
    // Add request ID to response headers
    res.setHeader('X-Request-ID', requestId);
    
    // Log request
    logger.debug(`HTTP ${req.method} ${req.path}`, {
      requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentLength: req.get('Content-Length'),
    });

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.debug(`HTTP ${req.method} ${req.path} - ${res.statusCode}`, {
        requestId,
        duration: `${duration}ms`,
        contentLength: res.get('Content-Length'),
      });
    });

    next();
  });

  // Error handling middleware
  app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    const requestId = res.get('X-Request-ID') || 'unknown';
    
    logger.error(`HTTP Error for request ${requestId}:`, {
      error: error.message,
      stack: error.stack,
      method: req.method,
      path: req.path,
      ip: req.ip,
    });

    // Don't expose internal errors in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: isDevelopment ? error.message : 'An unexpected error occurred',
      requestId,
      timestamp: new Date().toISOString(),
    });
  });

  // Note: 404 handler will be added after routes are set up

  logger.debug('HTTP middleware setup completed');
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Middleware to validate JSON content type for POST requests
 */
export function validateJsonContentType(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'POST' && !req.is('application/json')) {
    res.status(400).json({
      error: 'Invalid Content-Type',
      message: 'Content-Type must be application/json for POST requests',
      requestId: res.get('X-Request-ID'),
      timestamp: new Date().toISOString(),
    });
    return;
  }
  next();
}

/**
 * Middleware to validate required parameters
 */
export function validateRequiredParams(requiredParams: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing = requiredParams.filter(param => !(param in req.params));
    
    if (missing.length > 0) {
      res.status(400).json({
        error: 'Missing Required Parameters',
        message: `Missing required parameters: ${missing.join(', ')}`,
        requestId: res.get('X-Request-ID'),
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    next();
  };
}

/**
 * Middleware to handle async route handlers
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}