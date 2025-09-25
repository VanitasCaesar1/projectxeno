import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  try {
    const formData = await request.formData();
    const username = formData.get("username")?.toString();
    const displayName = formData.get("displayName")?.toString();
    const bio = formData.get("bio")?.toString();
    const privacyLevel = formData.get("privacyLevel")?.toString() || 'public';

    // Get user from session
    const accessToken = cookies.get("sb-access-token");
    const refreshToken = cookies.get("sb-refresh-token");

    if (!accessToken || !refreshToken) {
      return redirect("/login");
    }

    supabase.auth.setSession({
      access_token: accessToken.value,
      refresh_token: refreshToken.value,
    });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return redirect("/login");
    }

    // Validation
    if (!username) {
      return redirect(`/profile/setup?error=validation&message=${encodeURIComponent("Username is required")}`);
    }

    if (username.length < 3) {
      return redirect(`/profile/setup?error=validation&message=${encodeURIComponent("Username must be at least 3 characters long")}`);
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return redirect(`/profile/setup?error=validation&message=${encodeURIComponent("Username can only contain letters, numbers, and underscores")}`);
    }

    // Check if username is already taken
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('username', username)
      .single();

    if (existingUser) {
      return redirect(`/profile/setup?error=validation&message=${encodeURIComponent("Username is already taken")}`);
    }

    // Check if profile already exists for this user
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (existingProfile) {
      // Update existing profile
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          username,
          display_name: displayName || username,
          bio: bio || null,
          privacy_level: privacyLevel,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Profile update error:', updateError);
        return redirect(`/profile/setup?error=database&message=${encodeURIComponent("Failed to update profile. Please try again.")}`);
      }
    } else {
      // Create new profile
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          username,
          display_name: displayName || username,
          bio: bio || null,
          privacy_level: privacyLevel
        });

      if (insertError) {
        console.error('Profile creation error:', insertError);
        
        if (insertError.code === '23505') { // Unique constraint violation
          return redirect(`/profile/setup?error=validation&message=${encodeURIComponent("Username is already taken")}`);
        }
        
        return redirect(`/profile/setup?error=database&message=${encodeURIComponent("Failed to create profile. Please try again.")}`);
      }

      // Create user preferences
      const { error: preferencesError } = await supabase
        .from('user_preferences')
        .insert({
          user_id: user.id
        });

      if (preferencesError) {
        console.error('Preferences creation error:', preferencesError);
        // Don't fail the whole process for preferences
      }
    }

    // Redirect to profile page
    return redirect("/profile");

  } catch (error) {
    console.error('Profile setup error:', error);
    return redirect(`/profile/setup?error=server&message=${encodeURIComponent("Server error. Please try again later.")}`);
  }
};