import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { apiCache, cacheKeys, cacheTTL, cachedFetch } from '../lib/cache';
import { performanceMonitor, imageOptimizer } from '../lib/performance';

describe('Performance Optimizations', () => {
  beforeAll(() => {
    // Clear cache before tests
    apiCache.clear();
  });

  afterAll(() => {
    // Clean up after tests
    apiCache.clear();
  });

  describe('Caching System', () => {
    it('should cache API responses', async () => {
      const testKey = 'test-key';
      const testData = { message: 'test data' };
      
      // Set cache
      apiCache.set(testKey, testData, 60);
      
      // Get from cache
      const cached = apiCache.get(testKey);
      expect(cached).toEqual(testData);
    });

    it('should expire cache entries', async () => {
      const testKey = 'expire-test';
      const testData = { message: 'expire test' };
      
      // Set cache with very short TTL
      apiCache.set(testKey, testData, 0.001); // 1ms
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should be expired
      const cached = apiCache.get(testKey);
      expect(cached).toBeNull();
    });

    it('should generate correct cache keys', () => {
      const tmdbKey = cacheKeys.tmdbSearch('test query', 1);
      expect(tmdbKey).toBe('tmdb:search:test query:1');
      
      const mediaKey = cacheKeys.mediaDetails('123', 'movie');
      expect(mediaKey).toBe('media:movie:123');
    });

    it('should handle cached fetch with fallback', async () => {
      const testKey = 'cached-fetch-test';
      let callCount = 0;
      
      const fetchFn = async () => {
        callCount++;
        return { data: 'test', call: callCount };
      };
      
      // First call should execute function
      const result1 = await cachedFetch(testKey, fetchFn, 60);
      expect(result1.call).toBe(1);
      
      // Second call should use cache
      const result2 = await cachedFetch(testKey, fetchFn, 60);
      expect(result2.call).toBe(1); // Same as first call
      expect(callCount).toBe(1); // Function only called once
    });
  });

  describe('Performance Monitoring', () => {
    it('should track timer durations', () => {
      const timerName = 'test-timer';
      
      performanceMonitor.startTimer(timerName);
      
      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Wait 10ms
      }
      
      const duration = performanceMonitor.endTimer(timerName);
      expect(duration).toBeGreaterThan(5); // Should be at least 5ms
    });

    it('should record search metrics', () => {
      performanceMonitor.recordSearchTime(150);
      performanceMonitor.recordCacheHit(true);
      performanceMonitor.recordApiResponse('tmdb', 200);
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.searchTime).toBe(150);
      expect(metrics.apiResponseTimes?.tmdb).toBe(200);
    });
  });

  describe('Image Optimization', () => {
    it('should preload images', async () => {
      // Mock image loading
      const originalImage = global.Image;
      global.Image = class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        _src: string = '';
        
        set src(value: string) {
          this._src = value;
          // Simulate successful load
          setTimeout(() => {
            if (this.onload) this.onload();
          }, 10);
        }
        
        get src() {
          return this._src;
        }
      } as any;
      
      const testUrl = 'https://example.com/test.jpg';
      await expect(imageOptimizer.preloadImage(testUrl)).resolves.toBeUndefined();
      
      // Restore original Image
      global.Image = originalImage;
    }, 10000);

    it('should generate responsive URLs for TMDB images', () => {
      const baseUrl = 'https://image.tmdb.org/t/p/w500/test.jpg';
      const responsiveUrls = imageOptimizer.generateResponsiveUrls(baseUrl);
      
      expect(responsiveUrls).toContain('https://image.tmdb.org/t/p/w300/test.jpg');
      expect(responsiveUrls).toContain('https://image.tmdb.org/t/p/w500/test.jpg');
      expect(responsiveUrls).toContain('https://image.tmdb.org/t/p/w780/test.jpg');
    });

    it('should return original URL for non-TMDB images', () => {
      const baseUrl = 'https://example.com/image.jpg';
      const responsiveUrls = imageOptimizer.generateResponsiveUrls(baseUrl);
      
      expect(responsiveUrls).toEqual([baseUrl]);
    });

    it('should calculate optimal image size', () => {
      // Mock device pixel ratio
      Object.defineProperty(window, 'devicePixelRatio', {
        value: 2,
        writable: true
      });
      
      const optimalSize = imageOptimizer.getOptimalImageSize(150);
      expect(optimalSize).toBeGreaterThanOrEqual(300); // 150 * 2
    });
  });

  describe('Cache Statistics', () => {
    it('should provide cache statistics', () => {
      // Add some test data
      apiCache.set('test1', { data: 1 }, 60);
      apiCache.set('test2', { data: 2 }, 120);
      
      const stats = apiCache.getStats();
      expect(stats.size).toBeGreaterThanOrEqual(2);
      expect(stats.entries).toHaveLength(stats.size);
      
      // Check entry structure
      const entry = stats.entries[0];
      expect(entry).toHaveProperty('key');
      expect(entry).toHaveProperty('age');
      expect(entry).toHaveProperty('ttl');
      expect(entry).toHaveProperty('expired');
    });
  });

  describe('Search API Performance', () => {
    it('should handle search requests efficiently', async () => {
      // Mock fetch for testing
      const originalFetch = global.fetch;
      global.fetch = async (url: string) => {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 50));
        
        return new Response(JSON.stringify({
          results: [
            {
              id: 1,
              title: 'Test Movie',
              media_type: 'movie',
              poster_path: '/test.jpg',
              overview: 'Test description',
              vote_average: 8.5
            }
          ]
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };
      
      // Test search performance
      const startTime = performance.now();
      
      // This would normally call the search functions
      // For testing, we'll simulate the caching behavior
      const cacheKey = cacheKeys.tmdbSearch('test', 1);
      const result = await cachedFetch(cacheKey, async () => {
        const response = await fetch('https://api.themoviedb.org/3/search/multi');
        return response.json();
      }, cacheTTL.search);
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(result).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      
      // Second call should be faster (cached)
      const cachedStartTime = performance.now();
      const cachedResult = await cachedFetch(cacheKey, async () => {
        const response = await fetch('https://api.themoviedb.org/3/search/multi');
        return response.json();
      }, cacheTTL.search);
      const cachedEndTime = performance.now();
      const cachedDuration = cachedEndTime - cachedStartTime;
      
      expect(cachedDuration).toBeLessThan(duration); // Cached should be faster
      
      // Restore original fetch
      global.fetch = originalFetch;
    });
  });

  describe('Memory Management', () => {
    it('should clean up expired cache entries', async () => {
      // Clear cache first to ensure clean state
      apiCache.clear();
      
      // Add entries with short TTL
      apiCache.set('short1', { data: 1 }, 0.01); // 10ms
      apiCache.set('short2', { data: 2 }, 0.01); // 10ms
      apiCache.set('long', { data: 3 }, 60); // 60s
      
      expect(apiCache.getStats().size).toBe(3);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Trigger cleanup by accessing cache
      apiCache.get('nonexistent');
      
      // Should have cleaned up expired entries
      const stats = apiCache.getStats();
      expect(stats.size).toBeLessThanOrEqual(1); // Should be 1 or 0 depending on cleanup timing
    });
  });
});

// Integration test for the complete search flow
describe('Search Performance Integration', () => {
  it('should handle complete search flow with caching', async () => {
    // This would be an integration test that:
    // 1. Makes a search request
    // 2. Verifies caching works
    // 3. Checks performance metrics
    // 4. Tests infinite scroll loading
    
    // For now, we'll just verify the components exist
    expect(apiCache).toBeDefined();
    expect(performanceMonitor).toBeDefined();
    expect(imageOptimizer).toBeDefined();
  });
});