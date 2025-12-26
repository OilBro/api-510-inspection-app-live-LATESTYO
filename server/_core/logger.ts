/**
 * Centralized logging utility
 * 
 * Provides environment-aware logging:
 * - Development: Full console output
 * - Production: Minimal output
 */

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
  },

  /**
   * Error logging - always logged
   */
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
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
