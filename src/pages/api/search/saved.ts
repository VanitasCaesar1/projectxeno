import type { APIRoute } from 'astro';
import { 
  createErrorResponse, 
  createSuccessResponse, 
  withErrorHandling,
  ERROR_CODES 
} from '../../../lib/errorHandler';
import { supabase } from '../../../lib/supabase';
import type { SavedSearch, SavedSearchInsert, SearchFilters } from '../../../types/database';

// GET /api/search/saved - Get user's saved searches
export const GET: APIRoute = withErrorHandling(async ({ request, url }) => {
  // Get user from session (this would be implemented with proper auth)
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

  // For now, we'll use a placeholder user ID
  // In a real implementation, this would be extracted from the JWT token
  const userId = 'placeholder-user-id';

  const includePublic = url.searchParams.get('includePublic') === 'true';

  try {
    let query = supabase
      .from('saved_searches')
      .select(`
        *,
        user:user_profiles(username, display_name, avatar_url)
      `)
      .order('updated_at', { ascending: false });

    if (includePublic) {
      // Get user's own searches plus public searches from others
      query = query.or(`user_id.eq.${userId},is_public.eq.true`);
    } else {
      // Get only user's own searches
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching saved searches:', error);
      return createErrorResponse(
        ERROR_CODES.DATABASE_ERROR,
        'Failed to fetch saved searches',
        error
      );
    }

    return createSuccessResponse(data || []);
  } catch (error) {
    console.error('Unexpected error fetching saved searches:', error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'An unexpected error occurred'
    );
  }
});

// POST /api/search/saved - Create a new saved search
export const POST: APIRoute = withErrorHandling(async ({ request }) => {
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

  try {
    const body = await request.json();
    const { name, query, filters, isPublic } = body;

    // Validate required fields
    if (!name || !query) {
      return createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Name and query are required',
        null,
        'name,query',
        400
      );
    }

    if (name.length > 100) {
      return createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Name must be 100 characters or less',
        null,
        'name',
        400
      );
    }

    if (query.length > 500) {
      return createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Query must be 500 characters or less',
        null,
        'query',
        400
      );
    }

    // Check if user already has a saved search with this name
    const { data: existing } = await supabase
      .from('saved_searches')
      .select('id')
      .eq('user_id', userId)
      .eq('name', name)
      .single();

    if (existing) {
      return createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'You already have a saved search with this name',
        null,
        'name',
        409
      );
    }

    const savedSearchData: SavedSearchInsert = {
      user_id: userId,
      name,
      query,
      filters: filters || {},
      is_public: isPublic || false
    };

    const { data, error } = await supabase
      .from('saved_searches')
      .insert(savedSearchData)
      .select(`
        *,
        user:user_profiles(username, display_name, avatar_url)
      `)
      .single();

    if (error) {
      console.error('Error creating saved search:', error);
      return createErrorResponse(
        ERROR_CODES.DATABASE_ERROR,
        'Failed to create saved search',
        error
      );
    }

    return createSuccessResponse(data, 201);
  } catch (error) {
    console.error('Unexpected error creating saved search:', error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'An unexpected error occurred'
    );
  }
});

// PUT /api/search/saved - Update a saved search
export const PUT: APIRoute = withErrorHandling(async ({ request }) => {
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

  try {
    const body = await request.json();
    const { id, name, query, filters, isPublic } = body;

    if (!id) {
      return createErrorResponse(
        ERROR_CODES.VALIDATION_ERROR,
        'Search ID is required',
        null,
        'id',
        400
      );
    }

    // Verify the saved search belongs to the user
    const { data: existing } = await supabase
      .from('saved_searches')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return createErrorResponse(
        ERROR_CODES.NOT_FOUND,
        'Saved search not found',
        null,
        null,
        404
      );
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (name !== undefined) {
      if (name.length > 100) {
        return createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'Name must be 100 characters or less',
          null,
          'name',
          400
        );
      }
      updateData.name = name;
    }

    if (query !== undefined) {
      if (query.length > 500) {
        return createErrorResponse(
          ERROR_CODES.VALIDATION_ERROR,
          'Query must be 500 characters or less',
          null,
          'query',
          400
        );
      }
      updateData.query = query;
    }

    if (filters !== undefined) {
      updateData.filters = filters;
    }

    if (isPublic !== undefined) {
      updateData.is_public = isPublic;
    }

    const { data, error } = await supabase
      .from('saved_searches')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select(`
        *,
        user:user_profiles(username, display_name, avatar_url)
      `)
      .single();

    if (error) {
      console.error('Error updating saved search:', error);
      return createErrorResponse(
        ERROR_CODES.DATABASE_ERROR,
        'Failed to update saved search',
        error
      );
    }

    return createSuccessResponse(data);
  } catch (error) {
    console.error('Unexpected error updating saved search:', error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'An unexpected error occurred'
    );
  }
});

// DELETE /api/search/saved - Delete a saved search
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

  if (!searchId) {
    return createErrorResponse(
      ERROR_CODES.VALIDATION_ERROR,
      'Search ID is required',
      null,
      'id',
      400
    );
  }

  try {
    // Verify the saved search belongs to the user
    const { data: existing } = await supabase
      .from('saved_searches')
      .select('id')
      .eq('id', searchId)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return createErrorResponse(
        ERROR_CODES.NOT_FOUND,
        'Saved search not found',
        null,
        null,
        404
      );
    }

    const { error } = await supabase
      .from('saved_searches')
      .delete()
      .eq('id', searchId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting saved search:', error);
      return createErrorResponse(
        ERROR_CODES.DATABASE_ERROR,
        'Failed to delete saved search',
        error
      );
    }

    return createSuccessResponse({ message: 'Saved search deleted successfully' });
  } catch (error) {
    console.error('Unexpected error deleting saved search:', error);
    return createErrorResponse(
      ERROR_CODES.INTERNAL_ERROR,
      'An unexpected error occurred'
    );
  }
});