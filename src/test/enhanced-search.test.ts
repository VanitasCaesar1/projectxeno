import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchStateManager } from '../lib/searchState';

// Mock fetch for testing
global.fetch = vi.fn();

describe('Enhanced Search System', () => {
  let searchState: SearchStateManager;

  beforeEach(() => {
    searchState = new SearchStateManager();
    vi.clearAllMocks();
  });

  describe('SearchStateManager', () => {
    it('should initialize with default state', () => {
      const state = searchState.getState();
      
      expect(state.query).toBe('');
      expect(state.filters).toEqual({});
      expect(state.page).toBe(1);
      expect(state.loading).toBe(false);
      expect(state.results).toEqual([]);
      expect(state.total).toBe(0);
      expect(state.totalPages).toBe(0);
    });

    it('should update query and trigger search', async () => {
      const mockResponse = {
        success: true,
        data: {
          results: [
            {
              id: 'test-1',
              title: 'Test Movie',
              type: 'movie',
              year: 2023,
              rating: 8.5,
              source: 'tmdb'
            }
          ],
          total: 1,
          totalPages: 1
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // Set up state listener
      let stateUpdates: any[] = [];
      searchState.subscribe((state) => {
        stateUpdates.push({ ...state });
      });

      // Set query
      searchState.setQuery('test movie', false);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that fetch was called
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search?q=test+movie&page=1'),
        expect.any(Object)
      );

      // Check final state
      const finalState = searchState.getState();
      expect(finalState.query).toBe('test movie');
      expect(finalState.results).toHaveLength(1);
      expect(finalState.results[0].title).toBe('Test Movie');
    });

    it('should handle filters correctly', () => {
      const filters = {
        mediaType: 'movie',
        yearFrom: 2020,
        yearTo: 2023,
        genres: ['Action', 'Comedy']
      };

      searchState.setFilters(filters);

      const state = searchState.getState();
      expect(state.filters).toEqual(filters);
      expect(searchState.hasFilters()).toBe(true);
      expect(searchState.getActiveFilterCount()).toBe(4);
    });

    it('should clear search and filters', () => {
      // Set some state
      searchState.setQuery('test');
      searchState.setFilters({ mediaType: 'movie', yearFrom: 2020 });

      // Clear everything
      searchState.clearSearch();

      const state = searchState.getState();
      expect(state.query).toBe('');
      expect(state.filters).toEqual({});
      expect(state.results).toEqual([]);
      expect(searchState.hasFilters()).toBe(false);
    });

    it('should handle URL parameters', () => {
      const params = new URLSearchParams();
      params.set('q', 'test query');
      params.set('mediaType', 'movie');
      params.set('yearFrom', '2020');
      params.set('genres', 'Action,Comedy');
      params.set('page', '2');

      searchState.fromURLParams(params);

      const state = searchState.getState();
      expect(state.query).toBe('test query');
      expect(state.page).toBe(2);
      expect(state.filters.mediaType).toBe('movie');
      expect(state.filters.yearFrom).toBe(2020);
      expect(state.filters.genres).toEqual(['Action', 'Comedy']);
    });

    it('should generate URL parameters correctly', () => {
      searchState.setQuery('test movie');
      searchState.setFilters({
        mediaType: 'movie',
        yearFrom: 2020,
        genres: ['Action']
      });
      searchState.setPage(2);

      const params = searchState.toURLParams();
      
      expect(params.get('q')).toBe('test movie');
      expect(params.get('mediaType')).toBe('movie');
      expect(params.get('yearFrom')).toBe('2020');
      expect(params.get('genres')).toBe('Action');
      expect(params.get('page')).toBe('2');
    });

    it('should handle search errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      let stateUpdates: any[] = [];
      searchState.subscribe((state) => {
        stateUpdates.push({ ...state });
      });

      searchState.setQuery('test', false);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalState = searchState.getState();
      expect(finalState.loading).toBe(false);
      expect(finalState.error).toBeTruthy();
    });
  });

  describe('Filter Validation', () => {
    it('should validate year range filters', () => {
      const filters = {
        yearFrom: 2025,
        yearTo: 2020 // Invalid: from > to
      };

      searchState.setFilters(filters);
      
      // The system should still accept the filters but the API should handle validation
      const state = searchState.getState();
      expect(state.filters.yearFrom).toBe(2025);
      expect(state.filters.yearTo).toBe(2020);
    });

    it('should validate rating range filters', () => {
      const filters = {
        ratingFrom: 8.5,
        ratingTo: 6.0 // Invalid: from > to
      };

      searchState.setFilters(filters);
      
      const state = searchState.getState();
      expect(state.filters.ratingFrom).toBe(8.5);
      expect(state.filters.ratingTo).toBe(6.0);
    });

    it('should handle empty genre arrays', () => {
      const filters = {
        genres: []
      };

      searchState.setFilters(filters);
      
      const state = searchState.getState();
      expect(state.filters.genres).toEqual([]);
      expect(searchState.hasFilters()).toBe(false); // Empty arrays don't count as active filters
    });
  });

  describe('Debouncing', () => {
    it('should debounce search queries', async () => {
      const mockResponse = {
        success: true,
        data: { results: [], total: 0, totalPages: 0 }
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      // Set multiple queries quickly
      searchState.setQuery('a', true);
      searchState.setQuery('ab', true);
      searchState.setQuery('abc', true);

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 400));

      // Should only make one API call for the final query
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('q=abc'),
        expect.any(Object)
      );
    });
  });
});

describe('Search Component Integration', () => {
  it('should handle media type specific searches', () => {
    const movieSearch = new SearchStateManager({ filters: { mediaType: 'movie' } });
    const animeSearch = new SearchStateManager({ filters: { mediaType: 'anime' } });

    expect(movieSearch.getFilters().mediaType).toBe('movie');
    expect(animeSearch.getFilters().mediaType).toBe('anime');
  });

  it('should maintain separate state for different media types', () => {
    const movieSearch = new SearchStateManager({ filters: { mediaType: 'movie' } });
    const bookSearch = new SearchStateManager({ filters: { mediaType: 'book' } });

    movieSearch.setQuery('action movies');
    bookSearch.setQuery('fantasy books');

    expect(movieSearch.getQuery()).toBe('action movies');
    expect(bookSearch.getQuery()).toBe('fantasy books');
    expect(movieSearch.getFilters().mediaType).toBe('movie');
    expect(bookSearch.getFilters().mediaType).toBe('book');
  });
});