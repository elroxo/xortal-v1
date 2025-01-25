const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 10000; // 10 seconds

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_RETRY_COUNT;
  const initialDelay = options.initialDelay ?? DEFAULT_RETRY_DELAY;
  const maxDelay = options.maxDelay ?? MAX_RETRY_DELAY;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        throw lastError;
      }

      // Exponential backoff with jitter
      const jitter = Math.random() * 200;
      await new Promise(resolve => 
        setTimeout(resolve, Math.min(delay + jitter, maxDelay))
      );
      delay *= 2;
    }
  }

  throw lastError!;
}