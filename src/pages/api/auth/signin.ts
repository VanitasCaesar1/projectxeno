
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { 
  validateRequestBody, 
  validators,
  withErrorHandling,
  ERROR_CODES 
} from "../../../lib/errorHandler";

export const POST: APIRoute = withErrorHandling(async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const redirectUrl = formData.get("redirect")?.toString();

  // Validate request body
  const validation = validateRequestBody(
    { email, password },
    {
      email: (value) => validators.required(value, 'Email'),
      password: (value) => validators.required(value, 'Password')
    }
  );

  if (!validation.valid) {
    const firstError = Object.values(validation.errors)[0];
    return redirect(`/login?error=validation&message=${encodeURIComponent(firstError)}`);
  }

  // Additional email validation
  const emailValidation = validators.email(email!);
  if (!emailValidation) {
    return redirect(`/login?error=validation&message=${encodeURIComponent("Please enter a valid email address")}`);
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email!,
    password: password!,
  });

  if (error) {
    console.error('Sign in error:', error);
    
    // Handle specific error cases with user-friendly messages
    if (error.message.includes('Invalid login credentials')) {
      return redirect(`/login?error=auth&message=${encodeURIComponent("Invalid email or password. Please check your credentials and try again.")}`);
    }
    
    if (error.message.includes('Email not confirmed')) {
      return redirect(`/login?error=auth&message=${encodeURIComponent("Please check your email and click the confirmation link before signing in.")}`);
    }

    if (error.message.includes('Too many requests')) {
      return redirect(`/login?error=auth&message=${encodeURIComponent("Too many login attempts. Please wait a moment and try again.")}`);
    }

    if (error.message.includes('User not found')) {
      return redirect(`/login?error=auth&message=${encodeURIComponent("No account found with this email address.")}`);
    }

    return redirect(`/login?error=auth&message=${encodeURIComponent("Sign in failed. Please try again.")}`);
  }

  if (!data.session) {
    return redirect(`/login?error=auth&message=${encodeURIComponent("Sign in failed. Please try again.")}`);
  }

  // Set session cookies with enhanced security
  const { access_token, refresh_token } = data.session;
  const isProduction = import.meta.env.PROD;
  
  cookies.set("sb-access-token", access_token, {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7 // 7 days
  });
  
  cookies.set("sb-refresh-token", refresh_token, {
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30 // 30 days
  });

  // Check if user has completed profile setup
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('username, display_name')
    .eq('id', data.user.id)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    console.error('Profile lookup error:', profileError);
    // Continue with redirect even if profile lookup fails
  }

  // If profile exists, redirect to the specified URL or dashboard
  if (profile) {
    return redirect(redirectUrl || "/dashboard");
  }

  // If no profile, redirect to profile setup
  return redirect("/profile/setup");
});