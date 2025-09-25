// Performance monitoring and optimization utilities

interface PerformanceMetrics {
  searchTime: number;
  cacheHitRate: number;
  imageLoadTime: number;
  totalResults: number;
  apiResponseTimes: Record<string, number>;
  infiniteScrollMetrics: {
    loadCount: number;
    averageLoadTime: number;
    totalItemsLoaded: number;
  };
  memoryUsage: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {
    infiniteScrollMetrics: {
      loadCount: 0,
      averageLoadTime: 0,
      totalItemsLoaded: 0,
    }
  };
  private timers: Map<string, number> = new Map();
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private imageLoadTimes: number[] = [];
  private scrollLoadTimes: number[] = [];

  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  endTimer(name: string): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`Timer ${name} was not started`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.timers.delete(name);
    return duration;
  }

  recordSearchTime(duration: number): void {
    this.metrics.searchTime = duration;
  }

  recordCacheHit(hit: boolean): void {
    if (hit) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
    
    const total = this.cacheHits + this.cacheMisses;
    this.metrics.cacheHitRate = total > 0 ? this.cacheHits / total : 0;
  }

  recordImageLoad(duration: number): void {
    this.imageLoadTimes.push(duration);
    this.metrics.imageLoadTime = this.imageLoadTimes.reduce((a, b) => a + b, 0) / this.imageLoadTimes.length;
    
    // Keep only last 100 measurements to prevent memory bloat
    if (this.imageLoadTimes.length > 100) {
      this.imageLoadTimes = this.imageLoadTimes.slice(-50);
    }
  }

  recordInfiniteScrollLoad(duration: number, itemsLoaded: number): void {
    if (!this.metrics.infiniteScrollMetrics) {
      this.metrics.infiniteScrollMetrics = {
        loadCount: 0,
        averageLoadTime: 0,
        totalItemsLoaded: 0,
      };
    }
    
    this.scrollLoadTimes.push(duration);
    this.metrics.infiniteScrollMetrics.loadCount++;
    this.metrics.infiniteScrollMetrics.totalItemsLoaded += itemsLoaded;
    this.metrics.infiniteScrollMetrics.averageLoadTime = 
      this.scrollLoadTimes.reduce((a, b) => a + b, 0) / this.scrollLoadTimes.length;
    
    // Keep only last 50 measurements
    if (this.scrollLoadTimes.length > 50) {
      this.scrollLoadTimes = this.scrollLoadTimes.slice(-25);
    }
  }

  recordApiResponse(api: string, duration: number): void {
    if (!this.metrics.apiResponseTimes) {
      this.metrics.apiResponseTimes = {};
    }
    this.metrics.apiResponseTimes[api] = duration;
  }

  updateMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.metrics.memoryUsage = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      };
    }
  }

  getMetrics(): Partial<PerformanceMetrics> {
    this.updateMemoryUsage();
    return { ...this.metrics };
  }

  logMetrics(): void {
    this.updateMemoryUsage();
    
    console.group('Performance Metrics');
    console.log('Search Time:', this.metrics.searchTime?.toFixed(2), 'ms');
    console.log('Cache Hit Rate:', ((this.metrics.cacheHitRate || 0) * 100).toFixed(1), '%');
    console.log('Average Image Load Time:', this.metrics.imageLoadTime?.toFixed(2), 'ms');
    console.log('API Response Times:', this.metrics.apiResponseTimes);
    
    if (this.metrics.infiniteScrollMetrics) {
      console.group('Infinite Scroll Metrics');
      console.log('Load Count:', this.metrics.infiniteScrollMetrics.loadCount);
      console.log('Average Load Time:', this.metrics.infiniteScrollMetrics.averageLoadTime.toFixed(2), 'ms');
      console.log('Total Items Loaded:', this.metrics.infiniteScrollMetrics.totalItemsLoaded);
      console.groupEnd();
    }
    
    if (this.metrics.memoryUsage) {
      console.group('Memory Usage');
      console.log('Used JS Heap:', (this.metrics.memoryUsage.usedJSHeapSize / 1024 / 1024).toFixed(2), 'MB');
      console.log('Total JS Heap:', (this.metrics.memoryUsage.totalJSHeapSize / 1024 / 1024).toFixed(2), 'MB');
      console.log('JS Heap Limit:', (this.metrics.memoryUsage.jsHeapSizeLimit / 1024 / 1024).toFixed(2), 'MB');
      console.groupEnd();
    }
    
    console.groupEnd();
  }

  // Performance budget monitoring
  checkPerformanceBudgets(): { passed: boolean; violations: string[] } {
    const violations: string[] = [];
    
    // Check search time budget (should be under 1000ms)
    if (this.metrics.searchTime && this.metrics.searchTime > 1000) {
      violations.push(`Search time (${this.metrics.searchTime.toFixed(2)}ms) exceeds budget (1000ms)`);
    }
    
    // Check cache hit rate budget (should be above 70%)
    if (typeof this.metrics.cacheHitRate === 'number' && this.metrics.cacheHitRate < 0.7) {
      violations.push(`Cache hit rate (${(this.metrics.cacheHitRate * 100).toFixed(1)}%) below budget (70%)`);
    }
    
    // Check image load time budget (should be under 500ms)
    if (this.metrics.imageLoadTime && this.metrics.imageLoadTime > 500) {
      violations.push(`Image load time (${this.metrics.imageLoadTime.toFixed(2)}ms) exceeds budget (500ms)`);
    }
    
    // Check infinite scroll load time budget (should be under 2000ms)
    if (this.metrics.infiniteScrollMetrics && this.metrics.infiniteScrollMetrics.averageLoadTime > 2000) {
      violations.push(`Infinite scroll load time (${this.metrics.infiniteScrollMetrics.averageLoadTime.toFixed(2)}ms) exceeds budget (2000ms)`);
    }
    
    return {
      passed: violations.length === 0,
      violations
    };
  }

  // Export metrics for analytics
  exportMetrics(): string {
    return JSON.stringify(this.getMetrics(), null, 2);
  }

  // Reset metrics
  reset(): void {
    this.metrics = {
      infiniteScrollMetrics: {
        loadCount: 0,
        averageLoadTime: 0,
        totalItemsLoaded: 0,
      }
    };
    this.timers.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.imageLoadTimes = [];
    this.scrollLoadTimes = [];
    
    // Recalculate cache hit rate after reset
    const total = this.cacheHits + this.cacheMisses;
    this.metrics.cacheHitRate = total > 0 ? this.cacheHits / total : 0;
  }

  // Web Vitals monitoring
  measureWebVitals(): void {
    if (typeof window === 'undefined') return;

    // Largest Contentful Paint
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      console.log('LCP:', lastEntry.startTime);
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        console.log('FID:', entry.processingStart - entry.startTime);
      });
    }).observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift
    let clsValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      console.log('CLS:', clsValue);
    }).observe({ entryTypes: ['layout-shift'] });
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// Image loading optimization
export class ImageOptimizer {
  private static instance: ImageOptimizer;
  private loadedImages = new Set<string>();
  private preloadQueue: string[] = [];

