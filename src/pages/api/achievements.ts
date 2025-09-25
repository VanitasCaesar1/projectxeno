import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const category = url.searchParams.get('category');
    const unlocked = url.searchParams.get('unlocked');

    // Get user from session for private data
    const sessionCookie = cookies.get('sb-access-token');
    let currentUser = null;
    
    if (sessionCookie) {
      const { data: { user } } = await supabase.auth.getUser(sessionCookie.value);
      currentUser = user;
    }

    if (userId) {
      // Get user achievements
      let query = supabase
        .from('user_achievements')
        .select(`
          *,
          achievements (
            id,
            key,
            name,
            description,
            icon,
            category,
            points,
            rarity,
            requirements
          )
        `)
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false });

      if (category) {
        query = query.eq('achievements.category', category);
      }

      const { data: userAchievements, error } = await query;

      if (error) {
        console.error('Error fetching user achievements:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch user achievements'
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Calculate total points
      const totalPoints = userAchievements?.reduce((sum, ua) => sum + (ua.achievements?.points || 0), 0) || 0;

      // Get all achievements to show progress
      const { data: allAchievements } = await supabase
        .from('achievements')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true });

      return new Response(JSON.stringify({
        success: true,
        userAchievements: userAchievements || [],
        allAchievements: allAchievements || [],
        totalPoints,
        totalUnlocked: userAchievements?.length || 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } else {
      // Get all achievements (public data)
      let query = supabase
        .from('achievements')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true });

      if (category) {
        query = query.eq('category', category);
      }

      const { data: achievements, error } = await query;

      if (error) {
        console.error('Error fetching achievements:', error);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to fetch achievements'
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        achievements: achievements || []
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Error in achievements API:', error);
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
    const { activityType } = body;

    if (!activityType) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing activityType'
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check and award achievements using the database function
    const { error } = await supabase.rpc('check_and_award_achievements', {
      p_user_id: user.id,
      p_activity_type: activityType
    });

    if (error) {
      console.error('Error checking achievements:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to check achievements'
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in check achievements API:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};