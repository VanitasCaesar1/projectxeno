// Simple in-memory cache with TTL support for external API responses
// In production, this should be replaced with Redis or similar

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  set<T>(key: string, data: T, ttlSeconds: number = 300): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache stats
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        age: Date.now() - entry.timestamp,
        ttl: entry.ttl,
        expired: Date.now() - entry.timestamp > entry.ttl
      }))
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Global cache instance
export const apiCache = new MemoryCache();

// Cache key generators
export const cacheKeys = {
  tmdbSearch: (query: string, page: number) => `tmdb:search:${query}:${page}`,
  tmdbMovie: (id: string) => `tmdb:movie:${id}`,
  tmdbTv: (id: string) => `tmdb:tv:${id}`,
  openLibrarySearch: (query: string, page: number) => `ol:search:${query}:${page}`,
  openLibraryBook: (id: string) => `ol:book:${id}`,
  jikanSearch: (query: string, page: number) => `jikan:search:${query}:${page}`,
  jikanAnime: (id: string) => `jikan:anime:${id}`,
  jikanManga: (id: string) => `jikan:manga:${id}`,
  popularMedia: (type?: string) => `popular:${type || 'all'}`,
  userStats: (userId: string) => `user:stats:${userId}`,
  mediaDetails: (externalId: string, type: string) => `media:${type}:${externalId}`
};

// Cache TTL constants (in seconds)
export const cacheTTL = {
  search: 300, // 5 minutes for search results
  mediaDetails: 3600, // 1 hour for media details
  popularMedia: 1800, // 30 minutes for popular media
  userStats: 600, // 10 minutes for user stats
  externalApi: 900 // 15 minutes for external API responses
};

// Enhanced cached fetch wrapper with performance optimizations
export async function cachedFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = cacheTTL.externalApi,
  options: {
    staleWhileRevalidate?: boolean;
    backgroundRefresh?: boolean;
    retryAttempts?: number;
  } = {}
): Promise<T> {
  const { 
    staleWhileRevalidate = true, 
    backgroundRefresh = false,
    retryAttempts = 2 
  } = options;

  // Try to get from cache first
  const cached = apiCache.get<T>(key);
  if (cached !== null) {
    // If background refresh is enabled and data is getting stale, refresh in background
    if (backgroundRefresh) {
      const entry = apiCache['cache'].get(key);
      if (entry && (Date.now() - entry.timestamp) > (entry.ttl * 0.8)) {
        // Refresh in background without blocking
        setTimeout(async () => {
          try {
            const freshData = await fetchFn();
            apiCache.set(key, freshData, ttlSeconds);
          } catch (error) {
            console.warn(`Background refresh failed for key: ${key}`, error);
          }
        }, 0);
      }
    }
    
    // Record cache hit for performance monitoring
    if (typeof window !== 'undefined' && window.performanceMonitor) {
      window.performanceMonitor.recordCacheHit(true);
    }
    
    return cached;
  }

  // Record cache miss
  if (typeof window !== 'undefined' && window.performanceMonitor) {
    window.performanceMonitor.recordCacheHit(false);
  }

  // Fetch fresh data with retry logic
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    try {
      const startTime = performance.now();
      const data = await fetchFn();
      const fetchTime = performance.now() - startTime;
      
      // Record API response time
      if (typeof window !== 'undefined' && window.performanceMonitor) {
        window.performanceMonitor.recordApiResponse(key, fetchTime);
      }
      
      apiCache.set(key, data, ttlSeconds);
      return data;
    } catch (error) {
      lastError = error as Error;
      
      // If not the last attempt, wait before retrying
      if (attempt < retryAttempts) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // If all retries failed and stale-while-revalidate is enabled, try to return stale data
  if (staleWhileRevalidate) {
    const staleData = apiCache.get<T>(key);
    if (staleData !== null) {
      console.warn(`Using stale cache data for key: ${key}`, lastError);
      return staleData;
    }
  }

  throw lastError || new Error('Failed to fetch data');
}

// Batch cache operations
export function setCacheMultiple<T>(entries: Array<{ key: string; data: T; ttl?: number }>): void {
  entries.forEach(({ key, data, ttl = cacheTTL.externalApi }) => {
    apiCache.set(key, data, ttl);
  });
}

export function getCacheMultiple<T>(keys: string[]): Array<{ key: string; data: T | null }> {
  return keys.map(key => ({
    key,
    data: apiCache.get<T>(key)
  }));
}

// Enhanced cache warming functions with performance optimizations
export async function warmSearchCache(popularQueries: string[]): Promise<void> {
  console.log('Warming search cache...');
  
  const maxConcurrent = 3; // Limit concurrent requests
  const chunks = [];
  
  // Split queries into chunks for controlled concurrency
  for (let i = 0; i < popularQueries.length; i += maxConcurrent) {
    chunks.push(popularQueries.slice(i, i + maxConcurrent));
  }
  
  for (const chunk of chunks) {
    const warmPromises = chunk.map(async (query) => {
      try {
        // Warm cache for different media types
        const mediaTypes = ['movie', 'tv', 'book', 'anime'];
        
        for (const mediaType of mediaTypes) {
          const cacheKey = cacheKeys.tmdbSearch(query, 1);
          
          // Only warm if not already cached
          if (!apiCache.has(cacheKey)) {
            // Simulate search API call - in real implementation, this would call the actual search
            const searchParams = new URLSearchParams({
              q: query,
              type: mediaType,
              page: '1'
            });
            
            try {
              const response = await fetch(`/api/search?${searchParams}`);
              if (response.ok) {
                const data = await response.json();
                if (data.success) {
                  apiCache.set(cacheKey, data.data, cacheTTL.search);
                }
              }
            } catch (fetchError) {
              console.warn(`Failed to warm cache for ${query} (${mediaType}):`, fetchError);
            }
          }
        }
        
        console.log(`Warmed cache for query: ${query}`);
      } catch (error) {
        console.warn(`Failed to warm cache for query: ${query}`, error);
      }
    });

    await Promise.allSettled(warmPromises);
    
    // Small delay between chunks to avoid overwhelming the server
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log('Search cache warming completed');
}

// Preload critical content for category pages
export async function preloadCategoryContent(mediaType: string): Promise<void> {
  console.log(`Preloading ${mediaType} content...`);
  
  const sections = ['popular', 'trending', 'top_rated'];
  const preloadPromises = sections.map(async (section) => {
    const cacheKey = `${mediaType}:${section}:1`;
    
    if (!apiCache.has(cacheKey)) {
      try {
        const searchParams = new URLSearchParams({
          q: section,
          type: mediaType,
          page: '1'
        });
        
        const response = await fetch(`/api/search?${searchParams}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            apiCache.set(cacheKey, data.data, cacheTTL.popularMedia);
          }
        }
      } catch (error) {
        console.warn(`Failed to preload ${section} ${mediaType} content:`, error);
      }
    }
  });
  
  await Promise.allSettled(preloadPromises);
  console.log(`${mediaType} content preloading completed`);
}

// Cache invalidation helpers
export function invalidateUserCache(userId: string): void {
  const userStatsKey = cacheKeys.userStats(userId);
  apiCache.delete(userStatsKey);
}

export function invalidateMediaCache(externalId: string, type: string): void {
  const mediaKey = cacheKeys.mediaDetails(externalId, type);
  apiCache.delete(mediaKey);
  
  // Also invalidate popular media cache as ratings might have changed
  apiCache.delete(cacheKeys.popularMedia());
  apiCache.delete(cacheKeys.popularMedia(type));
}

// Export cache instance for direct access if needed
export { MemoryCache };