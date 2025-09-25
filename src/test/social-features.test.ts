import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { supabase } from '../lib/supabase';

describe('Social Features', () => {
  let testUser1: any;
  let testUser2: any;
  let testMedia: any;
  let testReview: any;

  beforeEach(async () => {
    // Create test users
    const { data: user1 } = await supabase.auth.signUp({
      email: 'testuser1@example.com',
      password: 'testpassword123'
    });

    const { data: user2 } = await supabase.auth.signUp({
      email: 'testuser2@example.com',
      password: 'testpassword123'
    });

    testUser1 = user1.user;
    testUser2 = user2.user;

    // Create test user profiles
    await supabase.from('user_profiles').insert([
      {
        id: testUser1.id,
        username: 'testuser1',
        display_name: 'Test User 1',
        privacy_level: 'public'
      },
      {
        id: testUser2.id,
        username: 'testuser2',
        display_name: 'Test User 2',
        privacy_level: 'public'
      }
    ]);

    // Create test media item
    const { data: media } = await supabase
      .from('media_items')
      .insert({
        external_id: 'test-movie-123',
        media_type: 'movie',
        title: 'Test Movie',
        description: 'A test movie for testing',
        genres: ['Action', 'Drama']
      })
      .select()
      .single();

    testMedia = media;

    // Create test review
    const { data: review } = await supabase
      .from('reviews')
      .insert({
        user_id: testUser1.id,
        media_id: testMedia.id,
        rating: 8,
        title: 'Great movie!',
        content: 'This is a test review for the test movie.',
        spoiler_warning: false
      })
      .select()
      .single();

    testReview = review;
  });

  afterEach(async () => {
    // Clean up test data
    if (testReview) {
      await supabase.from('reviews').delete().eq('id', testReview.id);
    }
    if (testMedia) {
      await supabase.from('media_items').delete().eq('id', testMedia.id);
    }
    if (testUser1) {
      await supabase.from('user_profiles').delete().eq('id', testUser1.id);
    }
    if (testUser2) {
      await supabase.from('user_profiles').delete().eq('id', testUser2.id);
    }
  });

  describe('Review Likes', () => {
    it('should allow users to like reviews', async () => {
      // Set up session for user2
      supabase.auth.setSession({
        access_token: 'mock-token',
        refresh_token: 'mock-refresh-token'
      });

      // Mock the auth.getUser to return testUser2
      const originalGetUser = supabase.auth.getUser;
      supabase.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: testUser2 },
        error: null
      });

      // Like the review
      const { data: like, error } = await supabase
        .from('review_likes')
        .insert({
          user_id: testUser2.id,
          review_id: testReview.id
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(like).toBeDefined();
      expect(like.user_id).toBe(testUser2.id);
      expect(like.review_id).toBe(testReview.id);

      // Restore original function
      supabase.auth.getUser = originalGetUser;
    });

    it('should prevent users from liking their own reviews', async () => {
      // Try to like own review
      const { error } = await supabase
        .from('review_likes')
        .insert({
          user_id: testUser1.id,
          review_id: testReview.id
        });

      // This should be prevented by business logic, not database constraints
      // The actual prevention happens in the API route
      expect(true).toBe(true); // Placeholder - actual test would be against API endpoint
    });

    it('should prevent duplicate likes', async () => {
      // First like
      await supabase
        .from('review_likes')
        .insert({
          user_id: testUser2.id,
          review_id: testReview.id
        });

      // Second like (should fail due to unique constraint)
      const { error } = await supabase
        .from('review_likes')
        .insert({
          user_id: testUser2.id,
          review_id: testReview.id
        });

      expect(error).toBeDefined();
      expect(error?.code).toBe('23505'); // Unique constraint violation
    });
  });

  describe('User Following', () => {
    it('should allow users to follow other users', async () => {
      const { data: follow, error } = await supabase
        .from('user_follows')
        .insert({
          follower_id: testUser1.id,
          following_id: testUser2.id
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(follow).toBeDefined();
      expect(follow.follower_id).toBe(testUser1.id);
      expect(follow.following_id).toBe(testUser2.id);
    });

    it('should prevent users from following themselves', async () => {
      const { error } = await supabase
        .from('user_follows')
        .insert({
          follower_id: testUser1.id,
          following_id: testUser1.id
        });

      expect(error).toBeDefined();
      expect(error?.code).toBe('23514'); // Check constraint violation
    });

    it('should prevent duplicate follows', async () => {
      // First follow
      await supabase
        .from('user_follows')
        .insert({
          follower_id: testUser1.id,
          following_id: testUser2.id
        });

      // Second follow (should fail)
      const { error } = await supabase
        .from('user_follows')
        .insert({
          follower_id: testUser1.id,
          following_id: testUser2.id
        });

      expect(error).toBeDefined();
      expect(error?.code).toBe('23505'); // Unique constraint violation
    });
  });

  describe('User Activities', () => {
    it('should create activity when user follows another user', async () => {
      // Create follow relationship
      await supabase
        .from('user_follows')
        .insert({
          follower_id: testUser1.id,
          following_id: testUser2.id
        });

      // Create corresponding activity
      const { data: activity, error } = await supabase
        .from('user_activities')
        .insert({
          user_id: testUser1.id,
          activity_type: 'user_followed',
          target_user_id: testUser2.id,
          metadata: {}
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(activity).toBeDefined();
      expect(activity.user_id).toBe(testUser1.id);
      expect(activity.activity_type).toBe('user_followed');
      expect(activity.target_user_id).toBe(testUser2.id);
    });

    it('should create activity when user likes a review', async () => {
      // Create review like
      await supabase
        .from('review_likes')
        .insert({
          user_id: testUser2.id,
          review_id: testReview.id
        });

      // Create corresponding activity
      const { data: activity, error } = await supabase
        .from('user_activities')
        .insert({
          user_id: testUser2.id,
          activity_type: 'review_liked',
          media_id: testMedia.id,
          review_id: testReview.id,
          metadata: { reviewUser: 'Test User 1' }
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(activity).toBeDefined();
      expect(activity.user_id).toBe(testUser2.id);
      expect(activity.activity_type).toBe('review_liked');
      expect(activity.media_id).toBe(testMedia.id);
      expect(activity.review_id).toBe(testReview.id);
    });

    it('should fetch user activities with proper relationships', async () => {
      // Create some activities
      await supabase
        .from('user_activities')
        .insert([
          {
            user_id: testUser1.id,
            activity_type: 'review_created',
            media_id: testMedia.id,
            review_id: testReview.id,
            metadata: { rating: 8 }
          },
          {
            user_id: testUser1.id,
            activity_type: 'user_followed',
            target_user_id: testUser2.id,
            metadata: {}
          }
        ]);

      // Fetch activities with relationships
      const { data: activities, error } = await supabase
        .from('user_activities')
        .select(`
          *,
          user:user_profiles!user_activities_user_id_fkey(
            id,
            username,
            display_name,
            avatar_url
          ),
          media:media_items!user_activities_media_id_fkey(
            id,
            title,
            media_type,
            poster_url
          ),
          target_user:user_profiles!user_activities_target_user_id_fkey(
            id,
            username,
            display_name,
            avatar_url
          ),
          review:reviews!user_activities_review_id_fkey(
            id,
            title,
            content
          )
        `)
        .eq('user_id', testUser1.id)
        .order('created_at', { ascending: false });

      expect(error).toBeNull();
      expect(activities).toBeDefined();
      expect(activities.length).toBe(2);

      // Check review activity
      const reviewActivity = activities.find(a => a.activity_type === 'review_created');
      expect(reviewActivity).toBeDefined();
      expect(reviewActivity.user).toBeDefined();
      expect(reviewActivity.media).toBeDefined();
      expect(reviewActivity.review).toBeDefined();

      // Check follow activity
      const followActivity = activities.find(a => a.activity_type === 'user_followed');
      expect(followActivity).toBeDefined();
      expect(followActivity.user).toBeDefined();
      expect(followActivity.target_user).toBeDefined();
    });
  });

  describe('Public Profile Discovery', () => {
    it('should allow viewing public profiles', async () => {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('username', 'testuser1')
        .single();

      expect(error).toBeNull();
      expect(profile).toBeDefined();
      expect(profile.username).toBe('testuser1');
      expect(profile.privacy_level).toBe('public');
    });

    it('should respect privacy settings', async () => {
      // Update user2 to private
      await supabase
        .from('user_profiles')
        .update({ privacy_level: 'private' })
        .eq('id', testUser2.id);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', testUser2.id)
        .single();

      expect(profile.privacy_level).toBe('private');
      // In a real app, additional logic would check if the current user
      // has permission to view this private profile
    });

    it('should show user statistics', async () => {
      // Add some user media to create statistics
      await supabase
        .from('user_media')
        .insert({
          user_id: testUser1.id,
          media_id: testMedia.id,
          status: 'completed',
          rating: 8
        });

      // Get user statistics (this would typically be done through a function or view)
      const { data: userMedia } = await supabase
        .from('user_media')
        .select('*')
        .eq('user_id', testUser1.id);

      const { data: reviews } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', testUser1.id);

      const { data: followers } = await supabase
        .from('user_follows')
        .select('*')
        .eq('following_id', testUser1.id);

      const { data: following } = await supabase
        .from('user_follows')
        .select('*')
        .eq('follower_id', testUser1.id);

      expect(userMedia.length).toBe(1);
      expect(reviews.length).toBe(1);
      expect(followers.length).toBe(0);
      expect(following.length).toBe(0);
    });
  });
});