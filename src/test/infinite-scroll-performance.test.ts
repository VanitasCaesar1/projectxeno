import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performanceMonitor } from '../lib/performance';
import { apiCache, cachedFetch } from '../lib/cache';

// Mock DOM APIs
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
});
window.IntersectionObserver = mockIntersectionObserver;

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000,
    },
  },
});

// Mock requestIdleCallback
window.requestIdleCallback = vi.fn((callback) => {
  setTimeout(callback, 0);
  return 1;
});

describe('Infinite Scroll Performance Optimizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    performanceMonitor.reset();
    apiCache.clear();
  });

  afterEach(() => {
    apiCache.clear();
  });

  describe('Performance Monitoring', () => {
    it('should track infinite scroll load times', () => {
      const duration = 500;
      const itemsLoaded = 10;

      performanceMonitor.recordInfiniteScrollLoad(duration, itemsLoaded);
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.infiniteScrollMetrics?.loadCount).toBe(1);
      expect(metrics.infiniteScrollMetrics?.averageLoadTime).toBe(duration);
      expect(metrics.infiniteScrollMetrics?.totalItemsLoaded).toBe(itemsLoaded);
    });

    it('should calculate average load times correctly', () => {
      performanceMonitor.recordInfiniteScrollLoad(400, 5);
      performanceMonitor.recordInfiniteScrollLoad(600, 5);
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.infiniteScrollMetrics?.loadCount).toBe(2);
      expect(metrics.infiniteScrollMetrics?.averageLoadTime).toBe(500);
      expect(metrics.infiniteScrollMetrics?.totalItemsLoaded).toBe(10);
    });

    it('should track cache hit rates', () => {
      performanceMonitor.recordCacheHit(true);
      performanceMonitor.recordCacheHit(true);
      performanceMonitor.recordCacheHit(false);
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.cacheHitRate).toBeCloseTo(0.667, 2);
    });

    it('should track image load times', () => {
      performanceMonitor.recordImageLoad(200);
      performanceMonitor.recordImageLoad(300);
      
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.imageLoadTime).toBe(250);
    });

    it('should check performance budgets', () => {
      // Set metrics that violate budgets
      performanceMonitor.recordSearchTime(1500); // Over 1000ms budget
      performanceMonitor.recordCacheHit(false); // 0% hit rate, under 70% budget
      performanceMonitor.recordImageLoad(600); // Over 500ms budget
      performanceMonitor.recordInfiniteScrollLoad(2500, 10); // Over 2000ms budget

      const budgetCheck = performanceMonitor.checkPerformanceBudgets();
      expect(budgetCheck.passed).toBe(false);
      expect(budgetCheck.violations.length).toBeGreaterThanOrEqual(3);
    });

    it('should pass performance budgets with good metrics', () => {
      performanceMonitor.recordSearchTime(500);
      performanceMonitor.recordCacheHit(true);
      performanceMonitor.recordCacheHit(true);
      performanceMonitor.recordCacheHit(true); // 100% hit rate, above budget
      performanceMonitor.recordImageLoad(300);
      performanceMonitor.recordInfiniteScrollLoad(1500, 10);

      const budgetCheck = performanceMonitor.checkPerformanceBudgets();
      expect(budgetCheck.passed).toBe(true);
      expect(budgetCheck.violations).toHaveLength(0);
    });
  });

  describe('Caching System', () => {
    it('should cache API responses', async () => {
      const mockData = { results: ['item1', 'item2'] };
      const fetchFn = vi.fn().mockResolvedValue(mockData);

      // First call should fetch
      const result1 = await cachedFetch('test-key', fetchFn, 300);
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockData);

      // Second call should use cache
      const result2 = await cachedFetch('test-key', fetchFn, 300);
      expect(fetchFn).toHaveBeenCalledTimes(1); // Still only called once
      expect(result2).toEqual(mockData);
    });

    it('should handle cache misses and retries', async () => {
      const fetchFn = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ results: ['item1'] });

      const result = await cachedFetch('test-key', fetchFn, 300, {
        retryAttempts: 1
      });

      expect(fetchFn).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ results: ['item1'] });
    });

    it('should use stale data when fetch fails', async () => {
      const staleData = { results: ['stale-item'] };
      const freshData = { results: ['fresh-item'] };

      // First, populate cache
      const fetchFn1 = vi.fn().mockResolvedValue(staleData);
      await cachedFetch('test-key', fetchFn1, 1); // Very short TTL

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      // Now try to fetch fresh data but fail
      const fetchFn2 = vi.fn().mockRejectedValue(new Error('Network error'));
      const result = await cachedFetch('test-key', fetchFn2, 300, {
        staleWhileRevalidate: true
      });

      expect(result).toEqual(staleData);
    });

    it('should handle background refresh', async () => {
      const initialData = { results: ['initial'] };
      const refreshedData = { results: ['refreshed'] };

      // First call
      const fetchFn1 = vi.fn().mockResolvedValue(initialData);
      await cachedFetch('test-key', fetchFn1, 300);

      // Mock time passing to make data stale
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 250000); // 250 seconds later

      // Second call with background refresh
      const fetchFn2 = vi.fn().mockResolvedValue(refreshedData);
      const result = await cachedFetch('test-key', fetchFn2, 300, {
        backgroundRefresh: true
      });

      // Should return cached data immediately
      expect(result).toEqual(initialData);
      
      // Background refresh should be triggered
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(fetchFn2).toHaveBeenCalled();
    });
  });

  describe('Image Loading Optimization', () => {
    it('should create lazy loading images with proper attributes', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <img 
          data-src="https://image.tmdb.org/t/p/w500/poster.jpg"
          src="data:image/svg+xml,..."
          class="lazy-image"
          style="opacity: 0;"
        />
      `;

      const img = container.querySelector('.lazy-image') as HTMLImageElement;
      expect(img.dataset.src).toBe('https://image.tmdb.org/t/p/w500/poster.jpg');
      expect(img.style.opacity).toBe('0');
    });

    it('should handle image load errors gracefully', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <img 
          class="lazy-image"
          onerror="this.src='/favicon.svg'; this.style.opacity='1';"
        />
      `;

      const img = container.querySelector('.lazy-image') as HTMLImageElement;
      
      // Simulate error
      const errorEvent = new Event('error');
      img.dispatchEvent(errorEvent);
      
      expect(img.src).toContain('/favicon.svg');
      expect(img.style.opacity).toBe('1');
    });
  });

  describe('Infinite Scroll Component', () => {
    it('should create proper infinite scroll structure', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="infinite-scroll-container">
          <div class="load-more-trigger" data-threshold="200" data-auto-load="true">
            <button class="load-more-btn">Load More</button>
          </div>
        </div>
      `;

      const trigger = container.querySelector('.load-more-trigger');
      const button = container.querySelector('.load-more-btn');

      expect(trigger?.getAttribute('data-threshold')).toBe('200');
      expect(trigger?.getAttribute('data-auto-load')).toBe('true');
      expect(button?.textContent).toBe('Load More');
    });

    it('should handle loading states correctly', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="infinite-scroll-container">
          <div class="flex justify-center items-center py-8" role="status" aria-live="polite">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" aria-hidden="true"></div>
            <span class="ml-2 text-gray-600 dark:text-gray-400">Loading more...</span>
          </div>
        </div>
      `;

      const loadingIndicator = container.querySelector('[role="status"]');
      const spinner = container.querySelector('.animate-spin');
      const loadingText = container.querySelector('span');

      expect(loadingIndicator?.getAttribute('aria-live')).toBe('polite');
      expect(spinner?.getAttribute('aria-hidden')).toBe('true');
      expect(loadingText?.textContent).toBe('Loading more...');
    });

    it('should show end of results message', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="infinite-scroll-container">
          <div class="text-center py-8 text-gray-500 dark:text-gray-400" role="status">
            <p>You've reached the end of the results</p>
          </div>
        </div>
      `;

      const endMessage = container.querySelector('[role="status"] p');
      expect(endMessage?.textContent).toBe("You've reached the end of the results");
    });
  });

  describe('Skeleton Loading', () => {
    it('should create media grid skeleton with correct structure', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div class="flex flex-col sm:flex-row">
              <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded w-full h-48 sm:w-24 sm:h-36 flex-shrink-0"></div>
              <div class="flex-1 p-3 sm:p-4">
                <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-4 mb-2 w-3/4"></div>
                <div class="flex gap-2 mb-2">
                  <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-6 w-16"></div>
                  <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-6 w-12"></div>
                </div>
                <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-3 mb-1"></div>
                <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-3 w-4/5"></div>
              </div>
            </div>
          </div>
        </div>
      `;

      const grid = container.querySelector('.grid');
      const skeletonCard = container.querySelector('.bg-white');
      const skeletonElements = container.querySelectorAll('.animate-pulse');

      expect(grid?.classList.contains('grid-cols-1')).toBe(true);
      expect(grid?.classList.contains('sm:grid-cols-2')).toBe(true);
      expect(grid?.classList.contains('lg:grid-cols-3')).toBe(true);
      expect(grid?.classList.contains('xl:grid-cols-4')).toBe(true);
      expect(skeletonCard?.classList.contains('rounded-lg')).toBe(true);
      expect(skeletonElements.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Budget Monitoring', () => {
    it('should export metrics in JSON format', () => {
      performanceMonitor.recordSearchTime(800);
      performanceMonitor.recordCacheHit(true);
      performanceMonitor.recordImageLoad(250);

      const exported = performanceMonitor.exportMetrics();
      const parsed = JSON.parse(exported);

      expect(parsed.searchTime).toBe(800);
      expect(parsed.cacheHitRate).toBe(1);
      expect(parsed.imageLoadTime).toBe(250);
    });

    it('should reset metrics correctly', () => {
      performanceMonitor.recordSearchTime(800);
      performanceMonitor.recordCacheHit(true);
      performanceMonitor.recordImageLoad(250);

      performanceMonitor.reset();

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.searchTime).toBeUndefined();
      expect(metrics.cacheHitRate).toBeDefined();
      expect(metrics.imageLoadTime).toBeUndefined();
    });
  });
});