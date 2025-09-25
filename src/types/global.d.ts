// Global type declarations

declare global {
  interface Window {
    RatingComponent: any;
    handleRatingChange: (rating: number) => void;
    getAuthHeader?: () => Promise<Record<string, string>>;
    gtag?: (...args: any[]) => void;
    cachedFetch?: (key: string, fetchFn: () => Promise<any>, ttl?: number) => Promise<any>;
    observeLazyImages?: () => void;
    scrollToNewContent?: () => void;
    IntersectionObserver?: typeof IntersectionObserver;
    performanceMonitor?: {
      startTimer: (name: string) => void;
      endTimer: (name: string) => number;
      recordInfiniteScrollLoad: (sectionId: string, duration: number, itemCount: number) => void;
      recordContentLoad: (sectionId: string, page: number, duration: number, itemCount: number) => void;
      getAveragePerformance: (name: string) => number;
      getAllMeasurements: () => Map<string, number[]>;
      clearMeasurements: () => void;
      getPerformanceSummary: () => Record<string, any>;
    };
  }
}

export {};