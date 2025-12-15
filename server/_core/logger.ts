/**
 * Centralized logging utility
 * 
 * Provides environment-aware logging:
 * - Development: Full console output
 * - Production: Minimal output, errors sent to Sentry
 */

import * as Sentry from '@sentry/node';

const isDev = process.env.NODE_ENV !== 'production';

interface LogContext {
  [key: string]: any;
}

export const logger = {
  /**
   * Debug logging - only in development
   */
  debug: (message: string, context?: LogContext) => {
    if (isDev) {
      console.log(`[DEBUG] ${message}`, context || '');
    }
  },

  /**
   * Info logging - always logged
   */
  info: (message: string, context?: LogContext) => {
    console.log(`[INFO] ${message}`, context || '');
  },

  /**
   * Warning logging - always logged
   */
  warn: (message: string, context?: LogContext) => {
    console.warn(`[WARN] ${message}`, context || '');
    if (!isDev) {
      Sentry.captureMessage(message, {
        level: 'warning',
        extra: context,
      });
    }
  },

  /**
   * Error logging - always logged, sent to Sentry in production
   */
  error: (message: string, error?: Error | any, context?: LogContext) => {
    console.error(`[ERROR] ${message}`, error || '', context || '');
    if (!isDev) {
      if (error instanceof Error) {
        Sentry.captureException(error, {
          extra: { message, ...context },
        });
      } else {
        Sentry.captureMessage(message, {
          level: 'error',
          extra: { error, ...context },
        });
      }
    }
  },

  /**
   * Table A specific debug logging
   */
  tableA: (message: string, data?: any) => {
    if (isDev) {
      console.log(`[TABLE A] ${message}`, data || '');
    }
  },

  /**
   * PDF import specific logging
   */
  pdfImport: (message: string, data?: any) => {
    if (isDev) {
      console.log(`[PDF Import] ${message}`, data || '');
    }
  },

  /**
   * Calculation specific logging
   */
  calc: (message: string, data?: any) => {
    if (isDev) {
      console.log(`[Calc] ${message}`, data || '');
    }
  },
};

export default logger;
