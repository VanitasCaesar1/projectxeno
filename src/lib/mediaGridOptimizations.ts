// Media Grid Performance Optimizations
import { performanceMonitor, imageOptimizer } from './performance';
import { cachedFetch, preloadCategoryContent } from './cache';

interface MediaGridState {
  currentPage: number;
  hasMore: boolean;
  isLoading: boolean;
  totalItems: number;
  visibleItems: Set<string>;
  loadedImages: Set<string>;
}

export class MediaGridOptimizer {
  private state: MediaGridState = {
    currentPage: 1,
    hasMore: true,
    isLoading: false,
    totalItems: 0,
    visibleItems: new Set(),
    loadedImages: new Set(),
  };

  private intersectionObserver?: IntersectionObserver;
  private resizeObserver?: ResizeObserver;
  private container: HTMLElement;
  private mediaType: string;

  constructor(container: HTMLElement, mediaType: string) {
    this.container = container;
    this.mediaType = mediaType;
    this.init();
  }

  private init() {
    this.setupIntersectionObserver();
    this.setupResizeObserver();
    this.preloadCriticalContent();
    this.setupPerformanceMonitoring();
  }

  private setupIntersectionObserver() {
    if (!('IntersectionObserver' in window)) return;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const itemId = entry.target.getAttribute('data-item-id');
          if (!itemId) return;

          if (entry.isIntersecting) {
            this.state.visibleItems.add(itemId);
            this.handleItemVisible(entry.target as HTMLElement);
          } else {
            this.state.visibleItems.delete(itemId);
            this.handleItemHidden(entry.target as HTMLElement);
          }
        });
      },
      {
        rootMargin: '50px 0px',
        threshold: 0.1,
      }
    );
  }

  private setupResizeObserver() {
    if (!('ResizeObserver' in window)) return;

    this.resizeObserver = new ResizeObserver(
      this.debounce((entries) => {
        entries.forEach((entry) => {
          this.handleContainerResize(entry.contentRect);
        });
      }, 250)
    );

    this.resizeObserver.observe(this.container);
  }

  private handleItemVisible(element: HTMLElement) {
    // Preload images for visible items
    const img = element.querySelector('img[data-src]') as HTMLImageElement;
    if (img && !this.state.loadedImages.has(img.dataset.src || '')) {
      this.preloadImage(img);
    }

    // Preload next batch when approaching end
    const visibleCount = this.state.visibleItems.size;
    const totalLoaded = this.state.totalItems;
    
    if (visibleCount > totalLoaded * 0.8 && this.state.hasMore && !this.state.isLoading) {
      this.triggerLoadMore();
    }
  }

  private handleItemHidden(element: HTMLElement) {
    // Optional: Implement virtual scrolling by removing off-screen elements
    // This can help with memory management for very long lists
    const shouldVirtualize = this.state.totalItems > 100;
    
    if (shouldVirtualize) {
      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // If element is far off-screen, consider virtualizing
      if (Math.abs(rect.top) > viewportHeight * 2) {
        this.virtualizeElement(element);
      }
    }
  }

  private virtualizeElement(element: HTMLElement) {
    // Replace content with placeholder to save memory
    const placeholder = document.createElement('div');
    placeholder.className = 'virtualized-placeholder';
    placeholder.style.height = `${element.offsetHeight}px`;
    placeholder.setAttribute('data-virtualized', 'true');
    placeholder.setAttribute('data-original-id', element.getAttribute('data-item-id') || '');
    
    element.parentNode?.replaceChild(placeholder, element);
  }

  private async preloadImage(img: HTMLImageElement) {
    const src = img.dataset.src;
    if (!src || this.state.loadedImages.has(src)) return;

    this.state.loadedImages.add(src);
    
    try {
      await imageOptimizer.preloadImage(src, 'low');
      
      // Update img src and show with fade-in
      img.src = src;
      img.style.opacity = '1';
      img.removeAttribute('data-src');
    } catch (error) {
      console.warn('Failed to preload image:', src, error);
    }
  }

  private handleContainerResize(rect: DOMRectReadOnly) {
    // Recalculate optimal image sizes based on new container width
    const images = this.container.querySelectorAll('img[src*="image.tmdb.org"]');
    images.forEach((img) => {
      this.optimizeImageSize(img as HTMLImageElement, rect.width);
    });
  }

  private optimizeImageSize(img: HTMLImageElement, containerWidth: number) {
    const currentSrc = img.src;
    if (!currentSrc.includes('image.tmdb.org')) return;

    const optimalSize = imageOptimizer.getOptimalImageSize(containerWidth / 4); // Assuming 4 columns
    const newSrc = currentSrc.replace(/w\d+/, `w${optimalSize}`);
    
    if (newSrc !== currentSrc) {
      imageOptimizer.preloadImage(newSrc, 'low').then(() => {
        img.src = newSrc;
      }).catch(() => {
        // Keep original if new size fails to load
      });
    }
  }

  private async preloadCriticalContent() {
    try {
      await preloadCategoryContent(this.mediaType);
    } catch (error) {
      console.warn('Failed to preload critical content:', error);
    }
  }

  private setupPerformanceMonitoring() {
    // Monitor scroll performance
    let scrollTimeout: number;
    this.container.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(() => {
        performanceMonitor.updateMemoryUsage();
      }, 100);
    });

    // Monitor load more performance
    const originalLoadMore = (window as any).loadMoreSection;
    if (originalLoadMore) {
      (window as any).loadMoreSection = async (...args: any[]) => {
        performanceMonitor.startTimer('loadMore');
        const startItems = this.state.totalItems;
        
        try {
          const result = await originalLoadMore.apply(this, args);
          const endItems = this.container.querySelectorAll('[data-item-id]').length;
          const itemsLoaded = endItems - startItems;
          
          const duration = performanceMonitor.endTimer('loadMore');
          performanceMonitor.recordInfiniteScrollLoad(duration, itemsLoaded);
          
          this.state.totalItems = endItems;
          
          return result;
        } catch (error) {
          performanceMonitor.endTimer('loadMore');
          throw error;
        }
      };
    }
  }

  private async triggerLoadMore() {
    if (this.state.isLoading || !this.state.hasMore) return;

    this.state.isLoading = true;
    
    try {
      // Find and trigger the load more function for the current section
      const activeSection = this.container.querySelector('.content-section:not(.hidden)');
      if (activeSection) {
        const sectionId = activeSection.getAttribute('data-section');
        const loadMoreFn = (window as any)[`loadMoreSection_${sectionId}`];
        
        if (typeof loadMoreFn === 'function') {
          await loadMoreFn();
        }
      }
    } catch (error) {
      console.error('Failed to trigger load more:', error);
    } finally {
      this.state.isLoading = false;
    }
  }

  // Utility functions
  private debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: number;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = window.setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Public methods
  public observeItems() {
    if (!this.intersectionObserver) return;

    const items = this.container.querySelectorAll('[data-item-id]:not([data-observed])');
    items.forEach((item) => {
      item.setAttribute('data-observed', 'true');
      this.intersectionObserver!.observe(item);
    });
  }

  public updateState(updates: Partial<MediaGridState>) {
    this.state = { ...this.state, ...updates };
  }

  public getState(): MediaGridState {
    return { ...this.state };
  }

  public destroy() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
}

