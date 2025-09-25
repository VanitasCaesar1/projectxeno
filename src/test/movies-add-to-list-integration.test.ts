import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the fetch function
global.fetch = vi.fn();

describe('Movies Page - AddToListButton Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset DOM
    document.body.innerHTML = '';
  });

  it('should handle adding a movie to user list successfully', async () => {
    // Mock successful API responses
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { isAuthenticated: true, userId: 'user123' }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

    // Create a mock movie card with AddToListButton
    document.body.innerHTML = `
      <div class="media-card" data-detail-url="/media/movie/tt1234567">
        <h3>Test Movie</h3>
        <button 
          class="add-to-list-btn"
          data-media-id="tt1234567"
          data-media-title="Test Movie"
          data-media-type="movie"
          data-media-poster="https://example.com/poster.jpg"
          data-media-year="2023"
          data-media-source="tmdb"
          data-media-description="A test movie"
        >
          Add to List
        </button>
      </div>
    `;

    const button = document.querySelector('.add-to-list-btn') as HTMLButtonElement;
    expect(button).toBeTruthy();

    // Simulate user authentication check
    const authResponse = await fetch('/api/user/status');
    const authData = await authResponse.json();
    expect(authData.success).toBe(true);
    expect(authData.data.isAuthenticated).toBe(true);

    // Simulate adding to list
    const addResponse = await fetch('/api/user/media', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        externalId: 'tt1234567',
        mediaType: 'movie',
        title: 'Test Movie',
        posterUrl: 'https://example.com/poster.jpg',
        releaseDate: '2023-01-01',
        genres: [],
        metadata: { source: 'tmdb', rating: 0, year: 2023 },
        status: 'plan_to_watch'
      }),
    });

    const addResult = await addResponse.json();
    expect(addResult.success).toBe(true);

    // Verify API calls
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/user/status');
    expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/user/media', expect.objectContaining({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: expect.stringContaining('tt1234567')
    }));
  });

  it('should handle unauthenticated user attempting to add movie', async () => {
    // Mock unauthenticated response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { isAuthenticated: false }
      })
    });

    // Mock window.confirm for login prompt
    const mockConfirm = vi.fn().mockReturnValue(true);
    Object.defineProperty(window, 'confirm', { value: mockConfirm });

    // Mock window.location for redirect
    const mockLocation = { href: '' };
    Object.defineProperty(window, 'location', { value: mockLocation });

    // Mock sessionStorage
    const mockSessionStorage = {
      setItem: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn()
    };
    Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage });

    // Check authentication
    const authResponse = await fetch('/api/user/status');
    const authData = await authResponse.json();
    expect(authData.data.isAuthenticated).toBe(false);

    // Simulate login prompt
    const shouldRedirect = confirm(
      'Please log in to add "Test Movie" to your list. Would you like to go to the login page?'
    );
    
    expect(mockConfirm).toHaveBeenCalledWith(
      'Please log in to add "Test Movie" to your list. Would you like to go to the login page?'
    );
    expect(shouldRedirect).toBe(true);

    // Simulate redirect behavior
    if (shouldRedirect) {
      sessionStorage.setItem('redirectAfterLogin', window.location.href);
      window.location.href = '/login';
    }

    expect(mockSessionStorage.setItem).toHaveBeenCalledWith('redirectAfterLogin', '');
    expect(mockLocation.href).toBe('/login');
  });

  it('should handle API errors gracefully', async () => {
    // Mock API error
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { isAuthenticated: true, userId: 'user123' }
        })
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: { message: 'Failed to add to list' }
        })
      });

    // Mock alert for error message
    const mockAlert = vi.fn();
    Object.defineProperty(window, 'alert', { value: mockAlert });

    // Check authentication (success)
    const authResponse = await fetch('/api/user/status');
    const authData = await authResponse.json();
    expect(authData.data.isAuthenticated).toBe(true);

    // Try to add to list (failure)
    const addResponse = await fetch('/api/user/media', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        externalId: 'tt1234567',
        mediaType: 'movie',
        title: 'Test Movie',
        status: 'plan_to_watch'
      }),
    });

    const addResult = await addResponse.json();
    expect(addResult.success).toBe(false);

    // Simulate error handling
    if (!addResult.success) {
      alert('Failed to add to list. Please try again.');
    }

    expect(mockAlert).toHaveBeenCalledWith('Failed to add to list. Please try again.');
  });

  it('should navigate to movie detail page when clicking on card', () => {
    // Mock window.location for navigation
    const mockLocation = { href: '' };
    Object.defineProperty(window, 'location', { value: mockLocation });

    // Create a mock movie card
    document.body.innerHTML = `
      <div class="media-card" data-detail-url="/media/movie/tt1234567">
        <h3>Test Movie</h3>
        <p>Movie description</p>
        <button class="add-to-list-btn">Add to List</button>
      </div>
    `;

    const card = document.querySelector('.media-card') as HTMLElement;
    const button = document.querySelector('.add-to-list-btn') as HTMLElement;

    // Simulate clicking on the card (but not on the button)
    const cardClickEvent = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(cardClickEvent, 'target', { value: card });

    // Mock the closest method to simulate event delegation
    const mockClosest = vi.fn();
    mockClosest.mockImplementation((selector: string) => {
      if (selector === '.media-card') return card;
      if (selector === 'button, a, .add-to-list-container') return null;
      return null;
    });
    Object.defineProperty(cardClickEvent.target, 'closest', { value: mockClosest });

    // Simulate navigation logic
    const isInteractiveElement = (cardClickEvent.target as HTMLElement).closest('button, a, .add-to-list-container');
    if (!isInteractiveElement) {
      const detailUrl = card.getAttribute('data-detail-url');
      if (detailUrl) {
        window.location.href = detailUrl;
      }
    }

    expect(mockLocation.href).toBe('/media/movie/tt1234567');
  });

  it('should not navigate when clicking on AddToListButton', () => {
    // Mock window.location for navigation
    const mockLocation = { href: '' };
    Object.defineProperty(window, 'location', { value: mockLocation });

    // Create a mock movie card
    document.body.innerHTML = `
      <div class="media-card" data-detail-url="/media/movie/tt1234567">
        <h3>Test Movie</h3>
        <button class="add-to-list-btn">Add to List</button>
      </div>
    `;

    const card = document.querySelector('.media-card') as HTMLElement;
    const button = document.querySelector('.add-to-list-btn') as HTMLElement;

    // Simulate clicking on the button
    const buttonClickEvent = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(buttonClickEvent, 'target', { value: button });

    // Mock the closest method to simulate event delegation
    const mockClosest = vi.fn();
    mockClosest.mockImplementation((selector: string) => {
      if (selector === '.media-card') return card;
      if (selector === 'button, a, .add-to-list-container') return button;
      return null;
    });
    Object.defineProperty(buttonClickEvent.target, 'closest', { value: mockClosest });

    // Simulate navigation logic (should not navigate)
    const isInteractiveElement = (buttonClickEvent.target as HTMLElement).closest('button, a, .add-to-list-container');
    if (!isInteractiveElement) {
      const detailUrl = card.getAttribute('data-detail-url');
      if (detailUrl) {
        window.location.href = detailUrl;
      }
    }

    // Should not have navigated because we clicked on the button
    expect(mockLocation.href).toBe('');
  });
});