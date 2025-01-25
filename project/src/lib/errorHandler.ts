import { PostgrestError } from '@supabase/supabase-js';

export type ErrorType = 'network' | 'database' | 'validation' | 'auth' | 'unknown';

export interface AppError {
  type: ErrorType;
  message: string;
  details?: string;
  resolution?: string;
  retryable: boolean;
}

export function parseError(error: unknown): AppError {
  if (error instanceof Error) {
    if ('code' in error && typeof error.code === 'string') {
      // Handle Supabase errors
      const pgError = error as PostgrestError;
      switch (pgError.code) {
        case '23505':
          return {
            type: 'database',
            message: 'This item already exists.',
            details: 'A unique constraint was violated.',
            resolution: 'Please use a different name or identifier.',
            retryable: false
          };
        case '23503':
          return {
            type: 'database',
            message: 'Referenced item not found.',
            details: 'The item you\'re trying to reference doesn\'t exist.',
            resolution: 'Please ensure all referenced items exist before proceeding.',
            retryable: false
          };
        default:
          return {
            type: 'database',
            message: 'Database operation failed.',
            details: pgError.message,
            resolution: 'Please try again later or contact support if the issue persists.',
            retryable: true
          };
      }
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        type: 'network',
        message: 'Network connection failed.',
        details: 'Unable to reach the server.',
        resolution: 'Please check your internet connection and try again.',
        retryable: true
      };
    }
  }

  return {
    type: 'unknown',
    message: 'An unexpected error occurred.',
    details: error instanceof Error ? error.message : String(error),
    resolution: 'Please try again or contact support if the issue persists.',
    retryable: true
  };
}