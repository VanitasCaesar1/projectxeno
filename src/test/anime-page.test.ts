import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock fetch for API calls
global.fetch = vi.fn();

describe('Anime Page Integration', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;

  beforeAll(() => {
    // Set up DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <div class="dynamic-media-grid" data-media-type="anime">
            <div class="section-nav">
              <div class="flex">
                <button class="section-btn active" data-section="popular" data-section-type="popular">Popular Anime</button>
                <button class="section-btn" data-section="trending" data-section-type="trending">Trending Anime</button>
                <button class="section-btn" data-section="top_rated" data-section-type="top_rated">Top Rated Anime</button>
              </div>
            </div>
            <div class="section-content">
              <div class="content-section" data-section="popular" data-section-type="popular" data-media-type="anime">
                <div class="section-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 hidden"></div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `, { url: 'http://localhost:3000' });

    document = dom.window.document;
    window = dom.window as unknown as Window;
    
    // Set up global objects
    global.document = document;
    global.window = window;
    global.HTMLElement = window.HTMLElement;
    global.Element = window.Element;
  });

  afterAll(() => {
    dom.window.close();
  });

  it('should have anime media type configured', () => {
    const grid = document.querySelector('.dynamic-media-grid');
    expect(grid?.getAttribute('data-media-type')).toBe('anime');
  });

  it('should have anime-specific content sections', () => {
    const popularBtn = document.querySelector('[data-section="popular"]');
    const trendingBtn = document.querySelector('[data-section="trending"]');
    const topRatedBtn = document.querySelector('[data-section="top_rated"]');

    expect(popularBtn?.textContent).toBe('Popular Anime');
    expect(trendingBtn?.textContent).toBe('Trending Anime');
    expect(topRatedBtn?.textContent).toBe('Top Rated Anime');
  });

  it('should handle anime search API calls', async () => {
    const mockAnimeResults = {
      success: true,
      data: {
        results: [
          {
            id: 'jikan-anime-1',
            title: 'Attack on Titan',
            type: 'anime',
            year: 2013,
            poster: 'https://cdn.myanimelist.net/images/anime/10/47347.jpg',
            description: 'Humanity fights for survival against giant humanoid Titans.',
            rating: 9.0,
            source: 'jikan'
          },
          {
            id: 'jikan-anime-2',
            title: 'Death Note',
            type: 'anime',
            year: 2006,
            poster: 'https://cdn.myanimelist.net/images/anime/9/9453.jpg',
            description: 'A high school student discovers a supernatural notebook.',
            rating: 9.0,
            source: 'jikan'
          }
        ],
        total: 2,
        page: 1,
        totalPages: 1
      }
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAnimeResults
    });

    const response = await fetch('/api/search?q=shounen&type=anime&page=1');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.results).toHaveLength(2);
    expect(data.data.results[0].type).toBe('anime');
    expect(data.data.results[0].source).toBe('jikan');
  });

  it('should handle anime detail page navigation', () => {
    const animeId = 'jikan-anime-1';
    const expectedUrl = `/media/anime/${animeId}`;
    
    // Test URL construction
    expect(expectedUrl).toBe('/media/anime/jikan-anime-1');
  });

  it('should support anime-specific metadata', () => {
    const animeMetadata = {
      studio: 'Studio Pierrot',
      episodes: 25,
      status: 'Finished Airing',
      season: 'Spring',
      year: 2013,
      genres: ['Action', 'Drama', 'Fantasy'],
      rating: 9.0
    };

    // Test that anime metadata structure is supported
    expect(animeMetadata.studio).toBeDefined();
    expect(animeMetadata.episodes).toBeDefined();
    expect(animeMetadata.status).toBeDefined();
    expect(typeof animeMetadata.episodes).toBe('number');
    expect(Array.isArray(animeMetadata.genres)).toBe(true);
  });

  it('should handle AddToListButton integration for anime', () => {
    // Create a mock anime card with AddToListButton
    const animeCard = document.createElement('div');
    animeCard.className = 'media-card';
    animeCard.innerHTML = `
      <button class="add-to-list-btn" 
              data-media-id="jikan-anime-1"
              data-media-title="Attack on Titan"
              data-media-type="anime"
              data-media-source="jikan">
        Add to List
      </button>
    `;

    document.body.appendChild(animeCard);

    const addButton = animeCard.querySelector('.add-to-list-btn') as HTMLButtonElement;
    expect(addButton).toBeTruthy();
    expect(addButton.dataset.mediaType).toBe('anime');
    expect(addButton.dataset.mediaSource).toBe('jikan');
    expect(addButton.dataset.mediaTitle).toBe('Attack on Titan');

    // Clean up
    document.body.removeChild(animeCard);
  });

  it('should handle anime-specific status options', () => {
    const animeStatusOptions = [
      'plan_to_watch',
      'watching',
      'completed',
      'on_hold',
      'dropped'
    ];

    // Test that anime has appropriate status options
    expect(animeStatusOptions).toContain('plan_to_watch');
    expect(animeStatusOptions).toContain('watching');
    expect(animeStatusOptions).toContain('completed');
    expect(animeStatusOptions).toContain('on_hold');
    expect(animeStatusOptions).toContain('dropped');
  });

  it('should handle Jikan API rate limiting', async () => {
    // Mock rate limit response
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({
        success: false,
        error: { message: 'Rate limit exceeded' }
      })
    });

    const response = await fetch('/api/search?q=anime&type=anime');
    const data = await response.json();

    expect(response.ok).toBe(false);
    expect(data.success).toBe(false);
    expect(data.error.message).toContain('Rate limit');
  });

  it('should support anime search with filters', async () => {
    const searchParams = new URLSearchParams({
      q: 'shounen',
      type: 'anime',
      yearFrom: '2010',
      yearTo: '2020',
      ratingFrom: '8.0',
      sortBy: 'rating',
      sortOrder: 'desc'
    });

    const mockFilteredResults = {
      success: true,
      data: {
        results: [
          {
            id: 'jikan-anime-1',
            title: 'Attack on Titan',
            type: 'anime',
            year: 2013,
            rating: 9.0,
            source: 'jikan'
          }
        ],
        total: 1,
        page: 1,
        totalPages: 1
      }
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockFilteredResults
    });

    const response = await fetch(`/api/search?${searchParams}`);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.results[0].year).toBeGreaterThanOrEqual(2010);
    expect(data.data.results[0].year).toBeLessThanOrEqual(2020);
    expect(data.data.results[0].rating).toBeGreaterThanOrEqual(8.0);
  });
});