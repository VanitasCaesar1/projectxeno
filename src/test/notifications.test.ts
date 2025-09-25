import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { supabase } from '../lib/supabase';
import { NotificationService, AchievementService } from '../lib/notifications';

describe('Notification System', () => {
  let testUserId: string;
  let testUserId2: string;
  let testNotificationId: string;

  beforeEach(async () => {
    // Create test users
    const { data: user1 } = await supabase.auth.signUp({
      email: 'test-notifications1@example.com',
      password: 'testpassword123'
    });
    
    const { data: user2 } = await supabase.auth.signUp({
      email: 'test-notifications2@example.com',
      password: 'testpassword123'
    });

    testUserId = user1.user?.id || '';
    testUserId2 = user2.user?.id || '';

    // Create user profiles
    await supabase.from('user_profiles').insert([
      {
        id: testUserId,
        username: 'testuser1',
        display_name: 'Test User 1'
      },
      {
        id: testUserId2,
        username: 'testuser2',
        display_name: 'Test User 2'
      }
    ]);
  });

  afterEach(async () => {
    // Clean up test data
    if (testUserId) {
      await supabase.from('notifications').delete().eq('user_id', testUserId);
      await supabase.from('user_achievements').delete().eq('user_id', testUserId);
      await supabase.from('notification_preferences').delete().eq('user_id', testUserId);
      await supabase.from('user_profiles').delete().eq('id', testUserId);
      await supabase.auth.admin.deleteUser(testUserId);
    }
    
    if (testUserId2) {
      await supabase.from('notifications').delete().eq('user_id', testUserId2);
      await supabase.from('user_achievements').delete().eq('user_id', testUserId2);
      await supabase.from('notification_preferences').delete().eq('user_id', testUserId2);
      await supabase.from('user_profiles').delete().eq('id', testUserId2);
      await supabase.auth.admin.deleteUser(testUserId2);
    }
  });

  describe('NotificationService', () => {
    it('should create a notification', async () => {
      const notificationId = await NotificationService.createNotification(testUserId, {
        type: 'system',
        title: 'Test Notification',
        message: 'This is a test notification',
        data: { test: true }
      });

      expect(notificationId).toBeTruthy();
      testNotificationId = notificationId!;

      // Verify notification was created
      const { data: notification } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', notificationId)
        .single();

      expect(notification).toBeTruthy();
      expect(notification.title).toBe('Test Notification');
      expect(notification.message).toBe('This is a test notification');
      expect(notification.type).toBe('system');
      expect(notification.read).toBe(false);
    });

    it('should get unread notification count', async () => {
      // Create some notifications
      await NotificationService.createNotification(testUserId, {
        type: 'system',
        title: 'Test 1',
        message: 'Message 1'
      });

      await NotificationService.createNotification(testUserId, {
        type: 'system',
        title: 'Test 2',
        message: 'Message 2'
      });

      const count = await NotificationService.getUnreadCount(testUserId);
      expect(count).toBe(2);
    });

    it('should mark notification as read', async () => {
      const notificationId = await NotificationService.createNotification(testUserId, {
        type: 'system',
        title: 'Test Notification',
        message: 'This is a test notification'
      });

      const success = await NotificationService.markAsRead(notificationId!, testUserId);
      expect(success).toBe(true);

      // Verify notification is marked as read
      const { data: notification } = await supabase
        .from('notifications')
        .select('read')
        .eq('id', notificationId)
        .single();

      expect(notification.read).toBe(true);
    });

    it('should mark all notifications as read', async () => {
      // Create multiple notifications
      await NotificationService.createNotification(testUserId, {
        type: 'system',
        title: 'Test 1',
        message: 'Message 1'
      });

      await NotificationService.createNotification(testUserId, {
        type: 'system',
        title: 'Test 2',
        message: 'Message 2'
      });

      const success = await NotificationService.markAllAsRead(testUserId);
      expect(success).toBe(true);

      const unreadCount = await NotificationService.getUnreadCount(testUserId);
      expect(unreadCount).toBe(0);
    });

    it('should handle notification preferences', async () => {
      const preferences = {
        email_notifications: false,
        likes_notifications: true,
        follows_notifications: false
      };

      const success = await NotificationService.updatePreferences(testUserId, preferences);
      expect(success).toBe(true);

      const savedPreferences = await NotificationService.getPreferences(testUserId);
      expect(savedPreferences.email_notifications).toBe(false);
      expect(savedPreferences.likes_notifications).toBe(true);
      expect(savedPreferences.follows_notifications).toBe(false);
    });
  });

  describe('Achievement System', () => {
    it('should check and award achievements', async () => {
      // Create a review to trigger achievement checking
      const { data: mediaItem } = await supabase
        .from('media_items')
        .insert({
          external_id: 'test-movie-1',
          media_type: 'movie',
          title: 'Test Movie',
          description: 'A test movie'
        })
        .select()
        .single();

      await supabase
        .from('reviews')
        .insert({
          user_id: testUserId,
          media_id: mediaItem.id,
          rating: 8,
          content: 'Great movie!'
        });

      // Check achievements
      const success = await NotificationService.checkAchievements(testUserId, 'review');
      expect(success).toBe(true);

      // Check if first review achievement was awarded
      const { data: userAchievements } = await supabase
        .from('user_achievements')
        .select(`
          *,
          achievements (key, name)
        `)
        .eq('user_id', testUserId);

      const firstReviewAchievement = userAchievements?.find(
        ua => ua.achievements?.key === 'first_review'
      );
      expect(firstReviewAchievement).toBeTruthy();

      // Check if notification was created for achievement
      const { data: notifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', testUserId)
        .eq('type', 'achievement');

      expect(notifications?.length).toBeGreaterThan(0);
    });

    it('should not award the same achievement twice', async () => {
      // Manually award an achievement
      const { data: achievement } = await supabase
        .from('achievements')
        .select('*')
        .eq('key', 'first_review')
        .single();

      await supabase
        .from('user_achievements')
        .insert({
          user_id: testUserId,
          achievement_id: achievement.id
        });

      // Try to award it again
      await NotificationService.checkAchievements(testUserId, 'review');

      // Should still only have one
      const { count } = await supabase
        .from('user_achievements')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', testUserId)
        .eq('achievement_id', achievement.id);

      expect(count).toBe(1);
    });
  });

  describe('Social Notifications', () => {
    it('should notify when review is liked', async () => {
      // Create a review
      const { data: mediaItem } = await supabase
        .from('media_items')
        .insert({
          external_id: 'test-movie-2',
          media_type: 'movie',
          title: 'Test Movie 2',
          description: 'Another test movie'
        })
        .select()
        .single();

      const { data: review } = await supabase
        .from('reviews')
        .insert({
          user_id: testUserId,
          media_id: mediaItem.id,
          rating: 9,
          title: 'Amazing!',
          content: 'This movie was incredible!'
        })
        .select()
        .single();

      // Like the review (this should trigger notification via database trigger)
      await supabase
        .from('review_likes')
        .insert({
          user_id: testUserId2,
          review_id: review.id
        });

      // Wait a bit for trigger to execute
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if notification was created
      const { data: notifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', testUserId)
        .eq('type', 'like');

      expect(notifications?.length).toBeGreaterThan(0);
      expect(notifications?.[0].title).toBe('Someone liked your review!');
    });

    it('should notify when user is followed', async () => {
      // Follow user (this should trigger notification via database trigger)
      await supabase
        .from('user_follows')
        .insert({
          follower_id: testUserId2,
          following_id: testUserId
        });

      // Wait a bit for trigger to execute
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if notification was created
      const { data: notifications } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', testUserId)
        .eq('type', 'follow');

      expect(notifications?.length).toBeGreaterThan(0);
      expect(notifications?.[0].title).toBe('New follower!');
    });
  });

  describe('Email Queue', () => {
    it('should queue emails for notifications', async () => {
      // Create notification preferences with email enabled
      await supabase
        .from('notification_preferences')
        .insert({
          user_id: testUserId,
          email_notifications: true,
          email_frequency: 'immediate'
        });

      // Create a notification (should queue email)
      await NotificationService.createNotification(testUserId, {
        type: 'system',
        title: 'Test Email Notification',
        message: 'This should queue an email'
      });

      // Check if email was queued
      const { data: queuedEmails } = await supabase
        .from('email_queue')
        .select('*')
        .eq('user_id', testUserId)
        .eq('status', 'pending');

      expect(queuedEmails?.length).toBeGreaterThan(0);
      expect(queuedEmails?.[0].subject).toBe('Test Email Notification');
    });

    it('should not queue emails when disabled', async () => {
      // Create notification preferences with email disabled
      await supabase
        .from('notification_preferences')
        .insert({
          user_id: testUserId,
          email_notifications: false
        });

      // Create a notification
      await NotificationService.createNotification(testUserId, {
        type: 'system',
        title: 'Test No Email',
        message: 'This should not queue an email'
      });

      // Check that no email was queued
      const { data: queuedEmails } = await supabase
        .from('email_queue')
        .select('*')
        .eq('user_id', testUserId);

      expect(queuedEmails?.length).toBe(0);
    });
  });
});