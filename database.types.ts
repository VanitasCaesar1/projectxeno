export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      // Legacy tables (keeping for backward compatibility)
      Anime: {
        Row: {
          aired: string | null
          aired_string: string | null
          airing: boolean | null
          anime_id: number
          duration: string | null
          episodes: string | null
          genre: string | null
          licensor: string | null
          producer: string | null
          rating: string | null
          related: string | null
          source: string | null
          status: string | null
          studio: string | null
          title: string
          type: string | null
        }
        Insert: {
          aired?: string | null
          aired_string?: string | null
          airing?: boolean | null
          anime_id: number
          duration?: string | null
          episodes?: string | null
          genre?: string | null
          licensor?: string | null
          producer?: string | null
          rating?: string | null
          related?: string | null
          source?: string | null
          status?: string | null
          studio?: string | null
          title: string
          type?: string | null
        }
        Update: {
          aired?: string | null
          aired_string?: string | null
          airing?: boolean | null
          anime_id?: number
          duration?: string | null
          episodes?: string | null
          genre?: string | null
          licensor?: string | null
          producer?: string | null
          rating?: string | null
          related?: string | null
          source?: string | null
          status?: string | null
          studio?: string | null
          title?: string
          type?: string | null
        }
        Relationships: []
      }
      Books: {
        Row: {
          author: string | null
          awards: string | null
          bookId: string
          characters: string | null
          description: string | null
          firstPublishDate: string | null
          genres: string | null
          isbn: string | null
          language: string | null
          pages: string | null
          publishDate: string | null
          publisher: string | null
          series: string | null
          title: string
        }
        Insert: {
          author?: string | null
          awards?: string | null
          bookId: string
          characters?: string | null
          description?: string | null
          firstPublishDate?: string | null
          genres?: string | null
          isbn?: string | null
          language?: string | null
          pages?: string | null
          publishDate?: string | null
          publisher?: string | null
          series?: string | null
          title: string
        }
        Update: {
          author?: string | null
          awards?: string | null
          bookId?: string
          characters?: string | null
          description?: string | null
          firstPublishDate?: string | null
          genres?: string | null
          isbn?: string | null
          language?: string | null
          pages?: string | null
          publishDate?: string | null
          publisher?: string | null
          series?: string | null
          title?: string
        }
        Relationships: []
      }
      Movies: {
        Row: {
          Budget: number | null
          "Color/B&W": string | null
          Country: string | null
          "Director Name": string | null
          "Duration (min)": number | null
          Genre: string | null
          "Gross Revenue": number | null
          Language: string | null
          "Lead Actor": string | null
          "Release Date": string | null
          Title: string
        }
        Insert: {
          Budget?: number | null
          "Color/B&W"?: string | null
          Country?: string | null
          "Director Name"?: string | null
          "Duration (min)"?: number | null
          Genre?: string | null
          "Gross Revenue"?: number | null
          Language?: string | null
          "Lead Actor"?: string | null
          "Release Date"?: string | null
          Title: string
        }
        Update: {
          Budget?: number | null
          "Color/B&W"?: string | null
          Country?: string | null
          "Director Name"?: string | null
          "Duration (min)"?: number | null
          Genre?: string | null
          "Gross Revenue"?: number | null
          Language?: string | null
          "Lead Actor"?: string | null
          "Release Date"?: string | null
          Title?: string
        }
        Relationships: []
      }
      // New enhanced schema tables
      user_profiles: {
        Row: {
          id: string
          username: string
          display_name: string | null
          bio: string | null
          avatar_url: string | null
          privacy_level: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          display_name?: string | null
          bio?: string | null
          avatar_url?: string | null
          privacy_level?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string
          display_name?: string | null
          bio?: string | null
          avatar_url?: string | null
          privacy_level?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          user_id: string
          email_notifications: boolean
          public_lists: boolean
          public_ratings: boolean
          public_activity: boolean
          preferred_language: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          email_notifications?: boolean
          public_lists?: boolean
          public_ratings?: boolean
          public_activity?: boolean
          preferred_language?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          email_notifications?: boolean
          public_lists?: boolean
          public_ratings?: boolean
          public_activity?: boolean
          preferred_language?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      media_items: {
        Row: {
          id: string
          external_id: string
          media_type: string
          title: string
          description: string | null
          poster_url: string | null
          release_date: string | null
          genres: string[] | null
          metadata: Json
          average_rating: number
          rating_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          external_id: string
          media_type: string
          title: string
          description?: string | null
          poster_url?: string | null
          release_date?: string | null
          genres?: string[] | null
          metadata?: Json
          average_rating?: number
          rating_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          external_id?: string
          media_type?: string
          title?: string
          description?: string | null
          poster_url?: string | null
          release_date?: string | null
          genres?: string[] | null
          metadata?: Json
          average_rating?: number
          rating_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_media: {
        Row: {
          id: string
          user_id: string
          media_id: string
          status: string
          rating: number | null
          review: string | null
          progress: number
          started_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          media_id: string
          status: string
          rating?: number | null
          review?: string | null
          progress?: number
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          media_id?: string
          status?: string
          rating?: number | null
          review?: string | null
          progress?: number
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_media_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          }
        ]
      }
      reviews: {
        Row: {
          id: string
          user_id: string
          media_id: string
          rating: number | null
          title: string | null
          content: string
          spoiler_warning: boolean
          like_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          media_id: string
          rating?: number | null
          title?: string | null
          content: string
          spoiler_warning?: boolean
          like_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          media_id?: string
          rating?: number | null
          title?: string | null
          content?: string
          spoiler_warning?: boolean
          like_count?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          }
        ]
      }
      review_likes: {
        Row: {
          id: string
          user_id: string
          review_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          review_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          review_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_likes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          }
        ]
      }
      user_follows: {
        Row: {
          id: string
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          id?: string
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: {
          id?: string
          follower_id?: string
          following_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      user_activities: {
        Row: {
          id: string
          user_id: string
          activity_type: string
          media_id: string | null
          target_user_id: string | null
          review_id: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          activity_type: string
          media_id?: string | null
          target_user_id?: string | null
          review_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          activity_type?: string
          media_id?: string | null
          target_user_id?: string | null
          review_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activities_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activities_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activities_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          }
        ]
      }
      content_reports: {
        Row: {
          id: string
          reporter_id: string
          report_type: string
          content_type: string
          content_id: string | null
          content_url: string | null
          description: string
          status: string
          moderator_id: string | null
          moderator_notes: string | null
          resolved_at: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reporter_id: string
          report_type: string
          content_type: string
          content_id?: string | null
          content_url?: string | null
          description: string
          status?: string
          moderator_id?: string | null
          moderator_notes?: string | null
          resolved_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          reporter_id?: string
          report_type?: string
          content_type?: string
          content_id?: string | null
          content_url?: string | null
          description?: string
          status?: string
          moderator_id?: string | null
          moderator_notes?: string | null
          resolved_at?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      saved_searches: {
        Row: {
          id: string
          user_id: string
          name: string
          query: string
          filters: Json
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          query: string
          filters?: Json
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          query?: string
          filters?: Json
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      search_history: {
        Row: {
          id: string
          user_id: string
          query: string
          filters: Json
          results_count: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          query: string
          filters?: Json
          results_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          query?: string
          filters?: Json
          results_count?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      search_suggestions: {
        Row: {
          id: string
          query: string
          search_count: number
          last_searched: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          query: string
          search_count?: number
          last_searched?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          query?: string
          search_count?: number
          last_searched?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          message: string
          data: Json
          read: boolean
          action_url: string | null
          created_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          message: string
          data?: Json
          read?: boolean
          action_url?: string | null
          created_at?: string
          expires_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string
          data?: Json
          read?: boolean
          action_url?: string | null
          created_at?: string
          expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      achievements: {
        Row: {
          id: string
          key: string
          name: string
          description: string
          icon: string | null
          category: string
          points: number
          rarity: string
          requirements: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          name: string
          description: string
          icon?: string | null
          category: string
          points?: number
          rarity?: string
          requirements: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          name?: string
          description?: string
          icon?: string | null
          category?: string
          points?: number
          rarity?: string
          requirements?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          id: string
          user_id: string
          achievement_id: string
          unlocked_at: string
          progress: Json
        }
        Insert: {
          id?: string
          user_id: string
          achievement_id: string
          unlocked_at?: string
          progress?: Json
        }
        Update: {
          id?: string
          user_id?: string
          achievement_id?: string
          unlocked_at?: string
          progress?: Json
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          }
        ]
      }
      notification_preferences: {
        Row: {
          user_id: string
          email_notifications: boolean
          push_notifications: boolean
          likes_notifications: boolean
          follows_notifications: boolean
          reviews_notifications: boolean
          achievements_notifications: boolean
          system_notifications: boolean
          email_frequency: string
          digest_time: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          email_notifications?: boolean
          push_notifications?: boolean
          likes_notifications?: boolean
          follows_notifications?: boolean
          reviews_notifications?: boolean
          achievements_notifications?: boolean
          system_notifications?: boolean
          email_frequency?: string
          digest_time?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          email_notifications?: boolean
          push_notifications?: boolean
          likes_notifications?: boolean
          follows_notifications?: boolean
          reviews_notifications?: boolean
          achievements_notifications?: boolean
          system_notifications?: boolean
          email_frequency?: string
          digest_time?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      email_queue: {
        Row: {
          id: string
          user_id: string
          email_type: string
          subject: string
          content: string
          template_data: Json
          status: string
          attempts: number
          max_attempts: number
          scheduled_for: string
          sent_at: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email_type: string
          subject: string
          content: string
          template_data?: Json
          status?: string
          attempts?: number
          max_attempts?: number
          scheduled_for?: string
          sent_at?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email_type?: string
          subject?: string
          content?: string
          template_data?: Json
          status?: string
          attempts?: number
          max_attempts?: number
          scheduled_for?: string
          sent_at?: string | null
          error_message?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never
