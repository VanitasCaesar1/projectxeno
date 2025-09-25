import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import type { ReviewInsert, ReviewUpdate, Review } from '../../types/database';

// GET - Fetch reviews for a media item
export const GET: APIRoute = async ({ request, url }) => {
  try {
    const mediaId = url.searchParams.get('mediaId');
    const userId = url.searchParams.get('userId');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const sortBy = url.searchParams.get('sortBy') || 'created_at'; // created_at, like_count, rating
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    if (!mediaId && !userId) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'MISSING_PARAMS', message: 'Either mediaId or userId is required' }
      }), { status: 400 });
    }

    let query = supabase
      .from('reviews')
      .select(`
        *,
        user:user_profiles!reviews_user_id_fkey(
          id,
          username,
          display_name,
          avatar_url
        ),
        media:media_items!reviews_media_id_fkey(
          id,
          title,
          media_type,
          poster_url
        )
      `);

    // Filter by media or user
    if (mediaId) {
      query = query.eq('media_id', mediaId);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }

    // Apply sorting
    const validSortColumns = ['created_at', 'like_count', 'rating', 'updated_at'];
    if (validSortColumns.includes(sortBy)) {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: reviews, error, count } = await query;

    if (error) {
      console.error('Error fetching reviews:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch reviews' }
      }), { status: 500 });
    }

    // Get current user to check if they liked each review
    const authHeader = request.headers.get('Authorization');
    let currentUserId = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      currentUserId = user?.id;
    }

    // If we have a current user, check which reviews they've liked
    let reviewsWithLikeStatus = reviews;
    if (currentUserId && reviews?.length > 0) {
      const reviewIds = reviews.map(r => r.id);
      const { data: userLikes } = await supabase
        .from('review_likes')
        .select('review_id')
        .eq('user_id', currentUserId)
        .in('review_id', reviewIds);

      const likedReviewIds = new Set(userLikes?.map(like => like.review_id) || []);
      
      reviewsWithLikeStatus = reviews.map(review => ({
        ...review,
        isLikedByCurrentUser: likedReviewIds.has(review.id)
      }));
    }

    return new Response(JSON.stringify({
      success: true,
      data: reviewsWithLikeStatus,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }), { status: 200 });

  } catch (error) {
    console.error('Error in GET /api/reviews:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }), { status: 500 });
  }
};

// POST - Create a new review
export const POST: APIRoute = async ({ request }) => {
  try {
    // Get authenticated user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }), { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid authentication' }
      }), { status: 401 });
    }

    const body = await request.json();
    const { mediaId, mediaType, rating, title, content, spoilerWarning } = body;

    // Validation
    if (!mediaId || !content) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Media ID and content are required' }
      }), { status: 400 });
    }

    if (content.length < 10 || content.length > 2000) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Content must be between 10 and 2000 characters' }
      }), { status: 400 });
    }

    if (rating && (rating < 1 || rating > 10)) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Rating must be between 1 and 10' }
      }), { status: 400 });
    }

    if (title && title.length > 200) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Title must be 200 characters or less' }
      }), { status: 400 });
    }

    // Check if user has marked this media as consumed (requirement 4.6)
    const { data: userMedia } = await supabase
      .from('user_media')
      .select('status')
      .eq('user_id', user.id)
      .eq('media_id', mediaId)
      .single();

    if (!userMedia || userMedia.status !== 'completed') {
      return new Response(JSON.stringify({
        success: false,
        error: { 
          code: 'NOT_CONSUMED', 
          message: 'You can only review media that you have marked as completed' 
        }
      }), { status: 403 });
    }

    // Ensure media item exists
    const { data: mediaItem } = await supabase
      .from('media_items')
      .select('id')
      .eq('id', mediaId)
      .single();

    if (!mediaItem) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Media item not found' }
      }), { status: 404 });
    }

    // Create the review
    const reviewData: ReviewInsert = {
      user_id: user.id,
      media_id: mediaId,
      rating: rating || null,
      title: title || null,
      content: content.trim(),
      spoiler_warning: spoilerWarning || false
    };

    const { data: newReview, error: insertError } = await supabase
      .from('reviews')
      .insert(reviewData)
      .select(`
        *,
        user:user_profiles!reviews_user_id_fkey(
          id,
          username,
          display_name,
          avatar_url
        ),
        media:media_items!reviews_media_id_fkey(
          id,
          title,
          media_type,
          poster_url
        )
      `)
      .single();

    if (insertError) {
      console.error('Error creating review:', insertError);
      
      // Handle unique constraint violation (user already reviewed this media)
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'DUPLICATE_REVIEW', message: 'You have already reviewed this media item' }
        }), { status: 409 });
      }

      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to create review' }
      }), { status: 500 });
    }

    // Create activity record for review creation
    try {
      await supabase
        .from('user_activities')
        .insert({
          user_id: user.id,
          activity_type: 'review_created',
          media_id: mediaId,
          metadata: { 
            reviewId: newReview.id,
            rating: rating || null,
            hasContent: !!content
          }
        });
    } catch (activityError) {
      // Log but don't fail the request for activity errors
      console.error('Error creating review activity:', activityError);
    }

    return new Response(JSON.stringify({
      success: true,
      data: newReview
    }), { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/reviews:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }), { status: 500 });
  }
};

