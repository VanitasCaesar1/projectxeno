import { supabase } from './supabase';
import type { UserStats, MediaType, UserMediaStatus } from '../types/database';

/**
 * Calculate comprehensive user statistics
 */
export async function calculateUserStats(userId: string): Promise<UserStats> {
  try {
    // Get all user media entries
    const { data: userMedia, error: mediaError } = await supabase
      .from('user_media')
      .select(`
        status,
        rating,
        media:media_items(media_type)
      `)
      .eq('user_id', userId);

    if (mediaError) {
      console.error('Error fetching user media:', mediaError);
      return getEmptyStats();
    }

    // Get user reviews count
    const { count: reviewsCount, error: reviewsError } = await supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (reviewsError) {
      console.error('Error fetching reviews count:', reviewsError);
    }

    // Get total likes received on user's reviews
    const { data: likesData, error: likesError } = await supabase
      .from('review_likes')
      .select('id')
      .in('review_id', 
        supabase
          .from('reviews')
          .select('id')
          .eq('user_id', userId)
      );

    if (likesError) {
      console.error('Error fetching likes count:', likesError);
    }

    // Get follower/following counts
    const [
      { count: followersCount, error: followersError },
      { count: followingCount, error: followingError }
    ] = await Promise.all([
      supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId),
      supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId)
    ]);

    if (followersError) {
      console.error('Error fetching followers count:', followersError);
    }
    if (followingError) {
      console.error('Error fetching following count:', followingError);
    }

    // Calculate statistics
    const totalItems = userMedia?.length || 0;
    const completedItems = userMedia?.filter(item => item.status === 'completed').length || 0;
    
    // Calculate average rating (only for items with ratings)
    const ratedItems = userMedia?.filter(item => item.rating !== null) || [];
    const averageRating = ratedItems.length > 0 
      ? ratedItems.reduce((sum, item) => sum + (item.rating || 0), 0) / ratedItems.length
      : 0;

    // Media type breakdown
    const mediaTypeBreakdown: Record<MediaType, number> = {
      movie: 0,
      tv: 0,
      book: 0,
      anime: 0
    };

    userMedia?.forEach(item => {
      const mediaType = item.media?.media_type as MediaType;
      if (mediaType && mediaTypeBreakdown.hasOwnProperty(mediaType)) {
        mediaTypeBreakdown[mediaType]++;
      }
    });

    // Status breakdown
    const statusBreakdown: Record<UserMediaStatus, number> = {
      completed: 0,
      watching: 0,
      plan_to_watch: 0,
      dropped: 0,
      on_hold: 0
    };

    userMedia?.forEach(item => {
      const status = item.status as UserMediaStatus;
      if (status && statusBreakdown.hasOwnProperty(status)) {
        statusBreakdown[status]++;
      }
    });

    return {
      totalItems,
      completedItems,
      averageRating,
      totalReviews: reviewsCount || 0,
      totalLikes: likesData?.length || 0,
      followers: followersCount || 0,
      following: followingCount || 0,
      mediaTypeBreakdown,
      statusBreakdown
    };

  } catch (error) {
    console.error('Error calculating user stats:', error);
    return getEmptyStats();
  }
}

/**
 * Get empty stats object for error cases
 */
function getEmptyStats(): UserStats {
  return {
    totalItems: 0,
    completedItems: 0,
    averageRating: 0,
    totalReviews: 0,
    totalLikes: 0,
    followers: 0,
    following: 0,
    mediaTypeBreakdown: {
      movie: 0,
      tv: 0,
      book: 0,
      anime: 0
    },
    statusBreakdown: {
      completed: 0,
      watching: 0,
      plan_to_watch: 0,
      dropped: 0,
      on_hold: 0
    }
  };
}

/**
 * Get user activity summary for dashboard
 */
export async function getUserActivitySummary(userId: string, limit: number = 10) {
  try {
    const { data: activities, error } = await supabase
      .from('user_activities')
      .select(`
        *,
        media:media_items(title, media_type, poster_url),
        target_user:user_profiles!user_activities_target_user_id_fkey(username, display_name),
        review:reviews(title, content)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching user activities:', error);
      return [];
    }

    return activities || [];
  } catch (error) {
    console.error('Error fetching user activity summary:', error);
    return [];
  }
}

/**
 * Check if current user is following another user
 */
export async function isFollowingUser(currentUserId: string, targetUserId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', currentUserId)
      .eq('following_id', targetUserId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error('Error checking follow status:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking follow status:', error);
    return false;
  }
}

/**
 * Get user's recent media activity for activity feed
 */
export async function getRecentMediaActivity(userId: string, limit: number = 20) {
  try {
    const { data: recentActivity, error } = await supabase
      .from('user_media')
      .select(`
        *,
        media:media_items(title, media_type, poster_url, release_date)
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent media activity:', error);
      return [];
    }

    return recentActivity || [];
  } catch (error) {
    console.error('Error fetching recent media activity:', error);
    return [];
  }
}

/**
 * Get user's top rated media
 */
