import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../database.types";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseKey = import.meta.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Helper functions for common database operations
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

export async function getCurrentUserProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select(`
      *,
      preferences:user_preferences(*)
    `)
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return profile;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Database helper functions
export const db = {
  // User operations
  users: {
    getProfile: async (userId: string) => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data;
    },

    updateProfile: async (userId: string, updates: any) => {
      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    getPreferences: async (userId: string) => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) throw error;
      return data;
    },

    updatePreferences: async (userId: string, updates: any) => {
      const { data, error } = await supabase
        .from('user_preferences')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  },

  // Media operations
  media: {
    getItem: async (mediaId: string) => {
      const { data, error } = await supabase
        .from('media_items')
        .select('*')
        .eq('id', mediaId)
        .single();
      
      if (error) throw error;
      return data;
    },

    createItem: async (mediaData: any) => {
      const { data, error } = await supabase
        .from('media_items')
        .insert(mediaData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    search: async (query: string, mediaType?: string) => {
      let queryBuilder = supabase
        .from('media_items')
        .select('*')
        .textSearch('title', query);

      if (mediaType) {
        queryBuilder = queryBuilder.eq('media_type', mediaType);
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;
      return data;
    }
  },

  // User media operations
  userMedia: {
    getUserLists: async (userId: string, status?: string) => {
      let queryBuilder = supabase
        .from('user_media')
        .select(`
          *,
          media:media_items(*)
        `)
        .eq('user_id', userId);

      if (status) {
        queryBuilder = queryBuilder.eq('status', status);
      }

      const { data, error } = await queryBuilder.order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },

    getUserMediaStatus: async (userId: string, externalIds: string[], mediaType?: string) => {
      let queryBuilder = supabase
        .from('user_media')
        .select(`
          status,
          media:media_items!inner(external_id, media_type)
        `)
        .eq('user_id', userId)
        .in('media.external_id', externalIds);

      if (mediaType) {
        queryBuilder = queryBuilder.eq('media.media_type', mediaType);
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;
      
      // Create a map of external_id -> status for easy lookup
      const statusMap: Record<string, string> = {};
      data?.forEach(item => {
        if (item.media?.external_id) {
          statusMap[item.media.external_id] = item.status;
        }
      });
      
      return statusMap;
    },

    getUserMediaByExternalId: async (userId: string, externalId: string, mediaType: string) => {
      const { data, error } = await supabase
        .from('user_media')
        .select(`
          *,
          media:media_items!inner(*)
        `)
        .eq('user_id', userId)
        .eq('media.external_id', externalId)
        .eq('media.media_type', mediaType)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"
      return data;
    },

    addToList: async (userId: string, mediaId: string, status: string) => {
      const { data, error } = await supabase
        .from('user_media')
        .upsert({
          user_id: userId,
          media_id: mediaId,
          status: status
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    updateStatus: async (userId: string, mediaId: string, updates: any) => {
      const { data, error } = await supabase
        .from('user_media')
        .update(updates)
        .eq('user_id', userId)
        .eq('media_id', mediaId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    removeFromList: async (userId: string, mediaId: string) => {
      const { error } = await supabase
        .from('user_media')
        .delete()
        .eq('user_id', userId)
        .eq('media_id', mediaId);
      
      if (error) throw error;
    }
  },

  // Review operations
  reviews: {
    getForMedia: async (mediaId: string) => {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          user:user_profiles(id, username, display_name, avatar_url)
        `)
        .eq('media_id', mediaId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },

    create: async (reviewData: any) => {
      const { data, error } = await supabase
        .from('reviews')
        .insert(reviewData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    update: async (reviewId: string, updates: any) => {
      const { data, error } = await supabase
        .from('reviews')
        .update(updates)
        .eq('id', reviewId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    delete: async (reviewId: string) => {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId);
      
      if (error) throw error;
    },

    toggleLike: async (userId: string, reviewId: string) => {
      // Check if like exists
      const { data: existingLike } = await supabase
        .from('review_likes')
        .select('id')
        .eq('user_id', userId)
        .eq('review_id', reviewId)
        .single();

      if (existingLike) {
        // Remove like
        const { error } = await supabase
          .from('review_likes')
          .delete()
          .eq('user_id', userId)
          .eq('review_id', reviewId);
        
        if (error) throw error;
        return false; // unliked
      } else {
        // Add like
        const { error } = await supabase
          .from('review_likes')
          .insert({
            user_id: userId,
            review_id: reviewId
          });
        
        if (error) throw error;
        return true; // liked
      }
    }
  },

  // Activity operations
  activities: {
    getUserFeed: async (userId: string, limit = 20) => {
      const { data, error } = await supabase
        .from('user_activities')
        .select(`
          *,
          user:user_profiles(id, username, display_name, avatar_url),
          media:media_items(id, title, poster_url, media_type),
          target_user:user_profiles!user_activities_target_user_id_fkey(id, username, display_name, avatar_url),
          review:reviews(id, title, content)
        `)
        .or(`user_id.eq.${userId},user_id.in.(select following_id from user_follows where follower_id = ${userId})`)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data;
    }
  }
};