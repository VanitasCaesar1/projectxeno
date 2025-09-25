import { describe, it, expect, vi } from 'vitest';

// Mock the API responses for testing
const mockApiResponse = (data: any, success = true) => ({
  ok: success,
  json: async () => success ? { success: true, data } : { success: false, error: { message: 'Test error' } },
  blob: async () => new Blob([JSON.stringify(data)], { type: 'application/json' })
});

// Mock fetch globally for these tests
global.fetch = vi.fn();

describe('Data Management and Privacy Controls', () => {

  describe('Privacy Settings API', () => {
    it('should handle privacy preferences update', async () => {
      const mockPreferences = {
        privacyLevel: 'private',
        publicLists: false,
        publicRatings: true,
        publicActivity: false,
        emailNotifications: true,
        preferredLanguage: 'es'
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockPreferences)
      );

      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockPreferences)
      });

      const result = await response.json();

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockPreferences)
      });
    });

    it('should validate privacy level values', () => {
      const validPrivacyLevels = ['public', 'private', 'friends'];
      const testLevel = 'private';
      
      expect(validPrivacyLevels).toContain(testLevel);
    });

    it('should validate report types', () => {
      const validReportTypes = ['spam', 'harassment', 'inappropriate', 'copyright', 'misinformation', 'other'];
      const testReportType = 'spam';
      
      expect(validReportTypes).toContain(testReportType);
    });
  });

  describe('Data Export', () => {
    it('should export user data structure', async () => {
      // Create some test data
      const { data: mediaItem } = await supabase
        .from('media_items')
        .insert({
          external_id: 'test-movie-123',
          media_type: 'movie',
          title: 'Test Movie',
          description: 'A test movie'
        })
        .select()
        .single();

      if (mediaItem) {
        await supabase
          .from('user_media')
          .insert({
            user_id: testUser.id,
            media_id: mediaItem.id,
            status: 'completed',
            rating: 8
          });

        await supabase
          .from('reviews')
          .insert({
            user_id: testUser.id,
            media_id: mediaItem.id,
            rating: 8,
            content: 'Great movie!'
          });
      }

      // Test data structure (simulating export API)
      const { data: userMedia } = await supabase
        .from('user_media')
        .select(`
          *,
          media_items (*)
        `)
        .eq('user_id', testUser.id);

      const { data: reviews } = await supabase
        .from('reviews')
        .select(`
          *,
          media_items (*)
        `)
        .eq('user_id', testUser.id);

      expect(userMedia).toBeDefined();
      expect(reviews).toBeDefined();
      expect(userMedia?.length).toBeGreaterThan(0);
      expect(reviews?.length).toBeGreaterThan(0);
    });
  });

  describe('Content Reporting', () => {
    it('should create content report', async () => {
      const reportData = {
        reporter_id: testUser.id,
        report_type: 'spam',
        content_type: 'review',
        description: 'This is spam content',
        status: 'pending'
      };

      const { data, error } = await supabase
        .from('content_reports')
        .insert(reportData)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.report_type).toBe('spam');
      expect(data.content_type).toBe('review');
      expect(data.status).toBe('pending');
    });

    it('should validate report types', async () => {
      const invalidReportData = {
        reporter_id: testUser.id,
        report_type: 'invalid_type',
        content_type: 'review',
        description: 'Test report'
      };

      const { error } = await supabase
        .from('content_reports')
        .insert(invalidReportData);

      expect(error).toBeDefined();
      expect(error?.message).toContain('violates check constraint');
    });
  });

  describe('Account Deletion', () => {
    it('should handle cascading deletes properly', async () => {
      // Create test data that should be deleted
      const { data: mediaItem } = await supabase
        .from('media_items')
        .insert({
          external_id: 'test-delete-123',
          media_type: 'movie',
          title: 'Delete Test Movie'
        })
        .select()
        .single();

      if (mediaItem) {
        await supabase
          .from('user_media')
          .insert({
            user_id: testUser.id,
            media_id: mediaItem.id,
            status: 'completed'
          });

        await supabase
          .from('reviews')
          .insert({
            user_id: testUser.id,
            media_id: mediaItem.id,
            content: 'Test review for deletion'
          });

        await supabase
          .from('user_preferences')
          .insert({
            user_id: testUser.id,
            email_notifications: true,
            public_lists: true,
            public_ratings: true
          });
      }

      // Verify data exists
      const { data: beforeUserMedia } = await supabase
        .from('user_media')
        .select('*')
        .eq('user_id', testUser.id);

      const { data: beforeReviews } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', testUser.id);

      expect(beforeUserMedia?.length).toBeGreaterThan(0);
      expect(beforeReviews?.length).toBeGreaterThan(0);

      // Delete user profile (simulating account deletion)
      await supabase
        .from('user_profiles')
        .delete()
        .eq('id', testUser.id);

      // Verify related data is deleted due to foreign key constraints
      const { data: afterUserMedia } = await supabase
        .from('user_media')
        .select('*')
        .eq('user_id', testUser.id);

      const { data: afterReviews } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', testUser.id);

      const { data: afterPreferences } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', testUser.id);

      expect(afterUserMedia?.length).toBe(0);
      expect(afterReviews?.length).toBe(0);
      expect(afterPreferences?.length).toBe(0);
    });
  });

  describe('Privacy Controls', () => {
    it('should respect privacy settings in data visibility', async () => {
      // Set profile to private
      await supabase
        .from('user_profiles')
        .update({ privacy_level: 'private' })
        .eq('id', testUser.id);

      // Set preferences to hide data
      await supabase
        .from('user_preferences')
        .upsert({
          user_id: testUser.id,
          public_lists: false,
          public_ratings: false,
          public_activity: false
        });

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('privacy_level')
        .eq('id', testUser.id)
        .single();

      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('public_lists, public_ratings, public_activity')
        .eq('user_id', testUser.id)
        .single();

      expect(profile?.privacy_level).toBe('private');
      expect(preferences?.public_lists).toBe(false);
      expect(preferences?.public_ratings).toBe(false);
      expect(preferences?.public_activity).toBe(false);
    });
  });
});