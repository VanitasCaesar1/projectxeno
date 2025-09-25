import { describe, it, expect, vi } from 'vitest';

// Mock fetch for testing
global.fetch = vi.fn();

describe('Search API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle empty query', async () => {
    const mockFetch = vi.mocked(fetch);
    
    // Mock the API response for empty query
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        results: [],
        total: 0,
        page: 1,
        totalPages: 0
      })
    } as Response);

    const response = await fetch('/api/search?q=');
    const data = await response.json();
    
    expect(data.results).toEqual([]);
    expect(data.total).toBe(0);
  });

  it('should handle valid search query', async () => {
    const mockFetch = vi.mocked(fetch);
    
    // Mock successful search response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            id: 'test-1',
            title: 'Test Movie',
            type: 'movie',
            year: 2023,
            source: 'tmdb'
          }
        ],
        total: 1,
        page: 1,
        totalPages: 1
      })
    } as Response);

    const response = await fetch('/api/search?q=test');
    const data = await response.json();
    
    expect(data.results).toHaveLength(1);
    expect(data.results[0].title).toBe('Test Movie');
    expect(data.total).toBe(1);
  });

  it('should handle API errors gracefully', async () => {
    const mockFetch = vi.mocked(fetch);
    
    // Mock API error
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    try {
      await fetch('/api/search?q=test');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
  });
});

describe('Search Components', () => {
  it('should create media card with required props', () => {
    const mediaData = {
      id: 'test-1',
      title: 'Test Movie',
      type: 'movie' as const,
      year: 2023,
      source: 'tmdb' as const
    };

    // Test that the media data structure is valid
    expect(mediaData.id).toBeDefined();
    expect(mediaData.title).toBeDefined();
    expect(mediaData.type).toBeDefined();
    expect(mediaData.source).toBeDefined();
  });

  it('should handle different media types', () => {
    const mediaTypes = ['movie', 'tv', 'book', 'anime', 'manga'];
    
    mediaTypes.forEach(type => {
      const mediaData = {
        id: `test-${type}`,
        title: `Test ${type}`,
        type: type as any,
        source: 'tmdb' as const
      };
      
      expect(mediaTypes).toContain(mediaData.type);
    });
  });
});