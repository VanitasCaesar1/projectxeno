import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ cookies }) => {
  try {
    // Get user from session
    const sessionCookie = cookies.get('sb-access-token');
    if (!sessionCookie) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Not authenticated'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(sessionCookie.value);
    if (userError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid session'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get user notification preferences
    const { data: preferences, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching notification preferences:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to fetch preferences'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Return default preferences if none exist
    const defaultPreferences = {
      user_id: user.id,
      email_notifications: true,
      push_notifications: true,
      likes_notifications: true,
      follows_notifications: true,
      reviews_notifications: true,
      achievements_notifications: true,
      system_notifications: true,
      email_frequency: 'immediate',
      digest_time: '09:00:00'
    };

    return new Response(JSON.stringify({
      success: true,
      preferences: preferences || defaultPreferences
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in get notification preferences API:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Get user from session
    const sessionCookie = cookies.get('sb-access-token');
    if (!sessionCookie) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Not authenticated'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(sessionCookie.value);
    if (userError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid session'
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    
    // Validate required fields
    const allowedFields = [
      'email_notifications',
      'push_notifications',
      'likes_notifications',
      'follows_notifications',
      'reviews_notifications',
      'achievements_notifications',
      'system_notifications',
      'email_frequency',
      'digest_time'
    ];

    const preferences = {};
    for (const field of allowedFields) {
      if (body.hasOwnProperty(field)) {
        preferences[field] = body[field];
      }
    }

    preferences.user_id = user.id;
    preferences.updated_at = new Date().toISOString();

    // Upsert notification preferences
    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert(preferences, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating notification preferences:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to update preferences'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      preferences: data
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in update notification preferences API:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};