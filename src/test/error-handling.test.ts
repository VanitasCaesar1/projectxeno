import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  createErrorResponse, 
  createSuccessResponse, 
  handleSupabaseError,
  handleAuthError,
  validators,
  validateRequestBody,
  ERROR_CODES 
} from '../lib/errorHandler';
import { 
  fetchWithRetry, 
  APIClient, 
  APIError,
  handleAPIError 
} from '../lib/networkUtils';
import { 
  FormValidator,
  ValidationRules,
  CommonValidators,
  checkUsernameAvailability 
} from '../lib/formValidation';

describe('Error Handler', () => {
  describe('createErrorResponse', () => {
    it('should create a standardized error response', async () => {
      const response = createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Test error message',
        { field: 'email' },
        'email',
        400
      );

      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Test error message',
          details: { field: 'email' },
          field: 'email'
        }
      });
    });

    it('should use default message when none provided', async () => {
      const response = createErrorResponse(ERROR_CODES.NOT_FOUND);
      const body = await response.json();
      
      expect(body.error.message).toBe('Resource not found');
    });
  });

  describe('createSuccessResponse', () => {
    it('should create a standardized success response', async () => {
      const data = { id: 1, name: 'Test' };
      const response = createSuccessResponse(data, 201);

      expect(response.status).toBe(201);
      
      const body = await response.json();
      expect(body).toEqual({
        success: true,
        data: { id: 1, name: 'Test' }
      });
    });

    it('should include pagination when provided', async () => {
      const data = [{ id: 1 }];
      const pagination = { page: 1, limit: 10, total: 1, totalPages: 1 };
      const response = createSuccessResponse(data, 200, pagination);

      const body = await response.json();
      expect(body.pagination).toEqual(pagination);
    });
  });

  describe('validators', () => {
    describe('email', () => {
      it('should validate correct email addresses', () => {
        expect(validators.email('test@example.com')).toBe(true);
        expect(validators.email('user.name+tag@domain.co.uk')).toBe(true);
      });

      it('should reject invalid email addresses', () => {
        expect(validators.email('invalid-email')).toBe(false);
        expect(validators.email('test@')).toBe(false);
        expect(validators.email('@domain.com')).toBe(false);
      });
    });

    describe('password', () => {
      it('should validate strong passwords', () => {
        const result = validators.password('StrongPass123');
        expect(result.valid).toBe(true);
      });

      it('should reject weak passwords', () => {
        expect(validators.password('weak').valid).toBe(false);
        expect(validators.password('nouppercase123').valid).toBe(false);
        expect(validators.password('NOLOWERCASE123').valid).toBe(false);
        expect(validators.password('NoNumbers').valid).toBe(false);
      });
    });

    describe('username', () => {
      it('should validate correct usernames', () => {
        expect(validators.username('validuser').valid).toBe(true);
        expect(validators.username('user_123').valid).toBe(true);
      });

      it('should reject invalid usernames', () => {
        expect(validators.username('ab').valid).toBe(false); // too short
        expect(validators.username('user-name').valid).toBe(false); // invalid chars
        expect(validators.username('user@name').valid).toBe(false); // invalid chars
      });
    });
  });

  describe('validateRequestBody', () => {
    it('should validate request body against schema', () => {
      const body = { email: 'test@example.com', password: 'ValidPass123' };
      const schema = {
        email: (value: string) => validators.email(value) ? { valid: true } : { valid: false, message: 'Invalid email' },
        password: (value: string) => validators.password(value)
      };

      const result = validateRequestBody(body, schema);
      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('should return errors for invalid data', () => {
      const body = { email: 'invalid', password: 'weak' };
      const schema = {
        email: (value: string) => validators.email(value) ? { valid: true } : { valid: false, message: 'Invalid email' },
        password: (value: string) => validators.password(value)
      };

      const result = validateRequestBody(body, schema);
      expect(result.valid).toBe(false);
      expect(result.errors.email).toBe('Invalid email');
      expect(result.errors.password).toContain('Password must');
    });
  });
});

