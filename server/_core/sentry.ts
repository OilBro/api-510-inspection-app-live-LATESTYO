import * as Sentry from '@sentry/node';

/**
 * Initialize Sentry for backend error tracking
 * 
 * To enable Sentry:
 * 1. Create a project at https://sentry.io
 * 2. Get your DSN from Project Settings > Client Keys (DSN)
 * 3. Set SENTRY_DSN environment variable
 */
export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    console.warn('[Sentry] DSN not configured. Set SENTRY_DSN to enable error tracking.');
    return;
  }

  Sentry.init({
    dsn,
    
    // Performance Monitoring
    tracesSampleRate: 1.0,
    
    // Environment
    environment: process.env.NODE_ENV || 'development',
    
    // Before send hook - filter sensitive data
    beforeSend(event, hint) {
      // Remove sensitive data
      if (event.request) {
        // Remove authorization headers
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
      }
      
      return event;
    },
  });
  
  console.log('[Sentry] Backend initialized successfully');
}

/**
 * Capture an exception manually
 */
export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture a message manually
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; email?: string; username?: string } | null) {
  Sentry.setUser(user);
}

// Note: Sentry v10+ uses setupExpressErrorHandler instead of Handlers
// See: https://docs.sentry.io/platforms/javascript/guides/express/
