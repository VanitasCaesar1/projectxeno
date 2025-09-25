-- Unified media items table
CREATE TABLE media_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(100) NOT NULL,
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('movie', 'tv', 'book', 'anime')),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    poster_url TEXT,
    release_date DATE,
    genres TEXT[],
    metadata JSONB DEFAULT '{}',
    average_rating DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(external_id, media_type)
);

-- User media lists and status
CREATE TABLE user_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    media_id UUID REFERENCES media_items(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('completed', 'watching', 'plan_to_watch', 'dropped', 'on_hold')),
    rating INTEGER CHECK (rating >= 1 AND rating <= 10),
    review TEXT,
    progress INTEGER DEFAULT 0, -- episodes watched, pages read, etc.
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, media_id)
);

-- Create indexes for performance
CREATE INDEX idx_media_items_type ON media_items(media_type);
CREATE INDEX idx_media_items_title ON media_items USING gin(to_tsvector('english', title));
CREATE INDEX idx_media_items_external_id ON media_items(external_id, media_type);
CREATE INDEX idx_media_items_rating ON media_items(average_rating DESC);

CREATE INDEX idx_user_media_user_id ON user_media(user_id);
CREATE INDEX idx_user_media_status ON user_media(user_id, status);
CREATE INDEX idx_user_media_rating ON user_media(user_id, rating DESC);
CREATE INDEX idx_user_media_updated ON user_media(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE media_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_media ENABLE ROW LEVEL SECURITY;

-- RLS Policies for media_items (public read access)
CREATE POLICY "Anyone can view media items" ON media_items
    FOR SELECT USING (true);

CREATE POLICY "Only authenticated users can insert media items" ON media_items
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Only authenticated users can update media items" ON media_items
    FOR UPDATE TO authenticated USING (true);

-- RLS Policies for user_media
CREATE POLICY "Users can view their own media lists" ON user_media
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view public media lists" ON user_media
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            JOIN user_preferences pref ON up.id = pref.user_id
            WHERE up.id = user_media.user_id 
            AND (up.privacy_level = 'public' AND pref.public_lists = true)
        )
    );

CREATE POLICY "Users can manage their own media lists" ON user_media
    FOR ALL USING (user_id = auth.uid());

-- Function to update media item ratings when user ratings change
CREATE OR REPLACE FUNCTION update_media_rating()
RETURNS TRIGGER AS $$
BEGIN
    -- Update average rating and count for the media item
    UPDATE media_items 
    SET 
        average_rating = (
            SELECT COALESCE(AVG(rating::decimal), 0)
            FROM user_media 
            WHERE media_id = COALESCE(NEW.media_id, OLD.media_id) 
            AND rating IS NOT NULL
        ),
        rating_count = (
            SELECT COUNT(*)
            FROM user_media 
            WHERE media_id = COALESCE(NEW.media_id, OLD.media_id) 
            AND rating IS NOT NULL
        ),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.media_id, OLD.media_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for rating updates
CREATE TRIGGER update_media_rating_on_insert
    AFTER INSERT ON user_media
    FOR EACH ROW 
    WHEN (NEW.rating IS NOT NULL)
    EXECUTE FUNCTION update_media_rating();

CREATE TRIGGER update_media_rating_on_update
    AFTER UPDATE ON user_media
    FOR EACH ROW 
    WHEN (OLD.rating IS DISTINCT FROM NEW.rating)
    EXECUTE FUNCTION update_media_rating();

CREATE TRIGGER update_media_rating_on_delete
    AFTER DELETE ON user_media
    FOR EACH ROW 
    WHEN (OLD.rating IS NOT NULL)
    EXECUTE FUNCTION update_media_rating();

-- Trigger for updated_at on media_items
CREATE TRIGGER update_media_items_updated_at
    BEFORE UPDATE ON media_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for updated_at on user_media
CREATE TRIGGER update_user_media_updated_at
    BEFORE UPDATE ON user_media
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();