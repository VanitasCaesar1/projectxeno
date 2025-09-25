import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Check authentication
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' }
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Set up Supabase session
    supabase.auth.setSession({
      access_token: accessToken.value,
      refresh_token: refreshToken.value,
    });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid session' }
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const body = await request.json();
    const { userId, action } = body;

    if (!userId || !action) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'User ID and action are required' }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!['follow', 'unfollow'].includes(action)) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Action must be "follow" or "unfollow"' }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Can't follow yourself
    if (userId === user.id) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Cannot follow yourself' }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if target user exists
    const { data: targetUser, error: userError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' }
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'follow') {
      // Check if already following
      const { data: existingFollow, error: checkError } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking follow status:', checkError);
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Error checking follow status' }
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (existingFollow) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Already following this user' }
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Create follow relationship
      const { error: followError } = await supabase
        .from('user_follows')
        .insert({
          follower_id: user.id,
          following_id: userId
        });

      if (followError) {
        console.error('Error creating follow relationship:', followError);
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Failed to follow user' }
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Create activity record
      const { error: activityError } = await supabase
        .from('user_activities')
        .insert({
          user_id: user.id,
          activity_type: 'followed_user',
          target_user_id: userId,
          metadata: {}
        });

      if (activityError) {
        console.error('Error creating activity record:', activityError);
        // Don't fail the request for activity logging errors
      }

    } else { // unfollow
      // Check if currently following
      const { data: existingFollow, error: checkError } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking follow status:', checkError);
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Error checking follow status' }
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!existingFollow) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Not following this user' }
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Remove follow relationship
      const { error: unfollowError } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', userId);

      if (unfollowError) {
        console.error('Error removing follow relationship:', unfollowError);
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Failed to unfollow user' }
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: { action, userId }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Follow/unfollow error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};