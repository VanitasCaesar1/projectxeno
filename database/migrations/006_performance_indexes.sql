-- Performance optimization indexes for media tracking platform
-- This migration adds additional indexes for frequently queried columns

-- Additional indexes for media_items table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_items_title_trgm ON media_items USING gin(title gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_items_genres ON media_items USING gin(genres);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_items_release_date ON media_items(release_date DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_items_type_rating ON media_items(media_type, average_rating DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_items_created_at ON media_items(created_at DESC);

-- Composite indexes for user_media queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_media_user_status_updated ON user_media(user_id, status, updated_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_media_media_rating ON user_media(media_id, rating DESC) WHERE rating IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_media_completed_date ON user_media(user_id, completed_at DESC) WHERE status = 'completed';

-- Indexes for reviews table performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_media_rating ON reviews(media_id, rating DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_user_created ON reviews(user_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reviews_popular ON reviews(like_count DESC, created_at DESC);

-- Indexes for activity feed performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activities_user_type_created ON user_activities(user_id, activity_type, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activities_media_created ON user_activities(media_id, created_at DESC) WHERE media_id IS NOT NULL;

-- Indexes for social features
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_follows_following_created ON user_follows(following_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_review_likes_review_created ON review_likes(review_id, created_at DESC);

-- Partial indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_media_public_completed ON user_media(user_id, completed_at DESC) 
WHERE status = 'completed' AND user_id IN (
    SELECT up.id FROM user_profiles up 
    JOIN user_preferences pref ON up.id = pref.user_id 
    WHERE up.privacy_level = 'public' AND pref.public_lists = true
);

-- Enable pg_trgm extension for fuzzy text search if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create materialized view for popular media (refreshed periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS popular_media AS
SELECT 
    mi.id,
    mi.external_id,
    mi.media_type,
    mi.title,
    mi.poster_url,
    mi.average_rating,
    mi.rating_count,
    COUNT(um.id) as list_count,
    COUNT(CASE WHEN um.status = 'completed' THEN 1 END) as completed_count
FROM media_items mi
LEFT JOIN user_media um ON mi.id = um.media_id
WHERE mi.rating_count >= 5 -- Only include items with at least 5 ratings
GROUP BY mi.id, mi.external_id, mi.media_type, mi.title, mi.poster_url, mi.average_rating, mi.rating_count
ORDER BY 
    (mi.average_rating * LOG(mi.rating_count + 1)) DESC, -- Weighted rating
    mi.rating_count DESC
LIMIT 1000;

-- Index on materialized view
CREATE INDEX IF NOT EXISTS idx_popular_media_type_rating ON popular_media(media_type, average_rating DESC);
CREATE INDEX IF NOT EXISTS idx_popular_media_list_count ON popular_media(list_count DESC);

-- Function to refresh popular media view (to be called periodically)
CREATE OR REPLACE FUNCTION refresh_popular_media()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY popular_media;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for efficient search with ranking
CREATE OR REPLACE FUNCTION search_media(
    search_query text,
    media_type_filter text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    external_id varchar,
    media_type varchar,
    title varchar,
    poster_url text,
    average_rating decimal,
    rating_count integer,
    rank real
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mi.id,
        mi.external_id,
        mi.media_type,
        mi.title,
        mi.poster_url,
        mi.average_rating,
        mi.rating_count,
        ts_rank(to_tsvector('english', mi.title), plainto_tsquery('english', search_query)) as rank
    FROM media_items mi
    WHERE 
        (media_type_filter IS NULL OR mi.media_type = media_type_filter)
        AND (
            to_tsvector('english', mi.title) @@ plainto_tsquery('english', search_query)
            OR mi.title ILIKE '%' || search_query || '%'
        )
    ORDER BY 
        rank DESC,
        mi.average_rating DESC NULLS LAST,
        mi.rating_count DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;