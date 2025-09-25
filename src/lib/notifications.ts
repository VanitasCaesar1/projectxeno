import { supabase } from './supabase';

export interface NotificationData {
  type: 'like' | 'follow' | 'review' | 'achievement' | 'system';
  title: string;
  message: string;
  data?: Record<string, any>;
  actionUrl?: string;
}

export interface Achievement {
  id: string;
  key: string;
  name: string;
  description: string;
  icon?: string;
  category: string;
  points: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  requirements: Record<string, any>;
}

export class NotificationService {
  /**
   * Create a notification for a user
   */
  static async createNotification(userId: string, notification: NotificationData): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc('create_notification', {
        p_user_id: userId,
        p_type: notification.type,
        p_title: notification.title,
        p_message: notification.message,
        p_data: notification.data || {},
        p_action_url: notification.actionUrl
      });

      if (error) {
        console.error('Error creating notification:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in createNotification:', error);
      return null;
    }
  }

  /**
   * Mark a notification as read
   */
  static async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error marking notification as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markAsRead:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markAllAsRead:', error);
      return false;
    }
  }

  /**
   * Get unread notification count for a user
   */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        console.error('Error getting unread count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getUnreadCount:', error);
      return 0;
    }
  }

  /**
   * Check and award achievements for a user
   */
  static async checkAchievements(userId: string, activityType: string): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('check_and_award_achievements', {
        p_user_id: userId,
        p_activity_type: activityType
      });

      if (error) {
        console.error('Error checking achievements:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in checkAchievements:', error);
      return false;
    }
  }

  /**
   * Create notification for review like
   */
  static async notifyReviewLike(reviewOwnerId: string, likerId: string, reviewId: string, reviewTitle?: string): Promise<void> {
    if (reviewOwnerId === likerId) return; // Don't notify self

    try {
      // Get liker's username
      const { data: liker } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('id', likerId)
        .single();

      if (!liker) return;

      await this.createNotification(reviewOwnerId, {
        type: 'like',
        title: 'Someone liked your review!',
        message: `${liker.username} liked your review${reviewTitle ? ` "${reviewTitle}"` : ''}`,
        data: {
          liker_id: likerId,
          liker_username: liker.username,
          review_id: reviewId
        },
        actionUrl: `/reviews/${reviewId}`
      });
    } catch (error) {
      console.error('Error in notifyReviewLike:', error);
    }
  }

  /**
   * Create notification for new follower
   */
  static async notifyNewFollower(followingId: string, followerId: string): Promise<void> {
    try {
      // Get follower's username
      const { data: follower } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('id', followerId)
        .single();

      if (!follower) return;

      await this.createNotification(followingId, {
        type: 'follow',
        title: 'New follower!',
        message: `${follower.username} started following you`,
        data: {
          follower_id: followerId,
          follower_username: follower.username
        },
        actionUrl: `/user/${follower.username}`
      });
    } catch (error) {
      console.error('Error in notifyNewFollower:', error);
    }
  }

  /**
   * Create notification for achievement unlock
   */
  static async notifyAchievement(userId: string, achievement: Achievement): Promise<void> {
    try {
      await this.createNotification(userId, {
        type: 'achievement',
        title: 'Achievement Unlocked!',
        message: `You earned the "${achievement.name}" achievement!`,
        data: {
          achievement_id: achievement.id,
          achievement_name: achievement.name,
          points: achievement.points,
          rarity: achievement.rarity
        },
        actionUrl: `/profile/achievements?highlight=${achievement.id}`
      });
    } catch (error) {
      console.error('Error in notifyAchievement:', error);
    }
  }

  /**
   * Get user's notification preferences
   */
  static async getPreferences(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error getting notification preferences:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getPreferences:', error);
      return null;
    }
  }

  /**
   * Update user's notification preferences
   */
  static async updatePreferences(userId: string, preferences: Record<string, any>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: userId,
          ...preferences,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error updating notification preferences:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updatePreferences:', error);
      return false;
    }
  }
}

/**
 * Achievement checking utilities
 */
