import type { APIRoute } from 'astro';
import { getCurrentUser } from '../../../lib/supabase';
import { calculateUserStats } from '../../../lib/userStats';
import type { ApiResponse } from '../../../types/database';

export const GET: APIRoute = async ({ request }) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }), { status: 401 });
    }

    // Calculate comprehensive user statistics
    const stats = await calculateUserStats(user.id);

    const response: ApiResponse = {
      success: true,
      data: stats
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }), { status: 500 });
  }
};