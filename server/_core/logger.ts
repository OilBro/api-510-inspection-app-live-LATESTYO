/**
 * Centralized logging utility
 * 
 * Provides environment-aware logging:
 * - Development: Full console output
 * - Production: Minimal output, errors sent to Sentry
 */

import * as Sentry from '@sentry/node';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  /**
   * Debug logging - only in development
   */
  debug: (...args: any[]) => {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  },

  /**
   * Info logging - always logged
   */
  info: (...args: any[]) => {
    console.log('[INFO]', ...args);
  },

  /**
   * Warning logging - always logged
   */
  warn: (...args: any[]) => {
    console.warn('[WARN]', ...args);
    if (!isDev && args.length > 0) {
      const message = typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0]);
      Sentry.captureMessage(message, {
        level: 'warning',
        extra: { args: args.slice(1) },
      });
    }
  },

  /**
   * Error logging - always logged, sent to Sentry in production
   */
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
    if (!isDev && args.length > 0) {
      const firstArg = args[0];
      if (firstArg instanceof Error) {
        Sentry.captureException(firstArg, {
          extra: { additionalArgs: args.slice(1) },
        });
      } else {
        const message = typeof firstArg === 'string' ? firstArg : JSON.stringify(firstArg);
        Sentry.captureMessage(message, {
          level: 'error',
          extra: { args: args.slice(1) },
        });
      }
    }
  },

  /**
   * Table A specific debug logging
   */
  tableA: (...args: any[]) => {
    if (isDev) {
      console.log('[TABLE A]', ...args);
    }
  },

  /**
   * PDF import specific logging
   */
  pdfImport: (...args: any[]) => {
    if (isDev) {
      console.log('[PDF Import]', ...args);
    }
  },

  /**
   * Calculation specific logging
   */
  calc: (...args: any[]) => {
    if (isDev) {
      console.log('[Calc]', ...args);
    }
  },
};

export default logger;
