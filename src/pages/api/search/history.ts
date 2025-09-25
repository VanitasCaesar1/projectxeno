import type { APIRoute } from 'astro';
import { 
  createErrorResponse, 
  createSuccessResponse, 
  withErrorHandling,
  ERROR_CODES 
} from '../../../lib/errorHandler';
import { supabase } from '../../../lib/supabase';

// GET /api/search/history - Get user's search history
export const GET: APIRoute = withErrorHandling(async ({ request, url }) => {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return createErrorResponse(
      ERROR_CODES.UNAUTHORIZED,
      'Authentication required',
      null,
      null,
      401
    );
  }

  const userId = 'placeholder-user-id';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    const { data, error } = await supabase
      .from('search_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching search history:', error);
      return createErrorResponse(
        ERROR_CODES.DATABASE_ERROR,
        'Failed to fetch search history',
        error
      );
    }

    return createSuccessResponse(data || []);
  } catch (error) {
    console.error('Unexpected error fetching search history:', error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'An unexpected error occurred'
    );
  }
});

// DELETE /api/search/history - Clear user's search history
export const DELETE: APIRoute = withErrorHandling(async ({ request, url }) => {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return createErrorResponse(
      ERROR_CODES.UNAUTHORIZED,
      'Authentication required',
      null,
      null,
      401
    );
  }

  const userId = 'placeholder-user-id';
  const searchId = url.searchParams.get('id');

  try {
    if (searchId) {
      // Delete specific search history entry
      const { error } = await supabase
        .from('search_history')
        .delete()
        .eq('id', searchId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting search history entry:', error);
        return createErrorResponse(
          ERROR_CODES.DATABASE_ERROR,
          'Failed to delete search history entry',
          error
        );
      }

      return createSuccessResponse({ message: 'Search history entry deleted successfully' });
    } else {
      // Clear all search history for user
      const { error } = await supabase
        .from('search_history')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error clearing search history:', error);
        return createErrorResponse(
          ERROR_CODES.DATABASE_ERROR,
          'Failed to clear search history',
          error
        );
      }

      return createSuccessResponse({ message: 'Search history cleared successfully' });
    }
  } catch (error) {
    console.error('Unexpected error managing search history:', error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'An unexpected error occurred'
    );
  }
});