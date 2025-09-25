import { supabase } from './supabase';

/**
 * Authentication helper functions for client-side usage
 */
export class AuthHelper {
  private static instance: AuthHelper;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  private constructor() {
    this.initializeTokens();
  }

  public static getInstance(): AuthHelper {
    if (!AuthHelper.instance) {
      AuthHelper.instance = new AuthHelper();
    }
    return AuthHelper.instance;
  }

  private async initializeTokens() {
    try {
      // Get current session from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        this.accessToken = session.access_token;
        this.refreshToken = session.refresh_token;
      }
    } catch (error) {
      console.error('Error initializing auth tokens:', error);
    }
  }

  /**
   * Get the current access token
   */
  public async getAccessToken(): Promise<string | null> {
    try {
      // First try to get from current session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        this.accessToken = session.access_token;
        return session.access_token;
      }

      // If no session, try to refresh
      const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
      if (refreshedSession) {
        this.accessToken = refreshedSession.access_token;
        return refreshedSession.access_token;
      }

      return null;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  /**
   * Get authorization header for API requests
   */
  public async getAuthHeader(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  /**
   * Check if user is authenticated
   */
  public async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
  }

  /**
   * Get current user
   */
  public async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Sign out user
   */
  public async signOut() {
    try {
      await supabase.auth.signOut();
      this.accessToken = null;
      this.refreshToken = null;
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }
}

// Export singleton instance
export const authHelper = AuthHelper.getInstance();

// Convenience functions
export async function getAuthHeader(): Promise<Record<string, string>> {
  return authHelper.getAuthHeader();
}

export async function isAuthenticated(): Promise<boolean> {
  return authHelper.isAuthenticated();
}

export async function getCurrentUser() {
  return authHelper.getCurrentUser();
}
