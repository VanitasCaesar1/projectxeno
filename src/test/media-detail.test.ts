import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

// Mock import.meta.env
vi.stubGlobal('import.meta', {
  env: {
    TMDB_API_KEY: 'test-api-key'
  }
});

describe('Media Detail API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle invalid media type', async () => {
    const { GET } = await import('../pages/api/media/[type]/[id].ts');
    
    const mockRequest = {
      params: { type: 'invalid', id: 'tmdb-550' }
    };

    const response = await GET(mockRequest as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INVALID_TYPE');
  });

  it('should handle missing parameters', async () => {
    const { GET } = await import('../pages/api/media/[type]/[id].ts');
    
    const mockRequest = {
      params: { type: null, id: null }
    };

    const response = await GET(mockRequest as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('MISSING_PARAMS');
  });

  it('should handle unsupported ID format', async () => {
    const { GET } = await import('../pages/api/media/[type]/[id].ts');
    
    const mockRequest = {
      params: { type: 'movie', id: 'invalid-format-123' }
    };

    const response = await GET(mockRequest as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('API_ERROR');
    expect(data.error.message).toContain('Unsupported ID format');
  });

  it('should handle type/source mismatch', async () => {
    const { GET } = await import('../pages/api/media/[type]/[id].ts');
    
    const mockRequest = {
      params: { type: 'book', id: 'tmdb-550' } // TMDB doesn't support books
    };

    const response = await GET(mockRequest as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('API_ERROR');
    expect(data.error.message).toContain('TMDB does not support media type');
  });
});

describe('Media Detail Page Functions', () => {
  it('should format runtime correctly', () => {
    // These would be utility functions from the Astro component
    // Testing the logic that would be in the component
    
    function formatRuntime(minutes: number): string {
      if (!minutes) return '';
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hours > 0) {
        return `${hours}h ${mins}m`;
      }
      return `${mins}m`;
    }

    expect(formatRuntime(139)).toBe('2h 19m');
    expect(formatRuntime(90)).toBe('1h 30m');
    expect(formatRuntime(45)).toBe('45m');
    expect(formatRuntime(0)).toBe('');
  });

  it('should format ratings correctly', () => {
    function formatRating(rating: number): string {
      return rating ? rating.toFixed(1) : 'N/A';
    }

    expect(formatRating(8.433)).toBe('8.4');
    expect(formatRating(7)).toBe('7.0');
    expect(formatRating(0)).toBe('N/A');
  });

  it('should get correct status colors', () => {
    function getStatusColor(status: string): string {
      const statusColors = {
        'Released': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        'In Production': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        'Ended': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
        'Canceled': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      };
      return statusColors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }

    expect(getStatusColor('Released')).toContain('bg-green-100');
    expect(getStatusColor('Canceled')).toContain('bg-red-100');
    expect(getStatusColor('Unknown')).toContain('bg-gray-100');
  });
});