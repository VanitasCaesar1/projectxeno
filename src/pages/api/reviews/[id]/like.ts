import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

// POST - Like a review
export const POST: APIRoute = async ({ params, cookies }) => {
  try {
    const reviewId = params.id;
    
    if (!reviewId) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'MISSING_PARAMS', message: 'Review ID is required' }
      }), { status: 400 });
    }

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

    // Check if review exists
    const { data: review } = await supabase
      .from('reviews')
      .select('id, user_id')
      .eq('id', reviewId)
      .single();

    if (!review) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Review not found' }
      }), { status: 404 });
    }

    // Prevent users from liking their own reviews
    if (review.user_id === user.id) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'INVALID_ACTION', message: 'You cannot like your own review' }
      }), { status: 400 });
    }

    // Check if user already liked this review
    const { data: existingLike } = await supabase
      .from('review_likes')
      .select('id')
      .eq('user_id', user.id)
      .eq('review_id', reviewId)
      .single();

    if (existingLike) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'ALREADY_LIKED', message: 'You have already liked this review' }
      }), { status: 409 });
    }

    // Create the like
    const { error: insertError } = await supabase
      .from('review_likes')
      .insert({
        user_id: user.id,
        review_id: reviewId
      });

    if (insertError) {
      console.error('Error creating review like:', insertError);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to like review' }
      }), { status: 500 });
    }

    // Get updated like count
    const { data: updatedReview } = await supabase
      .from('reviews')
      .select('like_count')
      .eq('id', reviewId)
      .single();

    // Create activity record for review like
    try {
      const { data: reviewData } = await supabase
        .from('reviews')
        .select(`
          media_id,
          user:user_profiles!reviews_user_id_fkey(username, display_name)
        `)
        .eq('id', reviewId)
        .single();

      if (reviewData) {
        await supabase
          .from('user_activities')
          .insert({
            user_id: user.id,
            activity_type: 'review_liked',
            media_id: reviewData.media_id,
            metadata: { 
              reviewId: reviewId,
              reviewUser: reviewData.user?.display_name || reviewData.user?.username
            }
          });
      }
    } catch (activityError) {
      // Log but don't fail the request for activity errors
      console.error('Error creating like activity:', activityError);
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        liked: true,
        likeCount: updatedReview?.like_count || 0
      }
    }), { status: 200 });

  } catch (error) {
    console.error('Error in POST /api/reviews/[id]/like:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }), { status: 500 });
  }
};

// DELETE - Unlike a review
export const DELETE: APIRoute = async ({ params, cookies }) => {
  try {
    const reviewId = params.id;
    
    if (!reviewId) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'MISSING_PARAMS', message: 'Review ID is required' }
      }), { status: 400 });
    }

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

    // Delete the like
    const { error: deleteError } = await supabase
      .from('review_likes')
      .delete()
      .eq('user_id', user.id)
      .eq('review_id', reviewId);

    if (deleteError) {
      console.error('Error deleting review like:', deleteError);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to unlike review' }
      }), { status: 500 });
    }

    // Get updated like count
    const { data: updatedReview } = await supabase
      .from('reviews')
      .select('like_count')
      .eq('id', reviewId)
      .single();

    return new Response(JSON.stringify({
      success: true,
      data: {
        liked: false,
        likeCount: updatedReview?.like_count || 0
      }
    }), { status: 200 });

  } catch (error) {
    console.error('Error in DELETE /api/reviews/[id]/like:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }), { status: 500 });
  }
};