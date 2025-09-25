import type { APIRoute } from 'astro';
import { 
  createErrorResponse, 
  createSuccessResponse, 
  withErrorHandling,
  ERROR_CODES 
} from '../../lib/errorHandler';
import { cachedFetch, cacheKeys, cacheTTL } from '../../lib/cache';
import { performanceMonitor } from '../../lib/performance';
import { supabase } from '../../lib/supabase';
import type { SearchFilters } from '../../types/database';

interface SearchResult {
  id: string;
  title: string;
  type: 'movie' | 'tv' | 'book' | 'anime' | 'manga';
  year?: number;
  poster?: string;
  description?: string;
  rating?: number;
  source: 'tmdb' | 'openlibrary' | 'jikan';
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  totalPages: number;
}

// TMDB API functions
async function searchTMDB(query: string, page: number = 1): Promise<SearchResult[]> {
  const apiKey = import.meta.env.TMDB_API_KEY;
  if (!apiKey) {
    console.warn('TMDB API key not configured');
    return [];
  }

  const cacheKey = cacheKeys.tmdbSearch(query, page);
  
  return cachedFetch(cacheKey, async () => {
    const response = await fetch(
      `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=${page}`
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    
    return data.results?.map((item: any) => ({
      id: `tmdb-${item.id}`,
      title: item.title || item.name,
      type: item.media_type === 'movie' ? 'movie' : 'tv',
      year: item.release_date ? new Date(item.release_date).getFullYear() : 
            item.first_air_date ? new Date(item.first_air_date).getFullYear() : undefined,
      poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
      description: item.overview,
      rating: item.vote_average,
      source: 'tmdb' as const
    })) || [];
  }, cacheTTL.search).catch(error => {
    console.error('TMDB search error:', error);
    return [];
  });
}

// Open Library API functions
async function searchOpenLibrary(query: string, page: number = 1): Promise<SearchResult[]> {
  const cacheKey = cacheKeys.openLibrarySearch(query, page);
  
  return cachedFetch(cacheKey, async () => {
    const offset = (page - 1) * 20;
    const response = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20&offset=${offset}`
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    
    return data.docs?.map((book: any) => {
      const cleanKey = book.key.replace('/works/', '').replace('/books/', '');
      return {
        id: `ol-${cleanKey}`,
        title: book.title,
        type: 'book' as const,
        year: book.first_publish_year,
        poster: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : undefined,
        description: book.subtitle,
        rating: undefined,
        source: 'openlibrary' as const
      };
    }) || [];
  }, cacheTTL.search).catch(error => {
    console.error('Open Library search error:', error);
    return [];
  });
}

// Jikan API functions
async function searchJikan(query: string, page: number = 1): Promise<SearchResult[]> {
  const cacheKey = cacheKeys.jikanSearch(query, page);
  
  return cachedFetch(cacheKey, async () => {
    // Add delay to respect Jikan API rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Search both anime and manga
    const [animeResponse, mangaResponse] = await Promise.all([
      fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&page=${page}&limit=10`),
      fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&page=${page}&limit=10`)
    ]);
    
    const results: SearchResult[] = [];
    
    if (animeResponse.ok) {
      const animeData = await animeResponse.json();
      const animeResults = animeData.data?.map((anime: any) => ({
        id: `jikan-anime-${anime.mal_id}`,
        title: anime.title,
        type: 'anime' as const,
        year: anime.year,
        poster: anime.images?.jpg?.image_url,
        description: anime.synopsis,
        rating: anime.score,
        source: 'jikan' as const
      })) || [];
      results.push(...animeResults);
    }
    
    if (mangaResponse.ok) {
      const mangaData = await mangaResponse.json();
      const mangaResults = mangaData.data?.map((manga: any) => ({
        id: `jikan-manga-${manga.mal_id}`,
        title: manga.title,
        type: 'manga' as const,
        year: manga.published?.from ? new Date(manga.published.from).getFullYear() : undefined,
        poster: manga.images?.jpg?.image_url,
        description: manga.synopsis,
        rating: manga.score,
        source: 'jikan' as const
      })) || [];
      results.push(...mangaResults);
    }
    
    return results;
  }, cacheTTL.search).catch(error => {
    console.error('Jikan search error:', error);
    return [];
  });
}

export const GET: APIRoute = withErrorHandling(async ({ url, request }) => {
  performanceMonitor.startTimer('search-total');
  
  const query = url.searchParams.get('q');
  const page = parseInt(url.searchParams.get('page') || '1');
  const type = url.searchParams.get('type') || url.searchParams.get('mediaType'); // Filter by media type
  
  // Advanced filter parameters
  const genres = url.searchParams.get('genres')?.split(',').filter(Boolean) || [];
  const yearFrom = url.searchParams.get('yearFrom') ? parseInt(url.searchParams.get('yearFrom')!) : undefined;
  const yearTo = url.searchParams.get('yearTo') ? parseInt(url.searchParams.get('yearTo')!) : undefined;
  const ratingFrom = url.searchParams.get('ratingFrom') ? parseFloat(url.searchParams.get('ratingFrom')!) : undefined;
  const ratingTo = url.searchParams.get('ratingTo') ? parseFloat(url.searchParams.get('ratingTo')!) : undefined;
  const sortBy = url.searchParams.get('sortBy') || 'relevance';
  const sortOrder = url.searchParams.get('sortOrder') || 'desc';
  
  if (!query || query.trim().length < 2) {
    return createErrorResponse(
      ERROR_CODES.VALIDATION_ERROR,
      'Search query must be at least 2 characters long',
      null,
      'q',
      400
    );
  }

  if (page < 1 || page > 100) {
    return createErrorResponse(
      ERROR_CODES.VALIDATION_ERROR,
      'Page must be between 1 and 100',
      null,
      'page',
      400
    );
  }

  // Validate sort parameters
  const validSortBy = ['relevance', 'rating', 'year', 'title', 'popularity'];
  const validSortOrder = ['asc', 'desc'];
  
  if (!validSortBy.includes(sortBy)) {
    return createErrorResponse(
      ERROR_CODES.VALIDATION_ERROR,
      `Invalid sortBy. Must be one of: ${validSortBy.join(', ')}`,
      null,
      'sortBy',
      400
    );
  }
  
  if (!validSortOrder.includes(sortOrder)) {
    return createErrorResponse(
      ERROR_CODES.VALIDATION_ERROR,
      `Invalid sortOrder. Must be one of: ${validSortOrder.join(', ')}`,
      null,
      'sortOrder',
      400
    );
  }

  // Get user ID for search history (if authenticated)
  const authHeader = request.headers.get('authorization');
  let userId: string | null = null;
  
  if (authHeader) {
    try {
      // Extract user ID from auth header if available
      // This would typically involve verifying the JWT token
      // For now, we'll skip this and implement it when we have auth context
    } catch (error) {
      console.warn('Failed to extract user ID from auth header:', error);
    }
  }

  // Search all APIs in parallel with timeout and performance monitoring
  performanceMonitor.startTimer('api-calls');
  const searchPromises = [
    searchTMDB(query, page),
    searchOpenLibrary(query, page),
    searchJikan(query, page)
  ];

  // Add timeout to prevent hanging requests
  const timeoutPromise = new Promise<SearchResult[]>((_, reject) => {
    setTimeout(() => reject(new Error('Search timeout')), 15000);
  });

  const [tmdbResults, openLibraryResults, jikanResults] = await Promise.all(
    searchPromises.map(promise => 
      Promise.race([promise, timeoutPromise]).catch(error => {
        console.warn('Search API partial failure:', error);
        return []; // Return empty array on individual API failure
      })
    )
  );
  
  const apiCallDuration = performanceMonitor.endTimer('api-calls');
  performanceMonitor.recordApiResponse('combined', apiCallDuration);

  // Combine and filter results
  let allResults = [...tmdbResults, ...openLibraryResults, ...jikanResults];
  
  // Filter by type if specified
  if (type && type !== 'all') {
    const validTypes = ['movie', 'tv', 'book', 'anime', 'manga'];
    if (!validTypes.includes(type)) {
      return createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        `Invalid media type. Must be one of: ${validTypes.join(', ')}`,
        null,
        'type',
        400
      );
    }
    allResults = allResults.filter(result => result.type === type);
  }

  // Apply advanced filters
  allResults = applyAdvancedFilters(allResults, {
    genres,
    yearFrom,
    yearTo,
    ratingFrom,
    ratingTo
  });

  // Apply sorting
  allResults = applySorting(allResults, sortBy, sortOrder, query);

  // Save search to history if user is authenticated
  if (userId) {
    try {
      await saveSearchToHistory(userId, query, {
        mediaType: type || undefined,
        genre: genres,
        yearFrom,
        yearTo,
        ratingFrom,
        ratingTo,
        sortBy,
        sortOrder
      }, allResults.length);
    } catch (error) {
      console.warn('Failed to save search to history:', error);
      // Don't fail the request if history saving fails
    }
  }

  const totalDuration = performanceMonitor.endTimer('search-total');
  performanceMonitor.recordSearchTime(totalDuration);

  const response: SearchResponse = {
    results: allResults,
    total: allResults.length,
    page,
    totalPages: Math.ceil(allResults.length / 20)
  };

  // Log performance metrics in development
  if (import.meta.env.DEV) {
    performanceMonitor.logMetrics();
  }

  return createSuccessResponse(response);
});

// Helper function to apply advanced filters
function applyAdvancedFilters(results: SearchResult[], filters: {
  genres: string[];
  yearFrom?: number;
  yearTo?: number;
  ratingFrom?: number;
  ratingTo?: number;
}): SearchResult[] {
  return results.filter(result => {
    // Genre filter (if genres are available in result metadata)
    if (filters.genres.length > 0) {
      // This would need to be implemented based on how genres are stored in each API
      // For now, we'll skip genre filtering as it requires API-specific logic
    }

    // Year filter
    if (filters.yearFrom && result.year && result.year < filters.yearFrom) {
      return false;
    }
    if (filters.yearTo && result.year && result.year > filters.yearTo) {
      return false;
    }

    // Rating filter
    if (filters.ratingFrom && result.rating && result.rating < filters.ratingFrom) {
      return false;
    }
    if (filters.ratingTo && result.rating && result.rating > filters.ratingTo) {
      return false;
    }

    return true;
  });
}

// Helper function to apply sorting
function applySorting(results: SearchResult[], sortBy: string, sortOrder: string, query: string): SearchResult[] {
  return results.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'relevance':
        // Title match relevance
        const aExactMatch = a.title.toLowerCase().includes(query.toLowerCase());
        const bExactMatch = b.title.toLowerCase().includes(query.toLowerCase());
        
        if (aExactMatch && !bExactMatch) comparison = -1;
        else if (!aExactMatch && bExactMatch) comparison = 1;
        else {
          // Secondary sort by rating for relevance
          const aRating = a.rating || 0;
          const bRating = b.rating || 0;
          comparison = bRating - aRating;
        }
        break;

      case 'rating':
        const aRating = a.rating || 0;
        const bRating = b.rating || 0;
        comparison = bRating - aRating;
        break;

      case 'year':
        const aYear = a.year || 0;
        const bYear = b.year || 0;
        comparison = bYear - aYear;
        break;

      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;

      case 'popularity':
        // For popularity, we'll use rating as a proxy
        const aPopularity = a.rating || 0;
        const bPopularity = b.rating || 0;
        comparison = bPopularity - aPopularity;
        break;

      default:
        comparison = 0;
    }

    // Apply sort order
    return sortOrder === 'asc' ? comparison : -comparison;
  });
}

// Helper function to save search to history
async function saveSearchToHistory(
  userId: string, 
  query: string, 
  filters: SearchFilters, 
  resultsCount: number
): Promise<void> {
  try {
    const { error } = await supabase
      .from('search_history')
      .insert({
        user_id: userId,
        query,
        filters: filters as any,
        results_count: resultsCount
      });

    if (error) {
      console.error('Error saving search history:', error);
    }
  } catch (error) {
    console.error('Failed to save search history:', error);
  }
}