export async function getTopRatedMedia(userId: string, limit: number = 10) {
  try {
    const { data: topRated, error } = await supabase
      .from('user_media')
      .select(`
        rating,
        review,
        completed_at,
        media:media_items(title, media_type, poster_url, release_date)
      `)
      .eq('user_id', userId)
      .not('rating', 'is', null)
      .order('rating', { ascending: false })
      .order('completed_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching top rated media:', error);
      return [];
    }

    return topRated || [];
  } catch (error) {
    console.error('Error fetching top rated media:', error);
    return [];
  }
}

/**
 * Get media recommendations based on user's ratings and preferences
 */
export async function getRecommendations(userId: string, limit: number = 10) {
  try {
    // Get user's media with ratings to understand preferences
    const { data: userRatings, error: ratingsError } = await supabase
      .from('user_media')
      .select(`
        rating,
        status,
        media:media_items(id, genres, media_type, average_rating, rating_count)
      `)
      .eq('user_id', userId);

    if (ratingsError) {
      console.error('Error fetching user ratings for recommendations:', ratingsError);
      return [];
    }

    // Get media user hasn't added to their list yet
    const userMediaIds = userRatings?.map(item => item.media?.id).filter(Boolean) || [];

    // If user has no media, return popular items across all types
    if (userRatings?.length === 0) {
      const { data: popularMedia, error: popularError } = await supabase
        .from('media_items')
        .select('*')
        .gte('average_rating', 7.0)
        .gte('rating_count', 50)
        .order('rating_count', { ascending: false })
        .limit(limit);

      if (popularError) {
        console.error('Error fetching popular media:', popularError);
        return [];
      }

      return popularMedia || [];
    }

    // Extract user preferences from their ratings
    const preferredGenres = new Map<string, number>();
    const preferredTypes = new Map<string, number>();
    let totalRatedItems = 0;
    let totalRatingSum = 0;

    userRatings?.forEach(item => {
      if (item.rating && item.media) {
        totalRatedItems++;
        totalRatingSum += item.rating;

        // Weight genres by rating (higher rated items contribute more)
        const weight = item.rating / 10; // Normalize to 0-1
        
        if (item.media.genres) {
          item.media.genres.forEach(genre => {
            preferredGenres.set(genre, (preferredGenres.get(genre) || 0) + weight);
          });
        }

        if (item.media.media_type) {
          preferredTypes.set(item.media.media_type, (preferredTypes.get(item.media.media_type) || 0) + weight);
        }
      }
    });

    const userAverageRating = totalRatedItems > 0 ? totalRatingSum / totalRatedItems : 7;

    // Get top preferred genres and types
    const topGenres = Array.from(preferredGenres.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre]) => genre);

    const topTypes = Array.from(preferredTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);

    // Build query for recommendations
    let query = supabase
      .from('media_items')
      .select('*')
      .gte('average_rating', Math.max(userAverageRating - 1, 6.0)) // Slightly below user's average
      .gte('rating_count', 10); // Ensure some popularity

    // Exclude user's media
    if (userMediaIds.length > 0) {
      query = query.not('id', 'in', `(${userMediaIds.join(',')})`);
    }

    const { data: candidateMedia, error: candidateError } = await query
      .order('average_rating', { ascending: false })
      .limit(limit * 3); // Get more candidates to filter

    if (candidateError) {
      console.error('Error fetching candidate media:', candidateError);
      return [];
    }

    if (!candidateMedia || candidateMedia.length === 0) {
      return [];
    }

    // Score each candidate based on user preferences
    const scoredMedia = candidateMedia.map(item => {
      let score = item.average_rating || 0;

      // Boost score for preferred genres
      if (item.genres && topGenres.length > 0) {
        const genreMatches = item.genres.filter(genre => topGenres.includes(genre)).length;
        score += genreMatches * 0.5; // Boost for each matching genre
      }

      // Boost score for preferred media types
      if (item.media_type && topTypes.includes(item.media_type)) {
        score += 1.0; // Significant boost for preferred type
      }

      // Boost for popularity (but not too much)
      const popularityBoost = Math.min((item.rating_count || 0) / 1000, 0.5);
      score += popularityBoost;

      return {
        ...item,
        recommendationScore: score
      };
    });

    // Sort by recommendation score and return top results
    const recommendations = scoredMedia
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, limit);

    return recommendations;

  } catch (error) {
    console.error('Error getting recommendations:', error);
    return [];
  }
}

/**
 * Get trending media based on recent activity
 */
export async function getTrendingMedia(limit: number = 10) {
  try {
    // Get media that has been recently added to lists or rated
    const { data: recentActivity, error } = await supabase
      .from('user_activities')
      .select(`
        media_id,
        created_at,
        media:media_items(*)
      `)
      .in('activity_type', ['media_added', 'media_rated', 'review_created'])
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .not('media_id', 'is', null);

    if (error) {
      console.error('Error fetching trending media:', error);
      return [];
    }

    // Count occurrences of each media item
    const mediaCounts = new Map<string, { count: number; media: any }>();
    
    recentActivity?.forEach(activity => {
      if (activity.media_id && activity.media) {
        const existing = mediaCounts.get(activity.media_id);
        if (existing) {
          existing.count++;
        } else {
          mediaCounts.set(activity.media_id, {
            count: 1,
            media: activity.media
          });
        }
      }
    });

    // Sort by count and return top items
    const trending = Array.from(mediaCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(item => item.media);

    return trending;
  } catch (error) {
    console.error('Error getting trending media:', error);
    return [];
  }
}