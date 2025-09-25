-- Migration 008: Create notifications and achievements system
-- This migration adds tables for notifications, user achievements, and enhanced user preferences

-- Create notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'like', 'follow', 'review', 'achievement', 'system'
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}', -- Additional data for the notification
    read BOOLEAN DEFAULT false,
    action_url VARCHAR(500), -- URL to navigate when notification is clicked
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP -- Optional expiration for temporary notifications
);

-- Create indexes for notifications table
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Create achievements table
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL, -- Unique identifier for the achievement
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(100), -- Icon identifier or URL
    category VARCHAR(50) NOT NULL, -- 'social', 'content', 'milestone', 'special'
    points INTEGER DEFAULT 0, -- Points awarded for this achievement
    rarity VARCHAR(20) DEFAULT 'common', -- 'common', 'rare', 'epic', 'legendary'
    requirements JSONB NOT NULL, -- Conditions to unlock the achievement
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create user achievements table (many-to-many relationship)
CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP DEFAULT NOW(),
    progress JSONB DEFAULT '{}', -- Track progress towards achievement
    
    UNIQUE(user_id, achievement_id)
);

-- Create indexes for user_achievements table
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX idx_user_achievements_unlocked_at ON user_achievements(unlocked_at);

-- Create notification preferences table (extends user_preferences)
CREATE TABLE notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    
    -- Specific notification types
    likes_notifications BOOLEAN DEFAULT true,
    follows_notifications BOOLEAN DEFAULT true,
    reviews_notifications BOOLEAN DEFAULT true,
    achievements_notifications BOOLEAN DEFAULT true,
    system_notifications BOOLEAN DEFAULT true,
    
    -- Email frequency settings
    email_frequency VARCHAR(20) DEFAULT 'immediate', -- 'immediate', 'daily', 'weekly', 'never'
    digest_time TIME DEFAULT '09:00:00', -- Time for daily/weekly digests
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create email queue table for managing email notifications
CREATE TABLE email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    email_type VARCHAR(50) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    template_data JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'cancelled'
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    scheduled_for TIMESTAMP DEFAULT NOW(),
    sent_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for email_queue table
CREATE INDEX idx_email_queue_status ON email_queue(status);
CREATE INDEX idx_email_queue_scheduled_for ON email_queue(scheduled_for);
CREATE INDEX idx_email_queue_user_id ON email_queue(user_id);

-- Insert default achievements
INSERT INTO achievements (key, name, description, icon, category, points, rarity, requirements) VALUES
-- Social achievements
('first_follow', 'Social Butterfly', 'Follow your first user', 'user-plus', 'social', 10, 'common', '{"follows_count": 1}'),
('popular_user', 'Popular', 'Get 10 followers', 'users', 'social', 50, 'rare', '{"followers_count": 10}'),
('super_popular', 'Influencer', 'Get 100 followers', 'star', 'social', 200, 'epic', '{"followers_count": 100}'),

-- Content achievements
('first_review', 'Critic', 'Write your first review', 'edit-3', 'content', 10, 'common', '{"reviews_count": 1}'),
('prolific_reviewer', 'Prolific Reviewer', 'Write 25 reviews', 'book-open', 'content', 100, 'rare', '{"reviews_count": 25}'),
('master_critic', 'Master Critic', 'Write 100 reviews', 'award', 'content', 500, 'epic', '{"reviews_count": 100}'),

-- Milestone achievements
('first_rating', 'Rater', 'Rate your first item', 'star', 'milestone', 5, 'common', '{"ratings_count": 1}'),
('completionist', 'Completionist', 'Mark 50 items as completed', 'check-circle', 'milestone', 150, 'rare', '{"completed_count": 50}'),
('binge_watcher', 'Binge Watcher', 'Complete 10 items in a single day', 'tv', 'milestone', 75, 'rare', '{"daily_completions": 10}'),

-- Special achievements
('early_adopter', 'Early Adopter', 'One of the first 100 users', 'zap', 'special', 100, 'legendary', '{"user_rank": 100}'),
('helpful_reviewer', 'Helpful Reviewer', 'Get 50 likes on your reviews', 'heart', 'special', 200, 'epic', '{"review_likes_received": 50}');

-- Create default notification preferences for existing users
INSERT INTO notification_preferences (user_id)
SELECT id FROM user_profiles
ON CONFLICT (user_id) DO NOTHING;

