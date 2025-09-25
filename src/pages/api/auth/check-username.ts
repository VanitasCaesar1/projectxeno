import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const GET: APIRoute = async ({ url }) => {
  const username = url.searchParams.get("username");

  if (!username) {
    return new Response(JSON.stringify({ 
      available: false, 
      error: "Username is required" 
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Validate username format
  if (username.length < 3) {
    return new Response(JSON.stringify({ 
      available: false, 
      error: "Username must be at least 3 characters long" 
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return new Response(JSON.stringify({ 
      available: false, 
      error: "Username can only contain letters, numbers, and underscores" 
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // Check if username exists in user_profiles table
    const { data, error } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('username', username)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error('Database error:', error);
      return new Response(JSON.stringify({ 
        available: false, 
        error: "Error checking username availability" 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // If data exists, username is taken
    const available = !data;

    return new Response(JSON.stringify({ 
      available,
      username 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('Error checking username:', error);
    return new Response(JSON.stringify({ 
      available: false, 
      error: "Error checking username availability" 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};