// PUT - Update an existing review
export const PUT: APIRoute = async ({ request }) => {
  try {
    // Get authenticated user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }), { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid authentication' }
      }), { status: 401 });
    }

    const body = await request.json();
    const { id, rating, title, content, spoilerWarning } = body;

    if (!id || !content) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Review ID and content are required' }
      }), { status: 400 });
    }

    // Validation (same as POST)
    if (content.length < 10 || content.length > 2000) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Content must be between 10 and 2000 characters' }
      }), { status: 400 });
    }

    if (rating && (rating < 1 || rating > 10)) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Rating must be between 1 and 10' }
      }), { status: 400 });
    }

    if (title && title.length > 200) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Title must be 200 characters or less' }
      }), { status: 400 });
    }

    // Update the review (RLS will ensure user can only update their own reviews)
    const updateData: ReviewUpdate = {
      rating: rating || null,
      title: title || null,
      content: content.trim(),
      spoiler_warning: spoilerWarning || false,
      updated_at: new Date().toISOString()
    };

    const { data: updatedReview, error: updateError } = await supabase
      .from('reviews')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user owns the review
      .select(`
        *,
        user:user_profiles!reviews_user_id_fkey(
          id,
          username,
          display_name,
          avatar_url
        ),
        media:media_items!reviews_media_id_fkey(
          id,
          title,
          media_type,
          poster_url
        )
      `)
      .single();

    if (updateError) {
      console.error('Error updating review:', updateError);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to update review' }
      }), { status: 500 });
    }

    if (!updatedReview) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Review not found or you do not have permission to edit it' }
      }), { status: 404 });
    }

    return new Response(JSON.stringify({
      success: true,
      data: updatedReview
    }), { status: 200 });

  } catch (error) {
    console.error('Error in PUT /api/reviews:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }), { status: 500 });
  }
};

// DELETE - Delete a review
export const DELETE: APIRoute = async ({ request }) => {
  try {
    // Get authenticated user
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }), { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid authentication' }
      }), { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Review ID is required' }
      }), { status: 400 });
    }

    // Delete the review (RLS will ensure user can only delete their own reviews)
    const { error: deleteError } = await supabase
      .from('reviews')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id); // Ensure user owns the review

    if (deleteError) {
      console.error('Error deleting review:', deleteError);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to delete review' }
      }), { status: 500 });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Review deleted successfully'
    }), { status: 200 });

  } catch (error) {
    console.error('Error in DELETE /api/reviews:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }), { status: 500 });
  }
};