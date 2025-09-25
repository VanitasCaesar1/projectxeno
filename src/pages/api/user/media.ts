import type { APIRoute } from 'astro';
import { supabase, getCurrentUser, db } from '../../../lib/supabase';
import type { MediaItemInsert, UserMediaInsert, UserMediaUpdate, ApiResponse } from '../../../types/database';

// GET /api/user/media - Get user's media lists
export const GET: APIRoute = async ({ request, url }) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }), { status: 401 });
    }

    const searchParams = url.searchParams;
    const status = searchParams.get('status');
    const mediaType = searchParams.get('mediaType');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Build query with proper joins
    let query = supabase
      .from('user_media')
      .select(`
        *,
        media:media_items!inner(*)
      `)
      .eq('user_id', user.id);

    if (status) {
      query = query.eq('status', status);
    }

    // Apply media type filter if specified
    if (mediaType) {
      query = query.eq('media.media_type', mediaType);
    }

    // Build count query with same filters
    let countQuery = supabase
      .from('user_media')
      .select('*, media:media_items!inner(*)', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (status) {
      countQuery = countQuery.eq('status', status);
    }

    if (mediaType) {
      countQuery = countQuery.eq('media.media_type', mediaType);
    }

    const { count } = await countQuery;

    // Get paginated results
    const { data: userMedia, error } = await query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Database error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to fetch user media' }
      }), { status: 500 });
    }

    const response: ApiResponse = {
      success: true,
      data: userMedia,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }), { status: 500 });
  }
};

// POST /api/user/media - Add or update media in user's list
export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }), { status: 401 });
    }

    const body = await request.json();
    const {
      mediaId,
      mediaType,
      status,
      rating,
      review,
      progress,
      // Media creation data (for new media items)
      externalId,
      title,
      description,
      posterUrl,
      releaseDate,
      genres,
      metadata
    } = body;

    // Validate required fields
    if (!status) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Status is required' }
      }), { status: 400 });
    }

    let finalMediaId = mediaId;

    // If no mediaId provided, we need to create or find the media item
    if (!mediaId && externalId && mediaType && title) {
      // Check if media item already exists
      const { data: existingMedia } = await supabase
        .from('media_items')
        .select('id')
        .eq('external_id', externalId)
        .eq('media_type', mediaType)
        .single();

      if (existingMedia) {
        finalMediaId = existingMedia.id;
      } else {
        // Create new media item
        const mediaData: MediaItemInsert = {
          external_id: externalId,
          media_type: mediaType,
          title,
          description: description || null,
          poster_url: posterUrl || null,
          release_date: releaseDate || null,
          genres: genres || [],
          metadata: metadata || {}
        };

        const { data: newMedia, error: mediaError } = await supabase
          .from('media_items')
          .insert(mediaData)
          .select('id')
          .single();

        if (mediaError) {
          console.error('Error creating media item:', mediaError);
          return new Response(JSON.stringify({
            success: false,
            error: { code: 'DATABASE_ERROR', message: 'Failed to create media item' }
          }), { status: 500 });
        }

        finalMediaId = newMedia.id;
      }
    }

    if (!finalMediaId) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Media ID or media creation data required' }
      }), { status: 400 });
    }

    // Prepare user media data
    const userMediaData: UserMediaInsert = {
      user_id: user.id,
      media_id: finalMediaId,
      status,
      rating: rating || null,
      review: review || null,
      progress: progress || 0
    };

    // Set timestamps based on status
    const now = new Date().toISOString();
    if (status === 'watching' || status === 'reading') {
      userMediaData.started_at = now;
    } else if (status === 'completed') {
      userMediaData.completed_at = now;
      if (!userMediaData.started_at) {
        userMediaData.started_at = now;
      }
    }

    // Upsert user media record
    const { data: userMedia, error: userMediaError } = await supabase
      .from('user_media')
      .upsert(userMediaData, {
        onConflict: 'user_id,media_id'
      })
      .select(`
        *,
        media:media_items(*)
      `)
      .single();

    if (userMediaError) {
      console.error('Error updating user media:', userMediaError);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to update user media' }
      }), { status: 500 });
    }

    // Create activity record
    try {
      await supabase
        .from('user_activities')
        .insert({
          user_id: user.id,
          activity_type: 'media_added',
          media_id: finalMediaId,
          metadata: { status, previous_status: null }
        });
    } catch (activityError) {
      // Log but don't fail the request for activity errors
      console.error('Error creating activity:', activityError);
    }

    const response: ApiResponse = {
      success: true,
      data: userMedia
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }), { status: 500 });
  }
};

