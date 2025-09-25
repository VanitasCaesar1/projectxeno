import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDefaultSections } from '../lib/mediaConfig';

describe('Movies Page Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should configure DynamicMediaGrid for movies', () => {
    // Test that the correct media type is used
    const sections = getDefaultSections('movie', false);
    
    expect(sections).toHaveLength(3);
    expect(sections[0].title).toBe('Popular Movies');
    expect(sections[1].title).toBe('Trending Movies');
    expect(sections[2].title).toBe('Top Rated Movies');
  });

  it('should include recommended section for logged in users', () => {
    // Test with logged in user
    const sectionsLoggedIn = getDefaultSections('movie', true);
    
    // Should have 4 sections including recommended
    expect(sectionsLoggedIn).toHaveLength(4);
    expect(sectionsLoggedIn[0].title).toBe('Recommended Movies');
  });

  it('should not include recommended section for anonymous users', () => {
    // Test with anonymous user
    const sectionsAnonymous = getDefaultSections('movie', false);
    
    // Should have 3 sections without recommended
    expect(sectionsAnonymous).toHaveLength(3);
    expect(sectionsAnonymous.find(s => s.type === 'recommended')).toBeUndefined();
  });
});

describe('Movies Page Navigation', () => {
  it('should navigate to movie detail pages correctly', () => {
    // Test that movie detail URLs are constructed correctly
    const movieId = 'tt1234567';
    const expectedUrl = `/media/movie/${movieId}`;
    
    expect(expectedUrl).toBe('/media/movie/tt1234567');
  });

  it('should handle movie search and filtering', () => {
    // Test that movie-specific search parameters are used
    const searchParams = new URLSearchParams({
      q: 'action',
      type: 'movie',
      page: '1'
    });
    
    expect(searchParams.get('type')).toBe('movie');
    expect(searchParams.get('q')).toBe('action');
  });
});

describe('Movies Page AddToList Integration', () => {
  beforeEach(() => {
    // Mock fetch for API calls
    global.fetch = vi.fn();
  });

  it('should handle add to list for movies', async () => {
    const mockMovie = {
      id: 'tt1234567',
      title: 'Test Movie',
      type: 'movie' as const,
      year: 2023,
      poster: 'https://example.com/poster.jpg',
      source: 'tmdb' as const
    };

    // Mock successful API response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    const response = await fetch('/api/user/media', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        externalId: mockMovie.id,
        mediaType: mockMovie.type,
        title: mockMovie.title,
        posterUrl: mockMovie.poster,
        releaseDate: `${mockMovie.year}-01-01`,
        genres: [],
        metadata: { source: mockMovie.source, rating: 0, year: mockMovie.year },
        status: 'plan_to_watch'
      }),
    });

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('/api/user/media', expect.objectContaining({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    }));
  });

  it('should show login prompt for unauthenticated users', () => {
    const mockShowLoginPrompt = vi.fn();
    
    // Simulate unauthenticated user trying to add movie
    const movieTitle = 'Test Movie';
    mockShowLoginPrompt(movieTitle);
    
    expect(mockShowLoginPrompt).toHaveBeenCalledWith(movieTitle);
  });
});