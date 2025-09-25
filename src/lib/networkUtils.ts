/**
 * Network utilities with retry mechanisms and error recovery
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryCondition?: (error: any) => boolean;
}

export interface FetchOptions extends RequestInit {
  timeout?: number;
  retry?: RetryOptions;
}

/**
 * Enhanced fetch with timeout, retry, and error handling
 */
export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeout = 10000,
    retry = {},
    ...fetchOptions
  } = options;

  const retryOptions: Required<RetryOptions> = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    retryCondition: (error) => {
      // Retry on network errors, timeouts, and 5xx status codes
      return (
        error.name === 'TypeError' || // Network error
        error.name === 'AbortError' || // Timeout
        (error.status >= 500 && error.status < 600) // Server errors
      );
    },
    ...retry
  };

  let lastError: any;

  for (let attempt = 0; attempt <= retryOptions.maxRetries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // If response is not ok and we should retry, throw an error
      if (!response.ok && retryOptions.retryCondition({ status: response.status })) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;

    } catch (error: any) {
      lastError = error;

      // Don't retry if this is the last attempt or if retry condition is not met
      if (attempt === retryOptions.maxRetries || !retryOptions.retryCondition(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        retryOptions.baseDelay * Math.pow(retryOptions.backoffFactor, attempt),
        retryOptions.maxDelay
      );

      console.warn(`Request failed (attempt ${attempt + 1}/${retryOptions.maxRetries + 1}), retrying in ${delay}ms:`, error.message);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * API client with standardized error handling and retry logic
 */
export class APIClient {
  private baseURL: string;
  private defaultOptions: FetchOptions;

  constructor(baseURL: string = '', defaultOptions: FetchOptions = {}) {
    this.baseURL = baseURL;
    this.defaultOptions = {
      timeout: 10000,
      retry: {
        maxRetries: 3,
        baseDelay: 1000
      },
      headers: {
        'Content-Type': 'application/json',
        ...defaultOptions.headers
      },
      ...defaultOptions
    };
  }

  private async request<T>(
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const mergedOptions = {
      ...this.defaultOptions,
      ...options,
      headers: {
        ...this.defaultOptions.headers,
        ...options.headers
      }
    };

    try {
      const response = await fetchWithRetry(url, mergedOptions);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new APIError(
          response.status,
          errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`,
          errorData.error?.code || 'HTTP_ERROR',
          errorData.error?.details
        );
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new APIError(
          response.status,
          data.error?.message || 'API request failed',
          data.error?.code || 'API_ERROR',
          data.error?.details
        );
      }

      return data.data;

    } catch (error: any) {
      if (error instanceof APIError) {
        throw error;
      }

      // Handle network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new APIError(0, 'Network connection failed', 'NETWORK_ERROR');
      }

      // Handle timeout errors
      if (error.name === 'AbortError') {
        throw new APIError(0, 'Request timed out', 'TIMEOUT_ERROR');
      }

      // Handle other errors
      throw new APIError(0, error.message || 'Unknown error occurred', 'UNKNOWN_ERROR');
    }
  }

  async get<T>(endpoint: string, options?: FetchOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, options?: FetchOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async put<T>(endpoint: string, data?: any, options?: FetchOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  async delete<T>(endpoint: string, options?: FetchOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Set authentication token for all requests
   */
  setAuthToken(token: string) {
    this.defaultOptions.headers = {
      ...this.defaultOptions.headers,
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Clear authentication token
   */
  clearAuthToken() {
    const { Authorization, ...headers } = this.defaultOptions.headers as any;
    this.defaultOptions.headers = headers;
  }
}

/**
 * Custom API Error class
 */
export class APIError extends Error {
  public status: number;
  public code: string;
  public details?: any;

  constructor(status: number, message: string, code: string = 'API_ERROR', details?: any) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(): boolean {
    return (
      this.status === 0 || // Network errors
      this.status === 408 || // Request timeout
      this.status === 429 || // Too many requests
      (this.status >= 500 && this.status < 600) // Server errors
    );
  }

  /**
   * Check if error is a client error (4xx)
   */
  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError(): boolean {
    return this.status >= 500 && this.status < 600;
  }

  /**
   * Check if error is a network error
   */
  isNetworkError(): boolean {
    return this.status === 0 || this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT_ERROR';
  }
}

/**
 * Default API client instance
 */
export const apiClient = new APIClient('/api');

/**
 * Utility function to handle API errors in components
 */
export function handleAPIError(error: any): string {
  if (error instanceof APIError) {
    return error.message;
  }

  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return 'Network connection failed. Please check your internet connection and try again.';
  }

  if (error.name === 'AbortError') {
    return 'Request timed out. Please try again.';
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Connection status monitoring
 */
export class ConnectionMonitor {
  private listeners: Set<(online: boolean) => void> = new Set();
  private _isOnline: boolean = navigator.onLine;

  constructor() {
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  private handleOnline() {
    this._isOnline = true;
    this.notifyListeners(true);
  }

  private handleOffline() {
    this._isOnline = false;
    this.notifyListeners(false);
  }

  private notifyListeners(online: boolean) {
    this.listeners.forEach(listener => listener(online));
  }

  get isOnline(): boolean {
    return this._isOnline;
  }

  onStatusChange(callback: (online: boolean) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const connectionMonitor = new ConnectionMonitor();