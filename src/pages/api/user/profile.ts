import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const PUT: APIRoute = async ({ request, cookies }) => {
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
    const { username, displayName, bio, avatarUrl } = body;

    // Validate required fields
    if (!username || username.trim().length < 3) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Username must be at least 3 characters long' }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Username can only contain letters, numbers, and underscores' }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if username is already taken (excluding current user)
    const { data: existingUser, error: checkError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('username', username.trim())
      .neq('id', user.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking username availability:', checkError);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Error checking username availability' }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (existingUser) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Username is already taken' }
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate avatar URL if provided
    if (avatarUrl && avatarUrl.trim()) {
      try {
        new URL(avatarUrl.trim());
      } catch {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid avatar URL format' }
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Update user profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('user_profiles')
      .update({
        username: username.trim(),
        display_name: displayName?.trim() || null,
        bio: bio?.trim() || null,
        avatar_url: avatarUrl?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating profile:', updateError);
      
      // Handle unique constraint violation
      if (updateError.code === '23505') {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Username is already taken' }
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to update profile' }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: updatedProfile
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async ({ url, cookies }) => {
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

    // Get user ID from URL params or use current user
    const userId = url.searchParams.get('userId') || user.id;

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Profile not found' }
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check privacy settings if viewing another user's profile
    if (userId !== user.id && profile.privacy_level === 'private') {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'FORBIDDEN', message: 'This profile is private' }
      }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // If viewing another user's profile and it's friends-only, check if following
    if (userId !== user.id && profile.privacy_level === 'friends') {
      const { data: followData, error: followError } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .single();

      if (followError && followError.code !== 'PGRST116') {
        console.error('Error checking follow status:', followError);
      }

      if (!followData) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'FORBIDDEN', message: 'This profile is only visible to friends' }
        }), { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: profile
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};