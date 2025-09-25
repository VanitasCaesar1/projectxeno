-- Migration: Create search features tables
-- Description: Add tables for saved searches, search history, and advanced filtering

-- Create saved searches table
CREATE TABLE saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    query VARCHAR(500) NOT NULL,
    filters JSONB DEFAULT '{}',
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Create search history table
CREATE TABLE search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    query VARCHAR(500) NOT NULL,
    filters JSONB DEFAULT '{}',
    results_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create search suggestions table (for popular/trending searches)
CREATE TABLE search_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query VARCHAR(500) NOT NULL UNIQUE,
    search_count INTEGER DEFAULT 1,
    last_searched TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX idx_saved_searches_public ON saved_searches(is_public) WHERE is_public = true;
CREATE INDEX idx_search_history_user_id ON search_history(user_id);
CREATE INDEX idx_search_history_created_at ON search_history(created_at DESC);
CREATE INDEX idx_search_suggestions_query ON search_suggestions(query);
CREATE INDEX idx_search_suggestions_count ON search_suggestions(search_count DESC);
CREATE INDEX idx_search_suggestions_last_searched ON search_suggestions(last_searched DESC);

-- Add indexes to media_items for advanced filtering
CREATE INDEX idx_media_items_media_type ON media_items(media_type);
CREATE INDEX idx_media_items_release_date ON media_items(release_date);
CREATE INDEX idx_media_items_average_rating ON media_items(average_rating DESC);
CREATE INDEX idx_media_items_genres ON media_items USING GIN(genres);
CREATE INDEX idx_media_items_title_search ON media_items USING GIN(to_tsvector('english', title));

-- Add indexes to user_media for filtering by status
CREATE INDEX idx_user_media_status ON user_media(status);
CREATE INDEX idx_user_media_rating ON user_media(rating DESC) WHERE rating IS NOT NULL;
CREATE INDEX idx_user_media_user_status ON user_media(user_id, status);

-- Row Level Security policies
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_suggestions ENABLE ROW LEVEL SECURITY;

-- Saved searches policies
CREATE POLICY "Users can view their own saved searches" ON saved_searches
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view public saved searches" ON saved_searches
    FOR SELECT USING (is_public = true);

CREATE POLICY "Users can create their own saved searches" ON saved_searches
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved searches" ON saved_searches
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved searches" ON saved_searches
    FOR DELETE USING (auth.uid() = user_id);

-- Search history policies
CREATE POLICY "Users can view their own search history" ON search_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own search history" ON search_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own search history" ON search_history
    FOR DELETE USING (auth.uid() = user_id);

-- Search suggestions policies (read-only for users, admin-managed)
CREATE POLICY "Anyone can view search suggestions" ON search_suggestions
    FOR SELECT TO authenticated USING (true);

-- Function to update search suggestions
CREATE OR REPLACE FUNCTION update_search_suggestions(search_query TEXT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO search_suggestions (query, search_count, last_searched, updated_at)
    VALUES (search_query, 1, NOW(), NOW())
    ON CONFLICT (query) 
    DO UPDATE SET 
        search_count = search_suggestions.search_count + 1,
        last_searched = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean old search history (keep last 100 per user)
CREATE OR REPLACE FUNCTION cleanup_search_history()
RETURNS VOID AS $$
BEGIN
    DELETE FROM search_history 
    WHERE id IN (
        SELECT id FROM (
            SELECT id, 
                   ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
            FROM search_history
        ) ranked
        WHERE rn > 100
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update search suggestions
CREATE OR REPLACE FUNCTION trigger_update_search_suggestions()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM update_search_suggestions(NEW.query);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_suggestions_on_search
    AFTER INSERT ON search_history
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_search_suggestions();

-- Comments for documentation
COMMENT ON TABLE saved_searches IS 'User-created saved search queries with filters';
COMMENT ON TABLE search_history IS 'History of user search queries for suggestions and analytics';
COMMENT ON TABLE search_suggestions IS 'Popular search queries for autocomplete suggestions';
COMMENT ON FUNCTION update_search_suggestions IS 'Updates search suggestion popularity counts';
COMMENT ON FUNCTION cleanup_search_history IS 'Maintains search history size per user';