export class AchievementService {
  /**
   * Check if user qualifies for achievements based on their stats
   */
  static async checkUserAchievements(userId: string): Promise<Achievement[]> {
    try {
      // Get user statistics
      const stats = await this.getUserStats(userId);
      
      // Get all achievements user doesn't have yet
      const { data: availableAchievements } = await supabase
        .from('achievements')
        .select('*')
        .eq('is_active', true)
        .not('id', 'in', `(SELECT achievement_id FROM user_achievements WHERE user_id = '${userId}')`);

      if (!availableAchievements) return [];

      const earnedAchievements: Achievement[] = [];

      for (const achievement of availableAchievements) {
        if (this.checkAchievementRequirements(achievement, stats)) {
          // Award the achievement
          const { error } = await supabase
            .from('user_achievements')
            .insert({
              user_id: userId,
              achievement_id: achievement.id
            });

          if (!error) {
            earnedAchievements.push(achievement);
            
            // Create notification
            await NotificationService.notifyAchievement(userId, achievement);
          }
        }
      }

      return earnedAchievements;
    } catch (error) {
      console.error('Error checking user achievements:', error);
      return [];
    }
  }

  /**
   * Get user statistics for achievement checking
   */
  private static async getUserStats(userId: string): Promise<Record<string, number>> {
    try {
      const [
        { count: followsCount },
        { count: followersCount },
        { count: reviewsCount },
        { count: ratingsCount },
        { count: completedCount },
        { data: reviewLikes }
      ] = await Promise.all([
        supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
        supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('user_media').select('*', { count: 'exact', head: true }).eq('user_id', userId).not('rating', 'is', null),
        supabase.from('user_media').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'completed'),
        supabase.from('reviews').select('like_count').eq('user_id', userId)
      ]);

      const totalLikes = reviewLikes?.reduce((sum, review) => sum + (review.like_count || 0), 0) || 0;

      return {
        follows_count: followsCount || 0,
        followers_count: followersCount || 0,
        reviews_count: reviewsCount || 0,
        ratings_count: ratingsCount || 0,
        completed_count: completedCount || 0,
        review_likes_received: totalLikes
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {};
    }
  }

  /**
   * Check if user meets achievement requirements
   */
  private static checkAchievementRequirements(achievement: Achievement, stats: Record<string, number>): boolean {
    const requirements = achievement.requirements;

    for (const [key, value] of Object.entries(requirements)) {
      if (typeof value === 'number' && (stats[key] || 0) < value) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Email notification utilities
 */
export class EmailService {
  /**
   * Queue an email notification
   */
  static async queueEmail(userId: string, emailType: string, subject: string, content: string, templateData: Record<string, any> = {}): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('email_queue')
        .insert({
          user_id: userId,
          email_type: emailType,
          subject,
          content,
          template_data: templateData
        });

      if (error) {
        console.error('Error queuing email:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in queueEmail:', error);
      return false;
    }
  }

  /**
   * Process pending emails (would be called by a background job)
   */
  static async processPendingEmails(): Promise<void> {
    try {
      const { data: pendingEmails } = await supabase
        .from('email_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_for', new Date().toISOString())
        .limit(10);

      if (!pendingEmails?.length) return;

      for (const email of pendingEmails) {
        try {
          // Here you would integrate with your email service (SendGrid, AWS SES, etc.)
          // For now, just mark as sent
          await supabase
            .from('email_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', email.id);

          console.log(`Email sent to user ${email.user_id}: ${email.subject}`);
        } catch (emailError) {
          console.error('Error sending email:', emailError);
          
          // Update attempts and mark as failed if max attempts reached
          const newAttempts = email.attempts + 1;
          await supabase
            .from('email_queue')
            .update({
              attempts: newAttempts,
              status: newAttempts >= email.max_attempts ? 'failed' : 'pending',
              error_message: emailError.message,
              scheduled_for: new Date(Date.now() + (newAttempts * 60000)).toISOString() // Retry with backoff
            })
            .eq('id', email.id);
        }
      }
    } catch (error) {
      console.error('Error processing pending emails:', error);
    }
  }
}