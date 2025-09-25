import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

// GET - Fetch user activities (activity feed)
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
    const userId = url.searchParams.get('userId') || user.id;
    const feedType = url.searchParams.get('feedType') || 'personal'; // 'personal', 'following', 'all'
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);

    let query = supabase
      .from('user_activities')
      .select(`
        *,
        user:user_profiles!user_activities_user_id_fkey(
          id,
          username,
          display_name,
          avatar_url
        ),
        media:media_items!user_activities_media_id_fkey(
          id,
          title,
          media_type,
          poster_url
        )
      `);

    // Apply filters based on feed type
    if (feedType === 'personal') {
      // Only current user's activities
      query = query.eq('user_id', userId);
    } else if (feedType === 'following') {
      // Activities from users the current user follows + their own
      const { data: followingUsers } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = followingUsers?.map(f => f.following_id) || [];
      followingIds.push(user.id); // Include own activities

      query = query.in('user_id', followingIds);
    }
    // For 'all' feedType, no additional filtering is applied

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: activities, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching activities:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch activities' }
      }), { status: 500 });
    }

    return new Response(JSON.stringify({
      success: true,
      data: activities || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }), { status: 200 });

  } catch (error) {
    console.error('Error in GET /api/user/activities:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }), { status: 500 });
  }
};

// POST - Create a new activity (for tracking user actions)
export const POST: APIRoute = async ({ request, cookies }) => {
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

    const body = await request.json();
    const { activityType, mediaId, metadata } = body;

    // Validate required fields
    if (!activityType) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Activity type is required' }
      }), { status: 400 });
    }

    // Validate activity type
    const validActivityTypes = [
      'media_added',
      'media_completed',
      'media_rated',
      'review_created',
      'review_liked',
      'user_followed'
    ];

    if (!validActivityTypes.includes(activityType)) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid activity type' }
      }), { status: 400 });
    }

    // Create the activity
    const activityData = {
      user_id: user.id,
      activity_type: activityType,
      media_id: mediaId || null,
      metadata: metadata || {}
    };

    const { data: newActivity, error: insertError } = await supabase
      .from('user_activities')
      .insert(activityData)
      .select(`
        *,
        user:user_profiles!user_activities_user_id_fkey(
          id,
          username,
          display_name,
          avatar_url
        ),
        media:media_items!user_activities_media_id_fkey(
          id,
          title,
          media_type,
          poster_url
        )
      `)
      .single();

    if (insertError) {
      console.error('Error creating activity:', insertError);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to create activity' }
      }), { status: 500 });
    }

    return new Response(JSON.stringify({
      success: true,
      data: newActivity
    }), { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/user/activities:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }), { status: 500 });
  }
};