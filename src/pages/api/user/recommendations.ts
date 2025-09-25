import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { getRecommendations, getTrendingMedia } from '../../../lib/userStats';

// GET - Fetch personalized recommendations for the user
export const GET: APIRoute = async ({ url, cookies }) => {
  try {
    // Check authentication
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }), { status: 401 });
    }

    // Set up Supabase session
    supabase.auth.setSession({
      access_token: accessToken.value,
      refresh_token: refreshToken.value,
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid authentication' }
      }), { status: 401 });
    }

    // Get query parameters
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
    const type = url.searchParams.get('type') || 'personalized'; // 'personalized' or 'trending'

    let recommendations;

    if (type === 'trending') {
      recommendations = await getTrendingMedia(limit);
    } else {
      recommendations = await getRecommendations(user.id, limit);
    }

    return new Response(JSON.stringify({
      success: true,
      data: recommendations,
      type: type
    }), { status: 200 });

  } catch (error) {
    console.error('Error in GET /api/user/recommendations:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }), { status: 500 });
  }
};