// PUT /api/user/media - Update existing media in user's list
export const PUT: APIRoute = async ({ request }) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }), { status: 401 });
    }

    const body = await request.json();
    const {
      mediaId,
      status,
      rating,
      review,
      progress
    } = body;

    if (!mediaId) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Media ID is required' }
      }), { status: 400 });
    }

    // Get current user media record
    const { data: currentUserMedia } = await supabase
      .from('user_media')
      .select('*')
      .eq('user_id', user.id)
      .eq('media_id', mediaId)
      .single();

    if (!currentUserMedia) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Media not found in user list' }
      }), { status: 404 });
    }

    // Prepare update data
    const updateData: UserMediaUpdate = {
      updated_at: new Date().toISOString()
    };

    if (status !== undefined) updateData.status = status;
    if (rating !== undefined) updateData.rating = rating;
    if (review !== undefined) updateData.review = review;
    if (progress !== undefined) updateData.progress = progress;

    // Handle status-specific timestamps
    if (status) {
      const now = new Date().toISOString();
      if (status === 'watching' || status === 'reading') {
        if (!currentUserMedia.started_at) {
          updateData.started_at = now;
        }
      } else if (status === 'completed') {
        updateData.completed_at = now;
        if (!currentUserMedia.started_at) {
          updateData.started_at = now;
        }
      }
    }

    // Update user media record
    const { data: updatedUserMedia, error } = await supabase
      .from('user_media')
      .update(updateData)
      .eq('user_id', user.id)
      .eq('media_id', mediaId)
      .select(`
        *,
        media:media_items(*)
      `)
      .single();

    if (error) {
      console.error('Error updating user media:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to update user media' }
      }), { status: 500 });
    }

    // Create activity record for status changes
    if (status && status !== currentUserMedia.status) {
      try {
        let activityType = 'media_status_updated';
        if (status === 'completed') {
          activityType = 'media_completed';
        }
        
        await supabase
          .from('user_activities')
          .insert({
            user_id: user.id,
            activity_type: activityType,
            media_id: mediaId,
            metadata: { 
              status, 
              previous_status: currentUserMedia.status,
              newStatus: status
            }
          });
      } catch (activityError) {
        console.error('Error creating activity:', activityError);
      }
    }

    const response: ApiResponse = {
      success: true,
      data: updatedUserMedia
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }), { status: 500 });
  }
};

// DELETE /api/user/media - Remove media from user's list
export const DELETE: APIRoute = async ({ request }) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      }), { status: 401 });
    }

    const body = await request.json();
    const { mediaId } = body;

    if (!mediaId) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Media ID is required' }
      }), { status: 400 });
    }

    // Check if the record exists
    const { data: existingRecord } = await supabase
      .from('user_media')
      .select('*')
      .eq('user_id', user.id)
      .eq('media_id', mediaId)
      .single();

    if (!existingRecord) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Media not found in user list' }
      }), { status: 404 });
    }

    // Delete the user media record
    const { error } = await supabase
      .from('user_media')
      .delete()
      .eq('user_id', user.id)
      .eq('media_id', mediaId);

    if (error) {
      console.error('Error deleting user media:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to remove media from list' }
      }), { status: 500 });
    }

    const response: ApiResponse = {
      success: true,
      data: { message: 'Media removed from list successfully' }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
    }), { status: 500 });
  }
};