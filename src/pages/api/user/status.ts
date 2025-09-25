import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import type { ApiResponse } from '../../../types/database';

// GET /api/user/status - Check if user is authenticated
export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    // Get tokens from cookies
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;

    if (!accessToken || !refreshToken) {
      const response: ApiResponse = {
        success: true,
        data: {
          isAuthenticated: false,
          userId: null,
          email: null
        }
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Set the session for this request
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error || !user) {
      const response: ApiResponse = {
        success: true,
        data: {
          isAuthenticated: false,
          userId: null,
          email: null
        }
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const response: ApiResponse = {
      success: true,
      data: {
        isAuthenticated: true,
        userId: user.id,
        email: user.email || null
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error checking user status:', error);
    
    const response: ApiResponse = {
      success: true,
      data: {
        isAuthenticated: false,
        userId: null,
        email: null
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};