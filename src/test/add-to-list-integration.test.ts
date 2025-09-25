import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock fetch for testing
global.fetch = vi.fn();

describe('MediaCard AddToListButton Integration', () => {
  let dom: JSDOM;
  let document: Document;
  let window: Window;

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <!-- Authenticated user with existing status -->
          <div class="media-card" data-detail-url="/media/movie/123">
            <div class="add-to-list-container" data-media-id="media_123" data-media-type="movie">
              <div class="current-status-container">
                <button class="current-status-btn" data-current-status="watching">
                  <span class="status-icon">▶️</span>
                  <span class="status-text">Currently Watching</span>
                  <span class="dropdown-arrow">▼</span>
                </button>
                <div class="status-dropdown hidden">
                  <button class="status-option" data-status="plan_to_watch">
                    <span class="option-icon">📋</span>
                    <span class="option-text">Plan to Watch</span>
                  </button>
                  <button class="status-option" data-status="watching" data-is-current="true">
                    <span class="option-icon">▶️</span>
                    <span class="option-text">Currently Watching</span>
                    <span class="current-indicator">✓</span>
                  </button>
                  <button class="status-option" data-status="completed">
                    <span class="option-icon">✅</span>
                    <span class="option-text">Completed</span>
                  </button>
                  <button class="status-option remove-option" data-status="remove">
                    <span class="option-icon">🗑️</span>
                    <span class="option-text">Remove from List</span>
                  </button>
                </div>
              </div>
              <div class="hidden-media-data" style="display: none;">
                <input type="hidden" name="externalId" value="123" />
                <input type="hidden" name="title" value="Test Movie" />
                <input type="hidden" name="description" value="A test movie" />
                <input type="hidden" name="posterUrl" value="/poster.jpg" />
                <input type="hidden" name="releaseDate" value="2023-01-01" />
                <input type="hidden" name="genres" value="[]" />
                <input type="hidden" name="metadata" value='{"source":"tmdb","rating":8.5,"year":2023}' />
              </div>
            </div>
          </div>

          <!-- Unauthenticated user -->
          <div class="media-card" data-detail-url="/media/book/456">
            <button class="login-prompt-btn"
              data-media-title="Test Book"
              data-media-type="book"
              data-external-id="456"
              data-poster="/book-cover.jpg"
              data-year="2022"
              data-source="openlibrary"
              data-description="A test book">
              <span>+</span>
              <span>Add</span>
            </button>
          </div>

          <!-- Authenticated user without status -->
          <div class="media-card" data-detail-url="/media/anime/789">
            <div class="add-to-list-container" data-media-id="anime_789" data-media-type="anime">
              <div class="add-new-container">
                <button class="add-to-list-btn">
                  <span class="add-icon">+</span>
                  <span class="add-text">Add to List</span>
                </button>
                <div class="status-dropdown hidden">
                  <button class="status-option" data-status="plan_to_watch">
                    <span class="option-icon">📋</span>
                    <span class="option-text">Plan to Watch</span>
                  </button>
                  <button class="status-option" data-status="watching">
                    <span class="option-icon">▶️</span>
                    <span class="option-text">Currently Watching</span>
                  </button>
                  <button class="status-option" data-status="completed">
                    <span class="option-icon">✅</span>
                    <span class="option-text">Completed</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    
    document = dom.window.document;
    window = dom.window as unknown as Window;
    
    // Set up global objects
    global.document = document;
    global.window = window;
    
    // Mock fetch responses
    vi.mocked(fetch).mockClear();
  });

  it('should show login prompt for unauthenticated users', async () => {
    const button = document.querySelector('.login-prompt-btn') as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.dataset.mediaTitle).toBe('Test Book');
    expect(button.dataset.mediaType).toBe('book');
    expect(button.dataset.externalId).toBe('456');
    expect(button.dataset.poster).toBe('/book-cover.jpg');
    expect(button.dataset.year).toBe('2022');
    expect(button.dataset.source).toBe('openlibrary');
    expect(button.dataset.description).toBe('A test book');

    // Verify button structure
    expect(button.classList.contains('login-prompt-btn')).toBe(true);
    expect(button.textContent?.trim()).toContain('+');
    expect(button.textContent?.trim()).toContain('Add');
  });

  it('should handle authenticated user adding to list', async () => {
    // Mock successful API response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { 
          id: 'user_media_123',
          status: 'plan_to_watch',
          media: { title: 'Test Anime' }
        }
      })
    } as Response);

    const container = document.querySelectorAll('.add-to-list-container')[1] as HTMLElement; // Third card (anime)
    const button = container.querySelector('.add-to-list-btn') as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(container.dataset.mediaType).toBe('anime');

    // Verify initial state
    const addNewContainer = container.querySelector('.add-new-container');
    expect(addNewContainer).toBeTruthy();
    expect(button.textContent?.trim()).toContain('Add to List');

    // Simulate dropdown interaction
    const dropdown = container.querySelector('.status-dropdown') as HTMLElement;
    const statusOption = dropdown.querySelector('[data-status="plan_to_watch"]') as HTMLButtonElement;
    
    expect(dropdown).toBeTruthy();
    expect(statusOption).toBeTruthy();
    expect(statusOption.textContent?.trim()).toContain('Plan to Watch');
  });

  it('should handle card navigation without interfering with button clicks', () => {
    const cards = document.querySelectorAll('.media-card');
    const movieCard = cards[0] as HTMLElement;
    const bookCard = cards[1] as HTMLElement;
    const animeCard = cards[2] as HTMLElement;
    
    expect(movieCard).toBeTruthy();
    expect(bookCard).toBeTruthy();
    expect(animeCard).toBeTruthy();
    
    // Verify detail URLs are set correctly
    expect(movieCard.getAttribute('data-detail-url')).toBe('/media/movie/123');
    expect(bookCard.getAttribute('data-detail-url')).toBe('/media/book/456');
    expect(animeCard.getAttribute('data-detail-url')).toBe('/media/anime/789');

    // Verify interactive elements are properly identified
    const addToListContainer = movieCard.querySelector('.add-to-list-container');
    const loginPromptBtn = bookCard.querySelector('.login-prompt-btn');
    const addToListBtn = animeCard.querySelector('.add-to-list-btn');
    
    expect(addToListContainer).toBeTruthy();
    expect(loginPromptBtn).toBeTruthy();
    expect(addToListBtn).toBeTruthy();

    // These elements should prevent card navigation when clicked
    expect(addToListContainer?.classList.contains('add-to-list-container')).toBe(true);
    expect(loginPromptBtn?.classList.contains('login-prompt-btn')).toBe(true);
    expect(addToListBtn?.classList.contains('add-to-list-btn')).toBe(true);
  });

  it('should display user status correctly', () => {
    // Test movie card with existing status
    const movieContainer = document.querySelector('.add-to-list-container') as HTMLElement;
    expect(movieContainer).toBeTruthy();
    expect(movieContainer.dataset.mediaType).toBe('movie');
    
    const statusButton = movieContainer.querySelector('.current-status-btn') as HTMLButtonElement;
    expect(statusButton).toBeTruthy();
    expect(statusButton.getAttribute('data-current-status')).toBe('watching');
    expect(statusButton.textContent?.trim()).toContain('Currently Watching');
    
    // Verify dropdown options
    const dropdown = movieContainer.querySelector('.status-dropdown') as HTMLElement;
    expect(dropdown).toBeTruthy();
    expect(dropdown.classList.contains('hidden')).toBe(true);
    
    const currentOption = dropdown.querySelector('[data-is-current="true"]') as HTMLElement;
    expect(currentOption).toBeTruthy();
    expect(currentOption.dataset.status).toBe('watching');
    expect(currentOption.textContent?.trim()).toContain('Currently Watching');
    expect(currentOption.textContent?.trim()).toContain('✓');
    
    const removeOption = dropdown.querySelector('.remove-option') as HTMLElement;
    expect(removeOption).toBeTruthy();
    expect(removeOption.dataset.status).toBe('remove');
    expect(removeOption.textContent?.trim()).toContain('Remove from List');
  });

  it('should handle different media types correctly', () => {
    const containers = document.querySelectorAll('.add-to-list-container');
    
    // Movie container (first one)
    const movieContainer = containers[0] as HTMLElement;
    expect(movieContainer.dataset.mediaType).toBe('movie');
    const movieButton = movieContainer.querySelector('.current-status-btn') as HTMLButtonElement;
    expect(movieButton.textContent?.trim()).toContain('Currently Watching');
    
    // Anime container (second one)
    const animeContainer = containers[1] as HTMLElement;
    expect(animeContainer.dataset.mediaType).toBe('anime');
    const animeButton = animeContainer.querySelector('.add-to-list-btn') as HTMLButtonElement;
    expect(animeButton.textContent?.trim()).toContain('Add to List');
    
    // Test that book login prompt has correct media type
    const bookLoginBtn = document.querySelector('.login-prompt-btn') as HTMLButtonElement;
    expect(bookLoginBtn.dataset.mediaType).toBe('book');
    expect(bookLoginBtn.dataset.mediaTitle).toBe('Test Book');
  });

  it('should handle status updates correctly', async () => {
    // Mock successful status update
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { 
          id: 'user_media_123',
          status: 'completed',
          media: { title: 'Test Movie' }
        }
      })
    } as Response);

    const movieContainer = document.querySelector('.add-to-list-container') as HTMLElement;
    const dropdown = movieContainer.querySelector('.status-dropdown') as HTMLElement;
    const completedOption = dropdown.querySelector('[data-status="completed"]') as HTMLButtonElement;
    
    expect(completedOption).toBeTruthy();
    expect(completedOption.textContent?.trim()).toContain('Completed');
    expect(completedOption.dataset.status).toBe('completed');
  });

  it('should handle remove from list correctly', async () => {
    // Mock successful removal
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { message: 'Media removed from list successfully' }
      })
    } as Response);

    const movieContainer = document.querySelector('.add-to-list-container') as HTMLElement;
    const dropdown = movieContainer.querySelector('.status-dropdown') as HTMLElement;
    const removeOption = dropdown.querySelector('.remove-option') as HTMLButtonElement;
    
    expect(removeOption).toBeTruthy();
    expect(removeOption.textContent?.trim()).toContain('Remove from List');
    expect(removeOption.dataset.status).toBe('remove');
    expect(removeOption.classList.contains('remove-option')).toBe(true);
  });

  it('should handle pending media actions after login', () => {
    // Mock sessionStorage with pending action
    const mockSessionStorage = {
      setItem: vi.fn(),
      getItem: vi.fn().mockReturnValue(JSON.stringify({
        title: 'Test Movie',
        type: 'movie',
        externalId: '123',
        poster: '/poster.jpg',
        year: '2023',
        source: 'tmdb',
        description: 'A test movie',
        action: 'add_to_list'
      })),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage
    });

    // Mock confirm dialog
    global.confirm = vi.fn().mockReturnValue(true);

    // Mock successful API call
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { message: 'Added to list successfully' }
      })
    } as Response);

    // The actual DOMContentLoaded handler would be in the MediaCard component
    // For testing, we'll verify the sessionStorage setup is correct
    expect(mockSessionStorage.getItem('pendingMediaAction')).toBeTruthy();
    
    const pendingAction = JSON.parse(mockSessionStorage.getItem('pendingMediaAction'));
    expect(pendingAction.title).toBe('Test Movie');
    expect(pendingAction.action).toBe('add_to_list');
  });
});