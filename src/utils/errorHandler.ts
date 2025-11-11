/**
 * Centralized Error Handling
 * Provides consistent error handling across the application
 */

import { toast } from 'sonner';

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Handle errors and show appropriate notifications
 */
export function handleError(error: unknown, context?: string): void {
  // ✅ SECURITY: Only log in development to avoid exposing sensitive info
  if (import.meta.env.DEV) {
    console.error(`[${context || 'Error'}]`, error);
  }

  let errorMessage = 'An unexpected error occurred';

  if (error instanceof AppError) {
    errorMessage = error.message;
  } else if (error instanceof Error) {
    // ✅ SECURITY: Sanitize error messages to prevent info disclosure
    // Only show user-friendly messages, not internal error details
    if (error.message.includes('JWT') || error.message.includes('auth')) {
      errorMessage = 'Authentication error. Please login again.';
    } else if (error.message.includes('not found') || error.message.includes('404')) {
      errorMessage = 'Resource not found';
    } else if (error.message.includes('permission') || error.message.includes('denied')) {
      errorMessage = 'Access denied';
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      errorMessage = 'Network error. Please check your connection.';
    } else {
      // Generic message for unknown errors to avoid info disclosure
      errorMessage = 'An error occurred. Please try again.';
    }
  } else if (typeof error === 'string') {
    errorMessage = error;
  }

  toast.error(errorMessage);
}

/**
 * Handle async operations with automatic error handling
 */
export async function handleAsync<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    handleError(error, context);
    return null;
  }
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, context);
      throw error;
    }
  }) as T;
}
