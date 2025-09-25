/**
 * Search State Management System
 * Manages search queries, filters, and navigation state for category pages
 */

import { getAuthHeader } from './auth';

export interface SearchFilters {
  mediaType?: string;
  genres?: string[];
  yearFrom?: number;
  yearTo?: number;
  ratingFrom?: number;
  ratingTo?: number;
  sortBy?: string;
  sortOrder?: string;
}

export interface SearchState {
  query: string;
  filters: SearchFilters;
  page: number;
  loading: boolean;
  results: SearchResult[];
  total: number;
  totalPages: number;
  error?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  type: 'movie' | 'tv' | 'book' | 'anime' | 'manga';
  year?: number;
  poster?: string;
  description?: string;
  rating?: number;
  source: 'tmdb' | 'openlibrary' | 'jikan';
}

export class SearchStateManager {
  private state: SearchState;
  private listeners: Set<(state: SearchState) => void> = new Set();
  private debounceTimer: number | null = null;
  private abortController: AbortController | null = null;

  constructor(initialState?: Partial<SearchState>) {
    this.state = {
      query: '',
      filters: {},
      page: 1,
      loading: false,
      results: [],
      total: 0,
      totalPages: 0,
      ...initialState
    };
  }

  // State getters
  getState(): SearchState {
    return { ...this.state };
  }

  getQuery(): string {
    return this.state.query;
  }

  getFilters(): SearchFilters {
    return { ...this.state.filters };
  }

  isLoading(): boolean {
    return this.state.loading;
  }

  // State setters
  setQuery(query: string, debounce: boolean = true): void {
    if (this.state.query === query) return;

    this.updateState({ query, page: 1 });

    if (debounce) {
      this.debouncedSearch();
    } else {
      this.performSearch();
    }
  }

  setFilters(filters: SearchFilters, merge: boolean = true): void {
    const newFilters = merge ? { ...this.state.filters, ...filters } : filters;
    
    // Check if filters actually changed
    if (JSON.stringify(this.state.filters) === JSON.stringify(newFilters)) {
      return;
    }

    this.updateState({ filters: newFilters, page: 1 });
    this.performSearch();
  }

  setPage(page: number): void {
    if (this.state.page === page) return;
    
    this.updateState({ page });
    this.performSearch();
  }

  clearSearch(): void {
    this.cancelPendingSearch();
    this.updateState({
      query: '',
      filters: {},
      page: 1,
      results: [],
      total: 0,
      totalPages: 0,
      error: undefined
    });
  }

  clearFilters(): void {
    this.updateState({ filters: {}, page: 1 });
    if (this.state.query) {
      this.performSearch();
    }
  }

  // Event listeners
  subscribe(listener: (state: SearchState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Search execution
  private debouncedSearch(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.performSearch();
    }, 300);
  }

  private async performSearch(): Promise<void> {
    if (!this.state.query || this.state.query.length < 2) {
      this.updateState({ results: [], total: 0, totalPages: 0, error: undefined });
      return;
    }

    // Cancel previous request
    this.cancelPendingSearch();
    this.abortController = new AbortController();

    this.updateState({ loading: true, error: undefined });

    try {
      const params = new URLSearchParams({
        q: this.state.query,
        page: this.state.page.toString()
      });

      // Add filters to params
      Object.entries(this.state.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            if (value.length > 0) {
              params.set(key, value.join(','));
            }
          } else {
            params.set(key, value.toString());
          }
        }
      });

      const authHeader = await getAuthHeader();
      const response = await fetch(`/api/search?${params}`, {
        signal: this.abortController.signal,
        headers: {
          ...authHeader
        }
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const searchData = data.data || data;
        this.updateState({
          results: searchData.results || [],
          total: searchData.total || 0,
          totalPages: searchData.totalPages || 0,
          loading: false
        });
      } else {
        throw new Error(data.error?.message || 'Search failed');
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Request was cancelled, ignore
      }
      
      console.error('Search error:', error);
      this.updateState({
        loading: false,
        error: error instanceof Error ? error.message : 'Search failed'
      });
    }
  }

  private cancelPendingSearch(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private updateState(updates: Partial<SearchState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getState());
      } catch (error) {
        console.error('Error in search state listener:', error);
      }
    });
  }

  // Utility methods
  hasResults(): boolean {
    return this.state.results.length > 0;
  }

  hasFilters(): boolean {
    return Object.keys(this.state.filters).some(key => {
      const value = this.state.filters[key as keyof SearchFilters];
      return value !== undefined && value !== null && value !== '' && 
             (!Array.isArray(value) || value.length > 0);
    });
  }

  getActiveFilterCount(): number {
    return Object.keys(this.state.filters).filter(key => {
      const value = this.state.filters[key as keyof SearchFilters];
      return value !== undefined && value !== null && value !== '' && 
             (!Array.isArray(value) || value.length > 0);
    }).length;
  }

  // URL state management
  toURLParams(): URLSearchParams {
    const params = new URLSearchParams();
    
    if (this.state.query) {
      params.set('q', this.state.query);
    }
    
    if (this.state.page > 1) {
      params.set('page', this.state.page.toString());
    }

    Object.entries(this.state.filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          if (value.length > 0) {
            params.set(key, value.join(','));
          }
        } else {
          params.set(key, value.toString());
        }
      }
    });

    return params;
  }

  fromURLParams(params: URLSearchParams): void {
    const query = params.get('q') || '';
    const page = parseInt(params.get('page') || '1');
    
    const filters: SearchFilters = {};
    
    // Parse filter parameters
    const mediaType = params.get('mediaType');
    if (mediaType) filters.mediaType = mediaType;
    
    const genres = params.get('genres');
    if (genres) filters.genres = genres.split(',');
    
    const yearFrom = params.get('yearFrom');
    if (yearFrom) filters.yearFrom = parseInt(yearFrom);
    
    const yearTo = params.get('yearTo');
    if (yearTo) filters.yearTo = parseInt(yearTo);
    
    const ratingFrom = params.get('ratingFrom');
    if (ratingFrom) filters.ratingFrom = parseFloat(ratingFrom);
    
    const ratingTo = params.get('ratingTo');
    if (ratingTo) filters.ratingTo = parseFloat(ratingTo);
    
    const sortBy = params.get('sortBy');
    if (sortBy) filters.sortBy = sortBy;
    
    const sortOrder = params.get('sortOrder');
    if (sortOrder) filters.sortOrder = sortOrder;

    this.updateState({ query, page, filters });
    
    if (query) {
      this.performSearch();
    }
  }

  // Browser history integration
  updateURL(replace: boolean = false): void {
    const params = this.toURLParams();
    const url = new URL(window.location.href);
    
    // Clear existing search params
    url.search = '';
    
    // Add new params
    params.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    if (replace) {
      window.history.replaceState(null, '', url.toString());
    } else {
      window.history.pushState(null, '', url.toString());
    }
  }

  // Cleanup
  destroy(): void {
    this.cancelPendingSearch();
    this.listeners.clear();
  }
}

// Global search state instances for different media types
const searchStates = new Map<string, SearchStateManager>();

export function getSearchState(mediaType: string): SearchStateManager {
  if (!searchStates.has(mediaType)) {
    searchStates.set(mediaType, new SearchStateManager({ 
      filters: { mediaType } 
    }));
  }
  return searchStates.get(mediaType)!;
}

export function clearAllSearchStates(): void {
  searchStates.forEach(state => state.destroy());
  searchStates.clear();
}