import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ cookies }) => {
  try {
    // Check authentication
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    if (!accessToken || !refreshToken) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' }
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Set up Supabase session
    supabase.auth.setSession({
      access_token: accessToken.value,
      refresh_token: refreshToken.value,
    });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid session' }
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Start comprehensive data cleanup
    // Note: We'll manually delete data in the correct order to ensure clean removal
    
    try {
      // Step 1: Delete user activities (no foreign key dependencies)
      const { error: activitiesError } = await supabase
        .from('user_activities')
        .delete()
        .eq('user_id', user.id);

      if (activitiesError) {
        console.error('Error deleting user activities:', activitiesError);
      }

      // Step 2: Delete review likes (depends on reviews)
      const { error: likesError } = await supabase
        .from('review_likes')
        .delete()
        .eq('user_id', user.id);

      if (likesError) {
        console.error('Error deleting review likes:', likesError);
      }

      // Step 3: Delete user follows (both as follower and following)
      const { error: followsError1 } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', user.id);

      const { error: followsError2 } = await supabase
        .from('user_follows')
        .delete()
        .eq('following_id', user.id);

      if (followsError1 || followsError2) {
        console.error('Error deleting user follows:', followsError1 || followsError2);
      }

      // Step 4: Delete reviews (this will also remove associated likes due to foreign keys)
      const { error: reviewsError } = await supabase
        .from('reviews')
        .delete()
        .eq('user_id', user.id);

      if (reviewsError) {
        console.error('Error deleting reviews:', reviewsError);
      }

      // Step 5: Delete user media entries
      const { error: userMediaError } = await supabase
        .from('user_media')
        .delete()
        .eq('user_id', user.id);

      if (userMediaError) {
        console.error('Error deleting user media:', userMediaError);
      }

      // Step 6: Delete user preferences
      const { error: preferencesError } = await supabase
        .from('user_preferences')
        .delete()
        .eq('user_id', user.id);

      if (preferencesError) {
        console.error('Error deleting user preferences:', preferencesError);
      }

      // Step 7: Delete user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', user.id);

      if (profileError) {
        console.error('Error deleting user profile:', profileError);
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'DATABASE_ERROR', message: 'Failed to delete user profile data' }
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Step 8: Delete the auth user (this is the final step)
      const { error: authError } = await supabase.auth.admin.deleteUser(user.id);

      if (authError) {
        console.error('Error deleting auth user:', authError);
        // Note: At this point, profile data is already deleted
        // In a production app, you'd want to log this for manual cleanup
        return new Response(JSON.stringify({
          success: false,
          error: { code: 'AUTH_ERROR', message: 'Account data deleted but auth user removal failed. Please contact support.' }
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Clear cookies
      cookies.delete("sb-access-token", { path: "/" });
      cookies.delete("sb-refresh-token", { path: "/" });

      return new Response(JSON.stringify({
        success: true,
        message: 'Account deleted successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Error during account deletion:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'DELETION_ERROR', message: 'Failed to delete account completely' }
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Account deletion error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Redirect GET requests to a confirmation page
export const GET: APIRoute = async ({ cookies }) => {
  // Check if user is authenticated
  const accessToken = cookies.get("sb-access-token");
  const refreshToken = cookies.get("sb-refresh-token");

  if (!accessToken || !refreshToken) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/login' }
    });
  }

  // Redirect to a confirmation page
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Delete Account</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-50 min-h-screen flex items-center justify-center">
      <div class="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div class="text-center">
          <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <svg class="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 class="text-xl font-bold text-gray-900 mb-4">Delete Account</h2>
          <p class="text-gray-600 mb-6">
            Are you sure you want to delete your account? This action cannot be undone and will permanently delete all your data including lists, ratings, and reviews.
          </p>
          <div class="flex space-x-4">
            <button 
              onclick="window.history.back()" 
              class="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button 
              onclick="deleteAccount()" 
              class="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>
      
      <script>
        async function deleteAccount() {
          if (confirm('This will permanently delete all your data. Are you absolutely sure?')) {
            try {
              const response = await fetch('/api/user/delete-account', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                }
              });
              
              const data = await response.json();
              
              if (data.success) {
                alert('Your account has been deleted successfully.');
                window.location.href = '/';
              } else {
                alert('Error deleting account: ' + (data.error?.message || 'Unknown error'));
              }
            } catch (error) {
              alert('Error deleting account: ' + error.message);
            }
          }
        }
      </script>
    </body>
    </html>
  `, {
    status: 200,
    headers: { 'Content-Type': 'text/html' }
  });
};