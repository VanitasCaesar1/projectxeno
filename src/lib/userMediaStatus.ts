// Client-side utility for handling user media status
export interface UserMediaStatusMap {
  [externalId: string]: string;
}

export interface UserAuthStatus {
  isAuthenticated: boolean;
  userId?: string;
}

// Check if user is authenticated
export async function checkUserAuth(): Promise<UserAuthStatus> {
  try {
    const response = await fetch('/api/user/status');
    const data = await response.json();
    
    if (data.success && data.data.isAuthenticated) {
      return {
        isAuthenticated: true,
        userId: data.data.userId
      };
    }
    
    return { isAuthenticated: false };
  } catch (error) {
    console.warn('Failed to check user authentication:', error);
    return { isAuthenticated: false };
  }
}

// Fetch user media status for multiple items
export async function fetchUserMediaStatus(
  externalIds: string[], 
  mediaType?: string
): Promise<UserMediaStatusMap> {
  try {
    const userAuth = await checkUserAuth();
    if (!userAuth.isAuthenticated) {
      return {};
    }

    const params = new URLSearchParams({
      externalIds: externalIds.join(','),
    });
    
    if (mediaType) {
      params.append('mediaType', mediaType);
    }

    const response = await fetch(`/api/user/media-status?${params}`);
    const data = await response.json();
    
    if (data.success) {
      return data.data || {};
    }
    
    return {};
  } catch (error) {
    console.warn('Failed to fetch user media status:', error);
    return {};
  }
}

// Show login prompt for unauthenticated users
export function showLoginPrompt(mediaTitle: string): void {
  const shouldRedirect = confirm(
    `Please log in to add "${mediaTitle}" to your list. Would you like to go to the login page?`
  );
  
  if (shouldRedirect) {
    // Store the current page URL to redirect back after login
    sessionStorage.setItem('redirectAfterLogin', window.location.href);
    window.location.href = '/login';
  }
}

// Handle add to list action
export async function handleAddToList(
  externalId: string,
  mediaType: string,
  title: string,
  poster?: string,
  year?: number,
  source?: string,
  description?: string
): Promise<boolean> {
  try {
    const userAuth = await checkUserAuth();
    if (!userAuth.isAuthenticated) {
      showLoginPrompt(title);
      return false;
    }

    const response = await fetch('/api/user/media', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        externalId,
        mediaType,
        title,
        description,
        posterUrl: poster,
        releaseDate: year ? `${year}-01-01` : undefined,
        genres: [],
        metadata: { source, rating: 0, year },
        status: 'plan_to_watch' // Default status
      }),
    });

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Failed to add to list:', error);
    return false;
  }
}