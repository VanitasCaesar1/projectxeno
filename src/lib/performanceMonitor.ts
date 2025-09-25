/**
 * Performance monitoring utility for media grid operations
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private timers: Map<string, number> = new Map();
  private measurements: Map<string, number[]> = new Map();

  private constructor() {}

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start a performance timer
   */
  public startTimer(name: string): void {
    this.timers.set(name, performance.now());
    
    // Also use Performance API if available
    if (typeof window !== 'undefined' && window.performance && window.performance.mark) {
      window.performance.mark(`${name}_start`);
    }
  }

  /**
   * End a performance timer and return duration
   */
  public endTimer(name: string): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`Timer '${name}' was not started`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);

    // Store measurement
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(duration);

    // Also use Performance API if available
    if (typeof window !== 'undefined' && window.performance && window.performance.mark && window.performance.measure) {
      try {
        const endMark = `${name}_end`;
        window.performance.mark(endMark);
        window.performance.measure(name, `${name}_start`, endMark);
      } catch (error) {
        console.warn('Performance API measurement failed:', error);
      }
    }

    return duration;
  }

  /**
   * Record infinite scroll load performance
   */
  public recordInfiniteScrollLoad(sectionId: string, duration: number, itemCount: number): void {
    const measurementName = `infiniteScroll_${sectionId}`;
    
    if (!this.measurements.has(measurementName)) {
      this.measurements.set(measurementName, []);
    }
    this.measurements.get(measurementName)!.push(duration);

    // Log performance data
    console.log(`Infinite scroll load for ${sectionId}: ${itemCount} items in ${duration.toFixed(2)}ms`);

    // Mark in Performance API
    if (typeof window !== 'undefined' && window.performance && window.performance.mark) {
      window.performance.mark(`${measurementName}_${itemCount}items_${duration.toFixed(2)}ms`);
    }

    // Track performance metrics for analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'infinite_scroll_performance', {
        section_id: sectionId,
        load_duration: Math.round(duration),
        item_count: itemCount,
        items_per_second: Math.round(itemCount / (duration / 1000))
      });
    }
  }

  /**
   * Record content loading performance
   */
  public recordContentLoad(sectionId: string, page: number, duration: number, itemCount: number): void {
    const measurementName = `contentLoad_${sectionId}`;
    
    if (!this.measurements.has(measurementName)) {
      this.measurements.set(measurementName, []);
    }
    this.measurements.get(measurementName)!.push(duration);

    console.log(`Content loading for ${sectionId} page ${page}: ${itemCount} items in ${duration.toFixed(2)}ms`);

    // Track in analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'content_load_performance', {
        section_id: sectionId,
        page: page,
        load_duration: Math.round(duration),
        item_count: itemCount
      });
    }
  }

  /**
   * Get average performance for a measurement
   */
  public getAveragePerformance(name: string): number {
    const measurements = this.measurements.get(name);
    if (!measurements || measurements.length === 0) {
      return 0;
    }
    return measurements.reduce((sum, val) => sum + val, 0) / measurements.length;
  }

  /**
   * Get all measurements for debugging
   */
  public getAllMeasurements(): Map<string, number[]> {
    return new Map(this.measurements);
  }

  /**
   * Clear all measurements
   */
  public clearMeasurements(): void {
    this.measurements.clear();
    this.timers.clear();
  }

  /**
   * Record cache hit/miss for performance tracking
   */
  public recordCacheHit(isHit: boolean): void {
    const measurementName = isHit ? 'cache_hits' : 'cache_misses';
    
    if (!this.measurements.has(measurementName)) {
      this.measurements.set(measurementName, []);
    }
    this.measurements.get(measurementName)!.push(1);
  }

  /**
   * Record API response time
   */
  public recordApiResponse(apiName: string, duration: number): void {
    const measurementName = `api_response_${apiName}`;
    
    if (!this.measurements.has(measurementName)) {
      this.measurements.set(measurementName, []);
    }
    this.measurements.get(measurementName)!.push(duration);
  }

  /**
   * Record search time
   */
  public recordSearchTime(duration: number): void {
    const measurementName = 'search_time';
    
    if (!this.measurements.has(measurementName)) {
      this.measurements.set(measurementName, []);
    }
    this.measurements.get(measurementName)!.push(duration);
  }

  /**
   * Log performance metrics to console (for development)
   */
  public logMetrics(): void {
    if (typeof window === 'undefined') return; // Only log in browser
    
    const cacheHits = this.measurements.get('cache_hits')?.length || 0;
    const cacheMisses = this.measurements.get('cache_misses')?.length || 0;
    const totalCacheRequests = cacheHits + cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 ? (cacheHits / totalCacheRequests) * 100 : 0;
    
    const searchTimes = this.measurements.get('search_time') || [];
    const avgSearchTime = searchTimes.length > 0 ? 
      searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length : 0;
    
    const infiniteScrollLoads = Array.from(this.measurements.keys())
      .filter(key => key.startsWith('infiniteScroll_'))
      .reduce((total, key) => total + (this.measurements.get(key)?.length || 0), 0);
    
    const avgInfiniteScrollTime = infiniteScrollLoads > 0 ? 
      Array.from(this.measurements.entries())
        .filter(([key]) => key.startsWith('infiniteScroll_'))
        .reduce((sum, [, times]) => sum + times.reduce((s, t) => s + t, 0), 0) / infiniteScrollLoads : 0;
    
    const apiResponseTimes: Record<string, number> = {};
    Array.from(this.measurements.entries())
      .filter(([key]) => key.startsWith('api_response_'))
      .forEach(([key, times]) => {
        const apiName = key.replace('api_response_', '');
        apiResponseTimes[apiName] = times.length > 0 ? 
          times.reduce((sum, time) => sum + time, 0) / times.length : 0;
      });
    
    console.group('Performance Metrics');
    console.log(`Search Time: ${avgSearchTime.toFixed(2)} ms`);
    console.log(`Cache Hit Rate: ${cacheHitRate.toFixed(1)} %`);
    console.log(`Average Image Load Time: ${avgInfiniteScrollTime.toFixed(2)} ms`);
    console.log('API Response Times:', apiResponseTimes);
    console.log('Infinite Scroll Metrics');
    console.log(`Load Count: ${infiniteScrollLoads}`);
    console.log(`Average Load Time: ${avgInfiniteScrollTime.toFixed(2)} ms`);
    console.log(`Total Items Loaded: ${infiniteScrollLoads * 20}`); // Assuming 20 items per load
    console.groupEnd();
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): Record<string, any> {
    const summary: Record<string, any> = {};
    
    for (const [name, measurements] of this.measurements.entries()) {
      if (measurements.length > 0) {
        summary[name] = {
          count: measurements.length,
          average: this.getAveragePerformance(name),
          min: Math.min(...measurements),
          max: Math.max(...measurements),
          total: measurements.reduce((sum, val) => sum + val, 0)
        };
      }
    }
    
    return summary;
  }
}

// Global instance for easy access
export const performanceMonitor = PerformanceMonitor.getInstance();

// Add to window for debugging
if (typeof window !== 'undefined') {
  (window as any).performanceMonitor = performanceMonitor;
}