import type { APIRoute } from 'astro';
import { 
  createErrorResponse, 
  createSuccessResponse, 
  withErrorHandling,
  ERROR_CODES 
} from '../../../lib/errorHandler';
import { supabase } from '../../../lib/supabase';

// GET /api/search/suggestions - Get search suggestions
export const GET: APIRoute = withErrorHandling(async ({ url, request }) => {
  const query = url.searchParams.get('q');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 20);
  const includeHistory = url.searchParams.get('includeHistory') === 'true';
  
  const authHeader = request.headers.get('authorization');
  const userId = authHeader ? 'placeholder-user-id' : null;

  try {
    const suggestions: any[] = [];

    // Get popular search suggestions
    if (query && query.length >= 2) {
      const { data: popularSuggestions, error: popularError } = await supabase
        .from('search_suggestions')
        .select('query, search_count')
        .ilike('query', `%${query}%`)
        .order('search_count', { ascending: false })
        .limit(Math.ceil(limit / 2));

      if (popularError) {
        console.error('Error fetching popular suggestions:', popularError);
      } else {
        suggestions.push(...(popularSuggestions || []).map(s => ({
          query: s.query,
          type: 'popular',
          count: s.search_count
        })));
      }
    }

    // Get user's search history if authenticated and requested
    if (includeHistory && userId && query && query.length >= 2) {
      const { data: historySuggestions, error: historyError } = await supabase
        .from('search_history')
        .select('query, created_at')
        .eq('user_id', userId)
        .ilike('query', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(Math.floor(limit / 2));

      if (historyError) {
        console.error('Error fetching history suggestions:', historyError);
      } else {
        suggestions.push(...(historySuggestions || []).map(s => ({
          query: s.query,
          type: 'history',
          lastSearched: s.created_at
        })));
      }
    }

    // If no query provided, get trending searches
    if (!query || query.length < 2) {
      const { data: trendingSuggestions, error: trendingError } = await supabase
        .from('search_suggestions')
        .select('query, search_count, last_searched')
        .order('last_searched', { ascending: false })
        .limit(limit);

      if (trendingError) {
        console.error('Error fetching trending suggestions:', trendingError);
      } else {
        suggestions.push(...(trendingSuggestions || []).map(s => ({
          query: s.query,
          type: 'trending',
          count: s.search_count,
          lastSearched: s.last_searched
        })));
      }
    }

    // Remove duplicates and limit results
    const uniqueSuggestions = suggestions
      .filter((suggestion, index, self) => 
        index === self.findIndex(s => s.query === suggestion.query)
      )
      .slice(0, limit);

    return createSuccessResponse(uniqueSuggestions);
  } catch (error) {
    console.error('Unexpected error fetching search suggestions:', error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'An unexpected error occurred'
    );
  }
});