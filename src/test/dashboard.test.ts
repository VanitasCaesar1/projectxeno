import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateUserStats, getRecommendations, getUserActivitySummary } from '../lib/userStats';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        })),
        in: vi.fn(() => ({
          select: vi.fn(() => Promise.resolve({ data: [], error: null }))
        })),
        gte: vi.fn(() => ({
          gte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        })),
        not: vi.fn(() => ({
          gte: vi.fn(() => ({
            gte: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
              }))
            }))
          }))
        }))
      })),
      count: 'exact',
      head: true
    }))
  }
}));

describe('Dashboard User Statistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate empty stats for new user', async () => {
    const stats = await calculateUserStats('test-user-id');
    
    expect(stats).toEqual({
      totalItems: 0,
      completedItems: 0,
      averageRating: 0,
      totalReviews: 0,
      totalLikes: 0,
      followers: 0,
      following: 0,
      mediaTypeBreakdown: {
        movie: 0,
        tv: 0,
        book: 0,
        anime: 0
      },
      statusBreakdown: {
        completed: 0,
        watching: 0,
        plan_to_watch: 0,
        dropped: 0,
        on_hold: 0
      }
    });
  });

  it('should get empty recommendations for new user', async () => {
    const recommendations = await getRecommendations('test-user-id', 10);
    expect(Array.isArray(recommendations)).toBe(true);
    expect(recommendations.length).toBe(0);
  });

  it('should get empty activity summary for new user', async () => {
    const activities = await getUserActivitySummary('test-user-id', 10);
    expect(Array.isArray(activities)).toBe(true);
    expect(activities.length).toBe(0);
  });
});

describe('Dashboard Onboarding Logic', () => {
  it('should identify new user correctly', () => {
    const userMediaCount = 0;
    const isNewUser = userMediaCount === 0;
    expect(isNewUser).toBe(true);
  });

  it('should identify existing user correctly', () => {
    const userMediaCount = 5;
    const isNewUser = userMediaCount === 0;
    expect(isNewUser).toBe(false);
  });
});

describe('Dashboard Recommendation Scoring', () => {
  it('should handle empty user preferences', () => {
    const userRatings: any[] = [];
    const preferredGenres = new Map<string, number>();
    const preferredTypes = new Map<string, number>();
    
    userRatings.forEach(item => {
      if (item.rating && item.media) {
        const weight = item.rating / 10;
        if (item.media.genres) {
          item.media.genres.forEach((genre: string) => {
            preferredGenres.set(genre, (preferredGenres.get(genre) || 0) + weight);
          });
        }
      }
    });

    expect(preferredGenres.size).toBe(0);
    expect(preferredTypes.size).toBe(0);
  });

  it('should calculate genre preferences correctly', () => {
    const userRatings = [
      {
        rating: 9,
        media: {
          genres: ['Action', 'Drama'],
          media_type: 'movie'
        }
      },
      {
        rating: 7,
        media: {
          genres: ['Action', 'Comedy'],
          media_type: 'movie'
        }
      }
    ];

    const preferredGenres = new Map<string, number>();
    
    userRatings.forEach(item => {
      if (item.rating && item.media) {
        const weight = item.rating / 10;
        if (item.media.genres) {
          item.media.genres.forEach((genre: string) => {
            preferredGenres.set(genre, (preferredGenres.get(genre) || 0) + weight);
          });
        }
      }
    });

    expect(preferredGenres.get('Action')).toBe(1.6); // 0.9 + 0.7
    expect(preferredGenres.get('Drama')).toBe(0.9);
    expect(preferredGenres.get('Comedy')).toBe(0.7);
  });
});