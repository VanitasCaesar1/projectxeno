-- User reviews and ratings (separate from user_media for detailed reviews)
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    media_id UUID REFERENCES media_items(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 10),
    title VARCHAR(200),
    content TEXT NOT NULL,
    spoiler_warning BOOLEAN DEFAULT false,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, media_id) -- One review per user per media item
);

-- Review likes/reactions
CREATE TABLE review_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, review_id)
);

-- User following system
CREATE TABLE user_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    following_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CHECK(follower_id != following_id)
);

-- Activity feed
CREATE TABLE user_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
        'added_to_list', 'completed_media', 'rated_media', 'reviewed_media', 
        'liked_review', 'followed_user', 'updated_status'
    )),
    media_id UUID REFERENCES media_items(id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_media_id ON reviews(media_id);
CREATE INDEX idx_reviews_rating ON reviews(rating DESC);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX idx_reviews_like_count ON reviews(like_count DESC);

CREATE INDEX idx_review_likes_user_id ON review_likes(user_id);
CREATE INDEX idx_review_likes_review_id ON review_likes(review_id);

CREATE INDEX idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON user_follows(following_id);

CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX idx_user_activities_type ON user_activities(activity_type);
CREATE INDEX idx_user_activities_created_at ON user_activities(created_at DESC);

-- Enable Row Level Security
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reviews
CREATE POLICY "Anyone can view public reviews" ON reviews
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            JOIN user_preferences pref ON up.id = pref.user_id
            WHERE up.id = reviews.user_id 
            AND (up.privacy_level = 'public' AND pref.public_ratings = true)
        )
    );

CREATE POLICY "Users can view their own reviews" ON reviews
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own reviews" ON reviews
    FOR ALL USING (user_id = auth.uid());

-- RLS Policies for review_likes
CREATE POLICY "Users can view review likes" ON review_likes
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own likes" ON review_likes
    FOR ALL USING (user_id = auth.uid());

-- RLS Policies for user_follows
CREATE POLICY "Users can view follows" ON user_follows
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their own follows" ON user_follows
    FOR ALL USING (follower_id = auth.uid());

-- RLS Policies for user_activities
CREATE POLICY "Users can view public activities" ON user_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = user_activities.user_id 
            AND up.privacy_level = 'public'
        )
    );

CREATE POLICY "Users can view their own activities" ON user_activities
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view activities of users they follow" ON user_activities
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_follows uf 
            WHERE uf.follower_id = auth.uid() 
            AND uf.following_id = user_activities.user_id
        )
    );

CREATE POLICY "System can insert activities" ON user_activities
    FOR INSERT TO authenticated WITH CHECK (true);

-- Function to update review like count
CREATE OR REPLACE FUNCTION update_review_like_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE reviews 
    SET 
        like_count = (
            SELECT COUNT(*) 
            FROM review_likes 
            WHERE review_id = COALESCE(NEW.review_id, OLD.review_id)
        ),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.review_id, OLD.review_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for like count updates
CREATE TRIGGER update_review_like_count_on_insert
    AFTER INSERT ON review_likes
    FOR EACH ROW EXECUTE FUNCTION update_review_like_count();

CREATE TRIGGER update_review_like_count_on_delete
    AFTER DELETE ON review_likes
    FOR EACH ROW EXECUTE FUNCTION update_review_like_count();

-- Function to create activity entries
CREATE OR REPLACE FUNCTION create_user_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle different table triggers
    IF TG_TABLE_NAME = 'user_media' THEN
        IF TG_OP = 'INSERT' THEN
            INSERT INTO user_activities (user_id, activity_type, media_id, metadata)
            VALUES (NEW.user_id, 'added_to_list', NEW.media_id, 
                   jsonb_build_object('status', NEW.status));
        ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
            INSERT INTO user_activities (user_id, activity_type, media_id, metadata)
            VALUES (NEW.user_id, 'updated_status', NEW.media_id, 
                   jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
            
            -- Special case for completion
            IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
                INSERT INTO user_activities (user_id, activity_type, media_id, metadata)
                VALUES (NEW.user_id, 'completed_media', NEW.media_id, 
                       jsonb_build_object('rating', NEW.rating));
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME = 'reviews' THEN
        IF TG_OP = 'INSERT' THEN
            INSERT INTO user_activities (user_id, activity_type, media_id, review_id, metadata)
            VALUES (NEW.user_id, 'reviewed_media', NEW.media_id, NEW.id,
                   jsonb_build_object('rating', NEW.rating, 'has_spoilers', NEW.spoiler_warning));
        END IF;
    ELSIF TG_TABLE_NAME = 'review_likes' THEN
        IF TG_OP = 'INSERT' THEN
            INSERT INTO user_activities (user_id, activity_type, review_id, metadata)
            VALUES (NEW.user_id, 'liked_review', NEW.review_id, '{}'::jsonb);
        END IF;
    ELSIF TG_TABLE_NAME = 'user_follows' THEN
        IF TG_OP = 'INSERT' THEN
            INSERT INTO user_activities (user_id, activity_type, target_user_id, metadata)
            VALUES (NEW.follower_id, 'followed_user', NEW.following_id, '{}'::jsonb);
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for activity creation
CREATE TRIGGER create_activity_on_user_media_change
    AFTER INSERT OR UPDATE ON user_media
    FOR EACH ROW EXECUTE FUNCTION create_user_activity();

CREATE TRIGGER create_activity_on_review_insert
    AFTER INSERT ON reviews
    FOR EACH ROW EXECUTE FUNCTION create_user_activity();

CREATE TRIGGER create_activity_on_review_like
    AFTER INSERT ON review_likes
    FOR EACH ROW EXECUTE FUNCTION create_user_activity();

CREATE TRIGGER create_activity_on_follow
    AFTER INSERT ON user_follows
    FOR EACH ROW EXECUTE FUNCTION create_user_activity();

-- Trigger for updated_at on reviews
CREATE TRIGGER update_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();