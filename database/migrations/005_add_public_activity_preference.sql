-- Add public_activity column to user_preferences table
ALTER TABLE user_preferences 
ADD COLUMN public_activity BOOLEAN DEFAULT true;

-- Update the database types comment
COMMENT ON COLUMN user_preferences.public_activity IS 'Whether user activity feed is visible to others';