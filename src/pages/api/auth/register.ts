import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { 
  createErrorResponse, 
  createSuccessResponse, 
  handleAuthError, 
  validateRequestBody, 
  validators,
  withErrorHandling,
  ERROR_CODES 
} from "../../../lib/errorHandler";

export const POST: APIRoute = withErrorHandling(async ({ request, redirect }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const confirmPassword = formData.get("confirmPassword")?.toString();
  const username = formData.get("username")?.toString();

  // Validate request body
  const validation = validateRequestBody(
    { email, password, confirmPassword, username },
    {
      email: (value) => validators.required(value, 'Email'),
      password: (value) => validators.required(value, 'Password'),
      confirmPassword: (value) => validators.required(value, 'Confirm Password'),
      username: (value) => validators.required(value, 'Username')
    }
  );

  if (!validation.valid) {
    const firstError = Object.values(validation.errors)[0];
    return redirect(`/register?error=validation&message=${encodeURIComponent(firstError)}`);
  }

  // Additional validation
  const emailValidation = validators.email(email!);
  if (!emailValidation) {
    return redirect(`/register?error=validation&message=${encodeURIComponent("Please enter a valid email address")}`);
  }

  const passwordValidation = validators.password(password!);
  if (!passwordValidation.valid) {
    return redirect(`/register?error=validation&message=${encodeURIComponent(passwordValidation.message!)}`);
  }

  const usernameValidation = validators.username(username!);
  if (!usernameValidation.valid) {
    return redirect(`/register?error=validation&message=${encodeURIComponent(usernameValidation.message!)}`);
  }

  if (password !== confirmPassword) {
    return redirect(`/register?error=validation&message=${encodeURIComponent("Passwords do not match")}`);
  }

  // Check if username is already taken
  const { data: existingUser } = await supabase
    .from('user_profiles')
    .select('username')
    .eq('username', username)
    .single();

  if (existingUser) {
    return redirect(`/register?error=validation&message=${encodeURIComponent("Username is already taken")}`);
  }

  // Sign up user with metadata
  const { data, error } = await supabase.auth.signUp({
    email: email!,
    password: password!,
    options: {
      data: {
        username: username,
        display_name: username
      }
    }
  });

  if (error) {
    console.error('Registration error:', error);
    
    // Handle specific error cases
    if (error.message.includes('already registered')) {
      return redirect(`/register?error=auth&message=${encodeURIComponent("An account with this email already exists")}`);
    }
    
    if (error.message.includes('Password should be')) {
      return redirect(`/register?error=auth&message=${encodeURIComponent("Password does not meet requirements")}`);
    }

    if (error.message.includes('Invalid email')) {
      return redirect(`/register?error=auth&message=${encodeURIComponent("Please enter a valid email address")}`);
    }

    if (error.message.includes('Too many requests')) {
      return redirect(`/register?error=auth&message=${encodeURIComponent("Too many registration attempts. Please wait before trying again.")}`);
    }

    return redirect(`/register?error=auth&message=${encodeURIComponent("Registration failed. Please try again.")}`);
  }

  // If user was created successfully, redirect to login with success message
  if (data.user) {
    return redirect(`/login?message=${encodeURIComponent("Account created successfully! Please check your email to verify your account, then sign in.")}`);
  }

  return redirect(`/register?error=unknown&message=${encodeURIComponent("Something went wrong. Please try again.")}`);
});