  static getInstance(): ImageOptimizer {
    if (!ImageOptimizer.instance) {
      ImageOptimizer.instance = new ImageOptimizer();
    }
    return ImageOptimizer.instance;
  }

  // Preload critical images
  preloadImage(src: string, priority: 'high' | 'low' = 'low'): Promise<void> {
    if (this.loadedImages.has(src)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.loadedImages.add(src);
        resolve();
      };
      img.onerror = reject;
      img.src = src;

      // Add priority hint if supported
      if ('fetchPriority' in img) {
        (img as any).fetchPriority = priority;
      }
    });
  }

  // Batch preload images
  async preloadImages(urls: string[], maxConcurrent: number = 3): Promise<void> {
    const chunks = [];
    for (let i = 0; i < urls.length; i += maxConcurrent) {
      chunks.push(urls.slice(i, i + maxConcurrent));
    }

    for (const chunk of chunks) {
      await Promise.allSettled(
        chunk.map(url => this.preloadImage(url))
      );
    }
  }

  // Generate responsive image URLs
  generateResponsiveUrls(baseUrl: string, sizes: number[] = [300, 500, 780]): string[] {
    if (!baseUrl.includes('image.tmdb.org')) {
      return [baseUrl];
    }

    return sizes.map(size => baseUrl.replace(/w\d+/, `w${size}`));
  }

  // Get optimal image size based on container
  getOptimalImageSize(containerWidth: number): number {
    const sizes = [92, 154, 185, 342, 500, 780];
    return sizes.find(size => size >= containerWidth * window.devicePixelRatio) || sizes[sizes.length - 1];
  }
}