// Bundle size optimization utilities
export class BundleOptimizer {
  private static loadedModules = new Set<string>();

  // Dynamic import with caching
  static async loadModule<T>(modulePath: string): Promise<T> {
    if (this.loadedModules.has(modulePath)) {
      return (window as any)[`__module_${modulePath.replace(/[^a-zA-Z0-9]/g, '_')}`];
    }

    try {
      const module = await import(modulePath);
      this.loadedModules.add(modulePath);
      (window as any)[`__module_${modulePath.replace(/[^a-zA-Z0-9]/g, '_')}`] = module;
      return module;
    } catch (error) {
      console.error(`Failed to load module: ${modulePath}`, error);
      throw error;
    }
  }

  // Preload critical modules
  static preloadCriticalModules() {
    const criticalModules = [
      './mediaConfig',
      './userMediaStatus',
      './cache',
    ];

    criticalModules.forEach((module) => {
      this.loadModule(module).catch(() => {
        // Ignore preload failures
      });
    });
  }

  // Code splitting for category-specific functionality
  static async loadCategoryModule(mediaType: string) {
    const moduleMap = {
      movie: () => import('./movieSpecific'),
      tv: () => import('./tvSpecific'),
      book: () => import('./bookSpecific'),
      anime: () => import('./animeSpecific'),
      manga: () => import('./mangaSpecific'),
    };

    const loader = moduleMap[mediaType as keyof typeof moduleMap];
    if (loader) {
      try {
        return await loader();
      } catch (error) {
        console.warn(`Failed to load ${mediaType} specific module:`, error);
        return null;
      }
    }

    return null;
  }
}

// Initialize bundle optimization
if (typeof window !== 'undefined') {
  BundleOptimizer.preloadCriticalModules();
}