import type { Database } from '../../database.types';

// Database table types
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type UserPreferences = Database['public']['Tables']['user_preferences']['Row'];
export type MediaItem = Database['public']['Tables']['media_items']['Row'];
export type UserMedia = Database['public']['Tables']['user_media']['Row'];
export type Review = Database['public']['Tables']['reviews']['Row'];
export type ReviewLike = Database['public']['Tables']['review_likes']['Row'];
export type UserFollow = Database['public']['Tables']['user_follows']['Row'];
export type UserActivity = Database['public']['Tables']['user_activities']['Row'];
export type SavedSearch = Database['public']['Tables']['saved_searches']['Row'];
export type SearchHistory = Database['public']['Tables']['search_history']['Row'];
export type SearchSuggestion = Database['public']['Tables']['search_suggestions']['Row'];

// Insert types
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert'];
export type UserPreferencesInsert = Database['public']['Tables']['user_preferences']['Insert'];
export type MediaItemInsert = Database['public']['Tables']['media_items']['Insert'];
export type UserMediaInsert = Database['public']['Tables']['user_media']['Insert'];
export type ReviewInsert = Database['public']['Tables']['reviews']['Insert'];
export type ReviewLikeInsert = Database['public']['Tables']['review_likes']['Insert'];
export type UserFollowInsert = Database['public']['Tables']['user_follows']['Insert'];
export type UserActivityInsert = Database['public']['Tables']['user_activities']['Insert'];
export type SavedSearchInsert = Database['public']['Tables']['saved_searches']['Insert'];
export type SearchHistoryInsert = Database['public']['Tables']['search_history']['Insert'];
export type SearchSuggestionInsert = Database['public']['Tables']['search_suggestions']['Insert'];

// Update types
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];
export type UserPreferencesUpdate = Database['public']['Tables']['user_preferences']['Update'];
export type MediaItemUpdate = Database['public']['Tables']['media_items']['Update'];
export type UserMediaUpdate = Database['public']['Tables']['user_media']['Update'];
export type ReviewUpdate = Database['public']['Tables']['reviews']['Update'];
export type SavedSearchUpdate = Database['public']['Tables']['saved_searches']['Update'];

// Enums and constants
export const MEDIA_TYPES = ['movie', 'tv', 'book', 'anime', 'manga'] as const;
export type MediaType = typeof MEDIA_TYPES[number];

export const USER_MEDIA_STATUSES = [
  'completed', 
  'watching', 
  'plan_to_watch', 
  'dropped', 
  'on_hold'
] as const;
export type UserMediaStatus = typeof USER_MEDIA_STATUSES[number];

export const PRIVACY_LEVELS = ['public', 'private', 'friends'] as const;
export type PrivacyLevel = typeof PRIVACY_LEVELS[number];

export const ACTIVITY_TYPES = [
  'added_to_list',
  'completed_media',
  'rated_media',
  'reviewed_media',
  'liked_review',
  'followed_user',
  'updated_status'
] as const;
export type ActivityType = typeof ACTIVITY_TYPES[number];

// Extended types with relationships
export interface UserProfileWithPreferences extends UserProfile {
  preferences?: UserPreferences;
}

export interface MediaItemWithUserData extends MediaItem {
  userMedia?: UserMedia;
  userReview?: Review;
}

export interface ReviewWithUser extends Review {
  user: UserProfile;
  media: MediaItem;
  isLikedByCurrentUser?: boolean;
}

export interface UserMediaWithMedia extends UserMedia {
  media: MediaItem;
}

export interface UserActivityWithRelations extends UserActivity {
  user: UserProfile;
  media?: MediaItem;
  targetUser?: UserProfile;
  review?: Review;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Search and filter types
export interface SearchFilters {
  mediaType?: MediaType;
  genre?: string[];
  yearFrom?: number;
  yearTo?: number;
  ratingFrom?: number;
  ratingTo?: number;
  status?: UserMediaStatus;
  sortBy?: 'relevance' | 'rating' | 'year' | 'title' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

export interface AdvancedSearchFilters extends SearchFilters {
  includeAdult?: boolean;
  language?: string;
  country?: string;
  runtime?: {
    min?: number;
    max?: number;
  };
}

export interface SearchResult {
  id: string;
  externalId: string;
  mediaType: MediaType;
  title: string;
  description?: string;
  posterUrl?: string;
  releaseDate?: string;
  genres: string[];
  averageRating: number;
  ratingCount: number;
}

// User statistics
export interface UserStats {
  totalItems: number;
  completedItems: number;
  averageRating: number;
  totalReviews: number;
  totalLikes: number;
  followers: number;
  following: number;
  mediaTypeBreakdown: Record<MediaType, number>;
  statusBreakdown: Record<UserMediaStatus, number>;
}

// External API types (for integration with TMDB, Open Library, etc.)
export interface ExternalMediaItem {
  id: string;
  title: string;
  description?: string;
  posterUrl?: string;
  releaseDate?: string;
  genres: string[];
  metadata: Record<string, any>;
}

// Form types
export interface UserRegistrationForm {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
  displayName?: string;
}

export interface UserLoginForm {
  email: string;
  password: string;
}

export interface ReviewForm {
  rating?: number;
  title?: string;
  content: string;
  spoilerWarning: boolean;
}

export interface UserProfileForm {
  username: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  privacyLevel: PrivacyLevel;
}

export interface UserPreferencesForm {
  emailNotifications: boolean;
  publicLists: boolean;
  publicRatings: boolean;
  preferredLanguage: string;
}

// Search-related types
export interface SavedSearchForm {
  name: string;
  query: string;
  filters: SearchFilters;
  isPublic: boolean;
}

export interface SavedSearchWithUser extends SavedSearch {
  user: UserProfile;
}

export interface SearchHistoryWithFilters extends SearchHistory {
  parsedFilters: SearchFilters;
}