// Database query optimization helpers
export class QueryOptimizer {
  // Generate efficient search query with proper indexing hints
  static buildSearchQuery(
    query: string, 
    mediaType?: string, 
    limit: number = 20, 
    offset: number = 0
  ): string {
    const baseQuery = `
      SELECT 
        mi.id,
        mi.external_id,
        mi.media_type,
        mi.title,
        mi.poster_url,
        mi.average_rating,
        mi.rating_count,
        ts_rank(to_tsvector('english', mi.title), plainto_tsquery('english', $1)) as rank
      FROM media_items mi
      WHERE 
        ${mediaType ? 'mi.media_type = $2 AND' : ''}
        (
          to_tsvector('english', mi.title) @@ plainto_tsquery('english', $1)
          OR mi.title ILIKE $${mediaType ? '3' : '2'}
        )
      ORDER BY 
        rank DESC,
        mi.average_rating DESC NULLS LAST,
        mi.rating_count DESC
      LIMIT $${mediaType ? '4' : '3'}
      OFFSET $${mediaType ? '5' : '4'}
    `;
    
    return baseQuery;
  }

  // Build efficient user media query
  static buildUserMediaQuery(userId: string, status?: string, limit: number = 50): string {
    return `
      SELECT 
        um.*,
        mi.title,
        mi.poster_url,
        mi.media_type,
        mi.average_rating
      FROM user_media um
      JOIN media_items mi ON um.media_id = mi.id
      WHERE 
        um.user_id = $1
        ${status ? 'AND um.status = $2' : ''}
      ORDER BY um.updated_at DESC
      LIMIT $${status ? '3' : '2'}
    `;
  }
}

// Request batching for API calls
export class RequestBatcher {
  private batches = new Map<string, Array<{ resolve: Function; reject: Function; params: any }>>();
  private timeouts = new Map<string, NodeJS.Timeout>();

  batch<T>(
    key: string,
    params: any,
    batchFn: (allParams: any[]) => Promise<T[]>,
    delay: number = 50
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.batches.has(key)) {
        this.batches.set(key, []);
      }

      const batch = this.batches.get(key)!;
      batch.push({ resolve, reject, params });

      // Clear existing timeout
      if (this.timeouts.has(key)) {
        clearTimeout(this.timeouts.get(key)!);
      }

      // Set new timeout
      const timeout = setTimeout(async () => {
        const currentBatch = this.batches.get(key) || [];
        this.batches.delete(key);
        this.timeouts.delete(key);

        if (currentBatch.length === 0) return;

        try {
          const allParams = currentBatch.map(item => item.params);
          const results = await batchFn(allParams);
          
          currentBatch.forEach((item, index) => {
            item.resolve(results[index]);
          });
        } catch (error) {
          currentBatch.forEach(item => {
            item.reject(error);
          });
        }
      }, delay);

      this.timeouts.set(key, timeout);
    });
  }
}

// Export singleton instances
export const imageOptimizer = ImageOptimizer.getInstance();
export const requestBatcher = new RequestBatcher();

// Performance measurement decorators
export function measurePerformance(name: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      performanceMonitor.startTimer(name);
      try {
        const result = await originalMethod.apply(this, args);
        const duration = performanceMonitor.endTimer(name);
        console.log(`${name} took ${duration.toFixed(2)}ms`);
        return result;
      } catch (error) {
        performanceMonitor.endTimer(name);
        throw error;
      }
    };

    return descriptor;
  };
}

// Initialize performance monitoring
if (typeof window !== 'undefined') {
  performanceMonitor.measureWebVitals();
}