describe('Network Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchWithRetry', () => {
    it('should retry on network errors', async () => {
      const mockFetch = vi.fn()
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValueOnce(new Response('success'));

      global.fetch = mockFetch;

      const response = await fetchWithRetry('http://test.com', {
        retry: { maxRetries: 1, baseDelay: 10 }
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(response.status).toBe(200);
    });

    it('should timeout requests', async () => {
      const mockFetch = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      global.fetch = mockFetch;

      await expect(
        fetchWithRetry('http://test.com', { timeout: 50, retry: { maxRetries: 0 } })
      ).rejects.toThrow();
    }, 1000);
  });

  describe('APIClient', () => {
    let client: APIClient;

    beforeEach(() => {
      client = new APIClient('http://api.test.com');
    });

    it('should make GET requests', async () => {
      const mockResponse = { success: true, data: { id: 1 } };
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse))
      );

      global.fetch = mockFetch;

      const result = await client.get('/users/1');
      expect(result).toEqual({ id: 1 });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://api.test.com/users/1',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should handle API errors', async () => {
      const mockResponse = { 
        success: false, 
        error: { code: 'NOT_FOUND', message: 'User not found' } 
      };
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 404 })
      );

      global.fetch = mockFetch;

      await expect(client.get('/users/999')).rejects.toThrow(APIError);
    });
  });

  describe('APIError', () => {
    it('should identify retryable errors', () => {
      const networkError = new APIError(0, 'Network error', 'NETWORK_ERROR');
      const serverError = new APIError(500, 'Server error', 'INTERNAL_ERROR');
      const clientError = new APIError(400, 'Bad request', 'VALIDATION_ERROR');

      expect(networkError.isRetryable()).toBe(true);
      expect(serverError.isRetryable()).toBe(true);
      expect(clientError.isRetryable()).toBe(false);
    });

    it('should categorize error types', () => {
      const networkError = new APIError(0, 'Network error', 'NETWORK_ERROR');
      const clientError = new APIError(400, 'Bad request', 'VALIDATION_ERROR');
      const serverError = new APIError(500, 'Server error', 'INTERNAL_ERROR');

      expect(networkError.isNetworkError()).toBe(true);
      expect(clientError.isClientError()).toBe(true);
      expect(serverError.isServerError()).toBe(true);
    });
  });

  describe('handleAPIError', () => {
    it('should return user-friendly messages for different error types', () => {
      const networkError = new APIError(0, 'Network error', 'NETWORK_ERROR');
      const timeoutError = new Error('AbortError');
      timeoutError.name = 'AbortError';

      expect(handleAPIError(networkError)).toBe('Network error'); // APIError returns its message
      expect(handleAPIError(timeoutError)).toContain('Request timed out');
    });
  });
});

describe('Form Validation', () => {
  describe('ValidationRules', () => {
    it('should create required validation rule', () => {
      const rule = ValidationRules.required('Field is required');
      
      expect(rule.validate('')).toBe(false);
      expect(rule.validate(null)).toBe(false);
      expect(rule.validate('value')).toBe(true);
      expect(rule.message).toBe('Field is required');
    });

    it('should create email validation rule', () => {
      const rule = ValidationRules.email();
      
      expect(rule.validate('test@example.com')).toBe(true);
      expect(rule.validate('invalid-email')).toBe(false);
      expect(rule.validate('')).toBe(true); // Empty is valid (let required handle it)
    });

    it('should create minLength validation rule', () => {
      const rule = ValidationRules.minLength(5);
      
      expect(rule.validate('12345')).toBe(true);
      expect(rule.validate('1234')).toBe(false);
      expect(rule.validate('')).toBe(true); // Empty is valid
    });

    it('should create confirmPassword validation rule', () => {
      const rule = ValidationRules.confirmPassword('password');
      const formData = new FormData();
      formData.set('password', 'secret123');
      
      expect(rule.validate('secret123', formData)).toBe(true);
      expect(rule.validate('different', formData)).toBe(false);
    });
  });

  describe('CommonValidators', () => {
    it('should provide login form validation config', () => {
      const config = CommonValidators.loginForm();
      
      expect(config.fields.email).toBeDefined();
      expect(config.fields.password).toBeDefined();
      expect(config.fields.email.rules).toHaveLength(2); // required + email
    });

    it('should provide register form validation config', () => {
      const config = CommonValidators.registerForm();
      
      expect(config.fields.username).toBeDefined();
      expect(config.fields.email).toBeDefined();
      expect(config.fields.password).toBeDefined();
      expect(config.fields.confirmPassword).toBeDefined();
    });

    it('should provide review form validation config', () => {
      const config = CommonValidators.reviewForm();
      
      expect(config.fields.rating).toBeDefined();
      expect(config.fields.content).toBeDefined();
    });
  });
});

// Mock DOM for form validation tests
const mockDOM = () => {
  const mockElement = {
    addEventListener: vi.fn(),
    querySelector: vi.fn(),
    classList: {
      add: vi.fn(),
      remove: vi.fn()
    },
    value: '',
    textContent: ''
  };

  global.document = {
    querySelector: vi.fn().mockReturnValue(mockElement),
    getElementById: vi.fn().mockReturnValue(mockElement),
    addEventListener: vi.fn()
  } as any;

  return mockElement;
};

describe('Form Validation Integration', () => {
  beforeEach(() => {
    mockDOM();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle username availability checking', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ available: true }))
    );

    global.fetch = mockFetch;

    const result = await checkUsernameAvailability('testuser');
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/auth/check-username?username=testuser'
    );
  });

  it('should handle username availability check errors', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    global.fetch = mockFetch;

    const result = await checkUsernameAvailability('testuser');
    expect(result).toBe(false);
  });
});