-- Create function to automatically create notification preferences for new users
CREATE OR REPLACE FUNCTION create_notification_preferences_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_preferences (user_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically create notification preferences
CREATE TRIGGER trigger_create_notification_preferences
    AFTER INSERT ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_notification_preferences_for_new_user();

-- Create function to check and award achievements
CREATE OR REPLACE FUNCTION check_and_award_achievements(p_user_id UUID, p_activity_type VARCHAR)
RETURNS VOID AS $$
DECLARE
    achievement_record RECORD;
    user_stats RECORD;
    should_award BOOLEAN;
BEGIN
    -- Get user statistics
    SELECT 
        (SELECT COUNT(*) FROM user_follows WHERE follower_id = p_user_id) as follows_count,
        (SELECT COUNT(*) FROM user_follows WHERE following_id = p_user_id) as followers_count,
        (SELECT COUNT(*) FROM reviews WHERE user_id = p_user_id) as reviews_count,
        (SELECT COUNT(*) FROM user_media WHERE user_id = p_user_id AND rating IS NOT NULL) as ratings_count,
        (SELECT COUNT(*) FROM user_media WHERE user_id = p_user_id AND status = 'completed') as completed_count,
        (SELECT COALESCE(SUM(like_count), 0) FROM reviews WHERE user_id = p_user_id) as review_likes_received
    INTO user_stats;
    
    -- Check each achievement
    FOR achievement_record IN 
        SELECT a.* FROM achievements a 
        WHERE a.is_active = true 
        AND NOT EXISTS (
            SELECT 1 FROM user_achievements ua 
            WHERE ua.user_id = p_user_id AND ua.achievement_id = a.id
        )
    LOOP
        should_award := false;
        
        -- Check achievement requirements
        CASE achievement_record.key
            WHEN 'first_follow' THEN
                should_award := user_stats.follows_count >= 1;
            WHEN 'popular_user' THEN
                should_award := user_stats.followers_count >= 10;
            WHEN 'super_popular' THEN
                should_award := user_stats.followers_count >= 100;
            WHEN 'first_review' THEN
                should_award := user_stats.reviews_count >= 1;
            WHEN 'prolific_reviewer' THEN
                should_award := user_stats.reviews_count >= 25;
            WHEN 'master_critic' THEN
                should_award := user_stats.reviews_count >= 100;
            WHEN 'first_rating' THEN
                should_award := user_stats.ratings_count >= 1;
            WHEN 'completionist' THEN
                should_award := user_stats.completed_count >= 50;
            WHEN 'helpful_reviewer' THEN
                should_award := user_stats.review_likes_received >= 50;
        END CASE;
        
        -- Award achievement if conditions are met
        IF should_award THEN
            INSERT INTO user_achievements (user_id, achievement_id)
            VALUES (p_user_id, achievement_record.id);
            
            -- Create notification for achievement
            INSERT INTO notifications (user_id, type, title, message, data)
            VALUES (
                p_user_id,
                'achievement',
                'Achievement Unlocked!',
                'You earned the "' || achievement_record.name || '" achievement!',
                jsonb_build_object(
                    'achievement_id', achievement_record.id,
                    'achievement_name', achievement_record.name,
                    'points', achievement_record.points,
                    'rarity', achievement_record.rarity
                )
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to create notifications for various events
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_type VARCHAR,
    p_title VARCHAR,
    p_message TEXT,
    p_data JSONB DEFAULT '{}',
    p_action_url VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
    user_prefs RECORD;
BEGIN
    -- Get user notification preferences
    SELECT * FROM notification_preferences WHERE user_id = p_user_id INTO user_prefs;
    
    -- Check if user wants this type of notification
    IF user_prefs IS NULL OR (
        (p_type = 'like' AND user_prefs.likes_notifications) OR
        (p_type = 'follow' AND user_prefs.follows_notifications) OR
        (p_type = 'review' AND user_prefs.reviews_notifications) OR
        (p_type = 'achievement' AND user_prefs.achievements_notifications) OR
        (p_type = 'system' AND user_prefs.system_notifications)
    ) THEN
        -- Create notification
        INSERT INTO notifications (user_id, type, title, message, data, action_url)
        VALUES (p_user_id, p_type, p_title, p_message, p_data, p_action_url)
        RETURNING id INTO notification_id;
        
        -- Queue email if user has email notifications enabled
        IF user_prefs.email_notifications AND user_prefs.email_frequency = 'immediate' THEN
            INSERT INTO email_queue (user_id, email_type, subject, content, template_data)
            VALUES (
                p_user_id,
                p_type,
                p_title,
                p_message,
                p_data
            );
        END IF;
        
        RETURN notification_id;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic notifications

-- Trigger for review likes
CREATE OR REPLACE FUNCTION notify_review_like()
RETURNS TRIGGER AS $$
DECLARE
    review_owner_id UUID;
    liker_username VARCHAR;
    review_title VARCHAR;
BEGIN
    -- Get review owner and liker info
    SELECT r.user_id, r.title INTO review_owner_id, review_title
    FROM reviews r WHERE r.id = NEW.review_id;
    
    SELECT username INTO liker_username
    FROM user_profiles WHERE id = NEW.user_id;
    
    -- Don't notify if user liked their own review
    IF review_owner_id != NEW.user_id THEN
        PERFORM create_notification(
            review_owner_id,
            'like',
            'Someone liked your review!',
            liker_username || ' liked your review' || 
            CASE WHEN review_title IS NOT NULL THEN ' "' || review_title || '"' ELSE '' END,
            jsonb_build_object(
                'liker_id', NEW.user_id,
                'liker_username', liker_username,
                'review_id', NEW.review_id
            ),
            '/reviews/' || NEW.review_id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_review_like
    AFTER INSERT ON review_likes
    FOR EACH ROW
    EXECUTE FUNCTION notify_review_like();

-- Trigger for new followers
CREATE OR REPLACE FUNCTION notify_new_follow()
RETURNS TRIGGER AS $$
DECLARE
    follower_username VARCHAR;
    following_username VARCHAR;
BEGIN
    SELECT username INTO follower_username
    FROM user_profiles WHERE id = NEW.follower_id;
    
    SELECT username INTO following_username
    FROM user_profiles WHERE id = NEW.following_id;
    
    -- Notify the user being followed
    PERFORM create_notification(
        NEW.following_id,
        'follow',
        'New follower!',
        follower_username || ' started following you',
        jsonb_build_object(
            'follower_id', NEW.follower_id,
            'follower_username', follower_username
        ),
        '/user/' || follower_username
    );
    
    -- Check for achievements
    PERFORM check_and_award_achievements(NEW.follower_id, 'follow');
    PERFORM check_and_award_achievements(NEW.following_id, 'followed');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_new_follow
    AFTER INSERT ON user_follows
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_follow();

-- Trigger for new reviews
CREATE OR REPLACE FUNCTION notify_new_review()
RETURNS TRIGGER AS $$
DECLARE
    reviewer_username VARCHAR;
    media_title VARCHAR;
BEGIN
    SELECT username INTO reviewer_username
    FROM user_profiles WHERE id = NEW.user_id;
    
    SELECT title INTO media_title
    FROM media_items WHERE id = NEW.media_id;
    
    -- Check for achievements
    PERFORM check_and_award_achievements(NEW.user_id, 'review');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_new_review
    AFTER INSERT ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_review();

-- Trigger for new ratings
CREATE OR REPLACE FUNCTION notify_new_rating()
RETURNS TRIGGER AS $$
BEGIN
    -- Check for achievements when rating is added
    IF NEW.rating IS NOT NULL AND (OLD.rating IS NULL OR OLD.rating != NEW.rating) THEN
        PERFORM check_and_award_achievements(NEW.user_id, 'rating');
    END IF;
    
    -- Check for completion achievements
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        PERFORM check_and_award_achievements(NEW.user_id, 'completion');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_new_rating
    AFTER INSERT OR UPDATE ON user_media
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_rating();

-- Create additional indexes for better performance
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read, created_at);
CREATE INDEX idx_user_achievements_user_unlocked ON user_achievements(user_id, unlocked_at);
CREATE INDEX idx_email_queue_pending ON email_queue(status, scheduled_for) WHERE status = 'pending';

-- Add RLS policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Notifications policies
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Achievements policies (read-only for users)
CREATE POLICY "Anyone can view achievements" ON achievements
    FOR SELECT USING (true);

-- User achievements policies
CREATE POLICY "Users can view their own achievements" ON user_achievements
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view others' achievements" ON user_achievements
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles up 
            WHERE up.id = user_id AND up.privacy_level = 'public'
        )
    );

-- Notification preferences policies
CREATE POLICY "Users can manage their own notification preferences" ON notification_preferences
    FOR ALL USING (auth.uid() = user_id);

-- Email queue policies (system only)
CREATE POLICY "No direct access to email queue" ON email_queue
    FOR ALL USING (false);