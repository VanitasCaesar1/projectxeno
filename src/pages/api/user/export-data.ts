import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

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

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch profile data' }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch user preferences
    const { data: preferences, error: preferencesError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (preferencesError && preferencesError.code !== 'PGRST116') {
      console.error('Error fetching preferences:', preferencesError);
    }

    // Fetch user media lists with media details
    const { data: userMedia, error: mediaError } = await supabase
      .from('user_media')
      .select(`
        *,
        media_items (
          id,
          external_id,
          media_type,
          title,
          description,
          poster_url,
          release_date,
          genres,
          metadata
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (mediaError) {
      console.error('Error fetching user media:', mediaError);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch media lists' }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch user reviews with media details
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select(`
        *,
        media_items (
          id,
          external_id,
          media_type,
          title,
          description,
          poster_url,
          release_date,
          genres
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (reviewsError) {
      console.error('Error fetching reviews:', reviewsError);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch reviews' }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch review likes
    const { data: reviewLikes, error: likesError } = await supabase
      .from('review_likes')
      .select(`
        *,
        reviews (
          id,
          title,
          content,
          media_items (
            title,
            media_type
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (likesError) {
      console.error('Error fetching review likes:', likesError);
    }

    // Fetch user activities
    const { data: activities, error: activitiesError } = await supabase
      .from('user_activities')
      .select(`
        *,
        media_items (
          title,
          media_type
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100); // Limit to last 100 activities

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError);
    }

    // Fetch following/followers
    const { data: following, error: followingError } = await supabase
      .from('user_follows')
      .select(`
        *,
        user_profiles!user_follows_following_id_fkey (
          username,
          display_name
        )
      `)
      .eq('follower_id', user.id);

    const { data: followers, error: followersError } = await supabase
      .from('user_follows')
      .select(`
        *,
        user_profiles!user_follows_follower_id_fkey (
          username,
          display_name
        )
      `)
      .eq('following_id', user.id);

    if (followingError) {
      console.error('Error fetching following:', followingError);
    }
    if (followersError) {
      console.error('Error fetching followers:', followersError);
    }

    // Organize data by category
    const exportData = {
      export_info: {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        export_version: '1.0'
      },
      profile: {
        username: profile.username,
        display_name: profile.display_name,
        bio: profile.bio,
        privacy_level: profile.privacy_level,
        created_at: profile.created_at,
        updated_at: profile.updated_at
      },
      preferences: preferences || {
        email_notifications: true,
        public_lists: true,
        public_ratings: true,
        preferred_language: 'en'
      },
      media_lists: {
        total_items: userMedia?.length || 0,
        by_status: {
          completed: userMedia?.filter(item => item.status === 'completed') || [],
          watching: userMedia?.filter(item => item.status === 'watching') || [],
          plan_to_watch: userMedia?.filter(item => item.status === 'plan_to_watch') || [],
          dropped: userMedia?.filter(item => item.status === 'dropped') || []
        },
        by_media_type: {
          movies: userMedia?.filter(item => item.media_items?.media_type === 'movie') || [],
          tv_shows: userMedia?.filter(item => item.media_items?.media_type === 'tv') || [],
          anime: userMedia?.filter(item => item.media_items?.media_type === 'anime') || [],
          books: userMedia?.filter(item => item.media_items?.media_type === 'book') || []
        },
        all_items: userMedia || []
      },
      reviews_and_ratings: {
        total_reviews: reviews?.length || 0,
        reviews: reviews || [],
        average_rating: reviews?.length ? 
          reviews.reduce((sum, review) => sum + (review.rating || 0), 0) / reviews.length : 0,
        rating_distribution: reviews?.reduce((dist, review) => {
          if (review.rating) {
            dist[review.rating] = (dist[review.rating] || 0) + 1;
          }
          return dist;
        }, {} as Record<number, number>) || {}
      },
      social_activity: {
        review_likes: reviewLikes || [],
        recent_activities: activities || [],
        following: following || [],
        followers: followers || [],
        following_count: following?.length || 0,
        followers_count: followers?.length || 0
      },
      statistics: {
        total_media_items: userMedia?.length || 0,
        total_reviews: reviews?.length || 0,
        total_ratings: reviews?.filter(r => r.rating).length || 0,
        total_review_likes_given: reviewLikes?.length || 0,
        total_review_likes_received: reviews?.reduce((sum, review) => sum + review.like_count, 0) || 0,
        media_by_type: {
          movies: userMedia?.filter(item => item.media_items?.media_type === 'movie').length || 0,
          tv_shows: userMedia?.filter(item => item.media_items?.media_type === 'tv').length || 0,
          anime: userMedia?.filter(item => item.media_items?.media_type === 'anime').length || 0,
          books: userMedia?.filter(item => item.media_items?.media_type === 'book').length || 0
        },
        completion_stats: {
          completed: userMedia?.filter(item => item.status === 'completed').length || 0,
          watching: userMedia?.filter(item => item.status === 'watching').length || 0,
          plan_to_watch: userMedia?.filter(item => item.status === 'plan_to_watch').length || 0,
          dropped: userMedia?.filter(item => item.status === 'dropped').length || 0
        }
      }
    };

    // Return as downloadable JSON file
    const jsonString = JSON.stringify(exportData, null, 2);
    const filename = `media-tracker-export-${profile.username}-${new Date().toISOString().split('T')[0]}.json`;

    return new Response(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('Data export error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred during export' }
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};