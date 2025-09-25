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
    const { 
      privacyLevel, 
      publicLists, 
      publicRatings, 
      publicActivity,
      emailNotifications, 
      preferredLanguage 
    } = body;

    // Update profile privacy level if provided
    if (privacyLevel) {
      const validPrivacyLevels = ['public', 'private', 'friends'];
      if (!validPrivacyLevels.includes(privacyLevel)) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid privacy level' }
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          privacy_level: privacyLevel,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) {
        console.error('Error updating profile privacy:', profileError);
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Failed to update privacy settings' }
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Prepare preferences update data
    const preferencesUpdate: any = {
      updated_at: new Date().toISOString()
    };

    if (typeof publicLists === 'boolean') {
      preferencesUpdate.public_lists = publicLists;
    }

    if (typeof publicRatings === 'boolean') {
      preferencesUpdate.public_ratings = publicRatings;
    }

    if (typeof publicActivity === 'boolean') {
      preferencesUpdate.public_activity = publicActivity;
    }

    if (typeof emailNotifications === 'boolean') {
      preferencesUpdate.email_notifications = emailNotifications;
    }

    if (preferredLanguage) {
      const validLanguages = ['en', 'es', 'fr', 'de', 'ja'];
      if (!validLanguages.includes(preferredLanguage)) {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid preferred language' }
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      preferencesUpdate.preferred_language = preferredLanguage;
    }

    // Update user preferences (upsert in case preferences don't exist yet)
    const { data: updatedPreferences, error: preferencesError } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: user.id,
        ...preferencesUpdate
      })
      .select()
      .single();

    if (preferencesError) {
      console.error('Error updating preferences:', preferencesError);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to update preferences' }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: updatedPreferences
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Preferences update error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const GET: APIRoute = async ({ cookies }) => {
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

    // Get user preferences
    const { data: preferences, error: preferencesError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (preferencesError && preferencesError.code !== 'PGRST116') {
      console.error('Error fetching preferences:', preferencesError);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch preferences' }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // If no preferences exist, return defaults
    const defaultPreferences = {
      user_id: user.id,
      email_notifications: true,
      public_lists: true,
      public_ratings: true,
      public_activity: true,
      preferred_language: 'en',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return new Response(JSON.stringify({
      success: true,
      data: preferences || defaultPreferences
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Preferences fetch error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};