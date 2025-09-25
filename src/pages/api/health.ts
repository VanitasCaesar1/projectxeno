import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { createSuccessResponse, createErrorResponse, ERROR_CODES } from '../../lib/errorHandler';

export const GET: APIRoute = async () => {
  try {
    // Simple database connectivity check
    const { data, error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" which is fine for health check
      throw error;
    }

    return createSuccessResponse({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });

  } catch (error) {
    console.error('Health check failed:', error);
    return createErrorResponse(
      ERROR_CODES.DATABASE_ERROR,
      'Service temporarily unavailable',
      null,
      null,
      503
    );
  }
};

export const HEAD: APIRoute = async () => {
  try {
    // Lightweight health check for HEAD requests
    const { error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return new Response(null, { status: 200 });

  } catch (error) {
    return new Response(null, { status: 503 });
  }
};