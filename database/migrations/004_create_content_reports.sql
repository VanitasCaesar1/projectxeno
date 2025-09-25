-- Create content reports table for moderation system
CREATE TABLE content_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('spam', 'harassment', 'inappropriate', 'copyright', 'misinformation', 'other')),
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('review', 'profile', 'comment', 'media', 'other')),
    content_id UUID NULL, -- ID of the reported content (review, profile, etc.)
    content_url TEXT NULL, -- URL of the reported content (for external links)
    description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'priority', 'reviewing', 'resolved', 'dismissed')),
    moderator_id UUID NULL REFERENCES user_profiles(id) ON DELETE SET NULL,
    moderator_notes TEXT NULL,
    resolved_at TIMESTAMP NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_content_reports_reporter_id ON content_reports(reporter_id);
CREATE INDEX idx_content_reports_status ON content_reports(status);
CREATE INDEX idx_content_reports_content ON content_reports(content_type, content_id);
CREATE INDEX idx_content_reports_created_at ON content_reports(created_at DESC);
CREATE INDEX idx_content_reports_report_type ON content_reports(report_type);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_content_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_content_reports_updated_at
    BEFORE UPDATE ON content_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_content_reports_updated_at();

-- Add RLS policies
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

-- Users can only see their own reports
CREATE POLICY "Users can view their own reports" ON content_reports
    FOR SELECT USING (reporter_id = auth.uid());

-- Users can create reports
CREATE POLICY "Users can create reports" ON content_reports
    FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- Only moderators can update reports (this would need a role system in a real app)
-- For now, we'll allow the reporter to see updates to their reports
CREATE POLICY "Users can view updates to their reports" ON content_reports
    FOR SELECT USING (reporter_id = auth.uid());

-- Add comment for documentation
COMMENT ON TABLE content_reports IS 'Stores user reports for content moderation';
COMMENT ON COLUMN content_reports.report_type IS 'Type of report: spam, harassment, inappropriate, copyright, misinformation, other';
COMMENT ON COLUMN content_reports.content_type IS 'Type of content being reported: review, profile, comment, media, other';
COMMENT ON COLUMN content_reports.content_id IS 'ID of the specific content being reported (if applicable)';
COMMENT ON COLUMN content_reports.content_url IS 'URL of the content being reported (for external content)';
COMMENT ON COLUMN content_reports.status IS 'Current status of the report: pending, priority, reviewing, resolved, dismissed';
COMMENT ON COLUMN content_reports.metadata IS 'Additional metadata about the report (user agent, IP, etc.)';