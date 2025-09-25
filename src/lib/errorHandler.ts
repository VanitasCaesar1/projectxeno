/**
 * Centralized error handling utilities for API routes and client-side operations
 */

export interface APIError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    field?: string;
  };
}

export interface APISuccess<T = any> {
  success: true;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type APIResponse<T = any> = APISuccess<T> | APIError;

// Standard error codes
export const ERROR_CODES = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Database
  DATABASE_ERROR: 'DATABASE_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  
  // External Services
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  
  // Business Logic
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  
  // Generic
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

// Error messages mapping
export const ERROR_MESSAGES = {
  [ERROR_CODES.UNAUTHORIZED]: 'Authentication required',
  [ERROR_CODES.FORBIDDEN]: 'Access denied',
  [ERROR_CODES.TOKEN_EXPIRED]: 'Session expired, please sign in again',
  [ERROR_CODES.VALIDATION_ERROR]: 'Invalid input provided',
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: 'Required field is missing',
  [ERROR_CODES.INVALID_FORMAT]: 'Invalid format provided',
  [ERROR_CODES.DATABASE_ERROR]: 'Database operation failed',
  [ERROR_CODES.NOT_FOUND]: 'Resource not found',
  [ERROR_CODES.DUPLICATE_ENTRY]: 'Resource already exists',
  [ERROR_CODES.CONSTRAINT_VIOLATION]: 'Operation violates data constraints',
  [ERROR_CODES.EXTERNAL_API_ERROR]: 'External service error',
  [ERROR_CODES.NETWORK_ERROR]: 'Network connection failed',
  [ERROR_CODES.TIMEOUT_ERROR]: 'Request timed out',
  [ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions for this operation',
  [ERROR_CODES.RESOURCE_CONFLICT]: 'Resource conflict detected',
  [ERROR_CODES.OPERATION_NOT_ALLOWED]: 'Operation not allowed',
  [ERROR_CODES.INTERNAL_ERROR]: 'Internal server error',
  [ERROR_CODES.UNKNOWN_ERROR]: 'An unexpected error occurred'
} as const;

/**
 * Create a standardized API error response
 */
export function createErrorResponse(
  code: keyof typeof ERROR_CODES,
  message?: string,
  details?: any,
  field?: string,
  status: number = 500
): Response {
  const errorResponse: APIError = {
    success: false,
    error: {
      code,
      message: message || ERROR_MESSAGES[code],
      ...(details && { details }),
      ...(field && { field })
    }
  };

  return new Response(JSON.stringify(errorResponse), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Create a standardized API success response
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200,
  pagination?: APISuccess<T>['pagination']
): Response {
  const successResponse: APISuccess<T> = {
    success: true,
    data,
    ...(pagination && { pagination })
  };

  return new Response(JSON.stringify(successResponse), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Handle Supabase errors and convert them to standardized API errors
 */
export function handleSupabaseError(error: any): Response {
  console.error('Supabase error:', error);

  // Handle specific Supabase error codes
  switch (error.code) {
    case 'PGRST301':
      return createErrorResponse(ERROR_CODES.NOT_FOUND, 'Resource not found', null, null, 404);
    
    case '23505': // Unique constraint violation
      return createErrorResponse(ERROR_CODES.DUPLICATE_ENTRY, 'Resource already exists', null, null, 409);
    
    case '23503': // Foreign key constraint violation
      return createErrorResponse(ERROR_CODES.CONSTRAINT_VIOLATION, 'Referenced resource does not exist', null, null, 400);
    
    case '23514': // Check constraint violation
      return createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Data validation failed', null, null, 400);
    
    case 'PGRST116': // Row level security violation
      return createErrorResponse(ERROR_CODES.FORBIDDEN, 'Access denied', null, null, 403);
    
    default:
      return createErrorResponse(ERROR_CODES.DATABASE_ERROR, 'Database operation failed', error.message);
  }
}

/**
 * Handle authentication errors
 */
export function handleAuthError(error: any): Response {
  console.error('Auth error:', error);

  if (error.message?.includes('Invalid login credentials')) {
    return createErrorResponse(
      ERROR_CODES.UNAUTHORIZED,
      'Invalid email or password',
      null,
      null,
      401
    );
  }

  if (error.message?.includes('Email not confirmed')) {
    return createErrorResponse(
      ERROR_CODES.UNAUTHORIZED,
      'Please verify your email before signing in',
      null,
      null,
      401
    );
  }

  if (error.message?.includes('Too many requests')) {
    return createErrorResponse(
      ERROR_CODES.VALIDATION_ERROR,
      'Too many attempts. Please wait before trying again',
      null,
      null,
      429
    );
  }

  if (error.message?.includes('already registered')) {
    return createErrorResponse(
      ERROR_CODES.DUPLICATE_ENTRY,
      'An account with this email already exists',
      null,
      'email',
      409
    );
  }

  return createErrorResponse(ERROR_CODES.UNAUTHORIZED, 'Authentication failed');
}

/**
 * Validation helper functions
 */
export const validators = {
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  password: (password: string): { valid: boolean; message?: string } => {
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/(?=.*\d)/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }
    return { valid: true };
  },

  username: (username: string): { valid: boolean; message?: string } => {
    if (username.length < 3) {
      return { valid: false, message: 'Username must be at least 3 characters long' };
    }
    if (username.length > 30) {
      return { valid: false, message: 'Username must be 30 characters or less' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return { valid: false, message: 'Username can only contain letters, numbers, and underscores' };
    }
    return { valid: true };
  },

  required: (value: any, fieldName: string): { valid: boolean; message?: string } => {
    if (value === null || value === undefined || value === '') {
      return { valid: false, message: `${fieldName} is required` };
    }
    return { valid: true };
  },

  rating: (rating: number): { valid: boolean; message?: string } => {
    if (rating < 1 || rating > 10) {
      return { valid: false, message: 'Rating must be between 1 and 10' };
    }
    return { valid: true };
  },

  textLength: (text: string, min: number, max: number, fieldName: string): { valid: boolean; message?: string } => {
    if (text.length < min) {
      return { valid: false, message: `${fieldName} must be at least ${min} characters long` };
    }
    if (text.length > max) {
      return { valid: false, message: `${fieldName} must be ${max} characters or less` };
    }
    return { valid: true };
  }
};

/**
 * Validate request body against schema
 */
export function validateRequestBody(
  body: any,
  schema: Record<string, (value: any) => { valid: boolean; message?: string }>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const [field, validator] of Object.entries(schema)) {
    const result = validator(body[field]);
    if (!result.valid) {
      errors[field] = result.message || `Invalid ${field}`;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Async wrapper for API route handlers with error handling
 */
export function withErrorHandling(
  handler: (context: any) => Promise<Response>
) {
  return async (context: any): Promise<Response> => {
    try {
      return await handler(context);
    } catch (error) {
      console.error('Unhandled API error:', error);
      
      // Handle specific error types
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return createErrorResponse(ERROR_CODES.NETWORK_ERROR, 'Network request failed');
      }
      
      if (error instanceof SyntaxError) {
        return createErrorResponse(ERROR_CODES.VALIDATION_ERROR, 'Invalid JSON in request body');
      }
      
      return createErrorResponse(ERROR_CODES.INTERNAL_ERROR, 'An unexpected error occurred');
    }
  };
}