import type { APIRoute } from 'astro';
import { supabase, db } from '../../../lib/supabase';
import type { ApiResponse } from '../../../types/database';

// GET /api/user/media-status - Get user's media status for multiple external IDs
export const GET: APIRoute = async ({ request, url, cookies }) => {
  try {
    // Get tokens from cookies
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }), { status: 401 });
    }

    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid authentication' }
      }), { status: 401 });
    }

    const searchParams = url.searchParams;
    const externalIdsParam = searchParams.get('externalIds');
    const mediaType = searchParams.get('mediaType');

    if (!externalIdsParam) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'externalIds parameter is required' }
      }), { status: 400 });
    }

    const externalIds = externalIdsParam.split(',').filter(id => id.trim());
    
    if (externalIds.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        data: {}
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const statusMap = await db.userMedia.getUserMediaStatus(user.id, externalIds, mediaType || undefined);
      
      const response: ApiResponse = {
        success: true,
        data: statusMap
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (dbError) {
      console.error('Database error:', dbError);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch media status' }
      }), { status: 500 });
    }

  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }), { status: 500 });
  }
};