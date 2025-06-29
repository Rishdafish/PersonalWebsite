/*
  # Fix user signup process

  1. Database Functions
    - Create or replace the user signup handler function
    - Add manual profile creation function
    - Ensure proper error handling

  2. Security
    - Update RLS policies to allow signup operations
    - Ensure service role and auth admin can create profiles

  3. Triggers
    - Fix the new user signup trigger
*/

-- First, let's create a robust function to handle new user signups
CREATE OR REPLACE FUNCTION handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  user_role_to_assign user_role := 'regular';
  token_to_use text := NULL;
BEGIN
  -- Log the signup attempt
  RAISE LOG 'New user signup: %', NEW.email;
  
  -- Check if this is an admin email
  IF NEW.email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    user_role_to_assign := 'admin';
    RAISE LOG 'Admin role assigned to: %', NEW.email;
  END IF;
  
  -- Check for token in user metadata
  IF NEW.raw_user_meta_data IS NOT NULL AND NEW.raw_user_meta_data ? 'token' THEN
    token_to_use := NEW.raw_user_meta_data->>'token';
    RAISE LOG 'Token found in metadata: %', token_to_use;
    
    -- Validate token and assign specialized role if valid
    IF EXISTS (
      SELECT 1 FROM user_tokens 
      WHERE token = token_to_use AND is_active = true
    ) THEN
      user_role_to_assign := 'specialized';
      RAISE LOG 'Specialized role assigned via token: %', NEW.email;
    END IF;
  END IF;

  -- Insert into users table
  BEGIN
    INSERT INTO public.users (id, email, created_at, updated_at)
    VALUES (NEW.id, NEW.email, NOW(), NOW());
    RAISE LOG 'User record created: %', NEW.email;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error creating user record: %', SQLERRM;
    -- Continue even if user record creation fails
  END;

  -- Insert into user_profiles table
  BEGIN
    INSERT INTO public.user_profiles (id, email, role, token_used, created_at, updated_at)
    VALUES (NEW.id, NEW.email, user_role_to_assign, token_to_use, NOW(), NOW());
    RAISE LOG 'User profile created: % with role: %', NEW.email, user_role_to_assign;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error creating user profile: %', SQLERRM;
    RAISE EXCEPTION 'Failed to create user profile: %', SQLERRM;
  END;

  -- Insert into user_statistics table
  BEGIN
    INSERT INTO public.user_statistics (user_id, total_hours, average_daily_hours, max_session_hours, days_since_start, current_streak, updated_at)
    VALUES (NEW.id, 0, 0, 0, 0, 0, NOW());
    RAISE LOG 'User statistics created: %', NEW.email;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error creating user statistics: %', SQLERRM;
    -- Continue even if statistics creation fails
  END;

  -- Create default achievements
  BEGIN
    INSERT INTO public.achievements (user_id, title, description, icon, category, completed, created_at)
    VALUES 
      (NEW.id, 'Welcome!', 'You''ve successfully created your account', '🎉', 'General', true, NOW()),
      (NEW.id, 'First Steps', 'Complete your first hour of work', '👣', 'Hours', false, NOW()),
      (NEW.id, 'Dedicated', 'Log 10 hours of work', '💪', 'Hours', false, NOW()),
      (NEW.id, 'Consistent', 'Maintain a 7-day streak', '🔥', 'Streaks', false, NOW()),
      (NEW.id, 'Prolific', 'Complete 5 subjects', '📚', 'Subjects', false, NOW());
    RAISE LOG 'Default achievements created: %', NEW.email;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error creating achievements: %', SQLERRM;
    -- Continue even if achievements creation fails
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Critical error in handle_new_user_signup: %', SQLERRM;
  RAISE EXCEPTION 'User signup failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the manual profile creation function
CREATE OR REPLACE FUNCTION create_user_profile_manual(
  p_user_id uuid,
  p_user_email text,
  p_user_token text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  user_role_to_assign user_role := 'regular';
  result_profile json;
BEGIN
  -- Check if this is an admin email
  IF p_user_email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    user_role_to_assign := 'admin';
  END IF;
  
  -- Check for valid token
  IF p_user_token IS NOT NULL AND EXISTS (
    SELECT 1 FROM user_tokens 
    WHERE token = p_user_token AND is_active = true
  ) THEN
    user_role_to_assign := 'specialized';
  END IF;

  -- Insert or update user profile
  INSERT INTO public.user_profiles (id, email, role, token_used, created_at, updated_at)
  VALUES (p_user_id, p_user_email, user_role_to_assign, p_user_token, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    token_used = EXCLUDED.token_used,
    updated_at = NOW();

  -- Get the created/updated profile
  SELECT to_json(up.*) INTO result_profile
  FROM user_profiles up
  WHERE up.id = p_user_id;

  -- Ensure user statistics exist
  INSERT INTO public.user_statistics (user_id, total_hours, average_daily_hours, max_session_hours, days_since_start, current_streak, updated_at)
  VALUES (p_user_id, 0, 0, 0, 0, 0, NOW())
  ON CONFLICT (user_id) DO NOTHING;

  -- Ensure basic achievements exist
  INSERT INTO public.achievements (user_id, title, description, icon, category, completed, created_at)
  SELECT p_user_id, title, description, icon, category, completed, NOW()
  FROM (VALUES 
    ('Welcome!', 'You''ve successfully created your account', '🎉', 'General', true),
    ('First Steps', 'Complete your first hour of work', '👣', 'Hours', false),
    ('Dedicated', 'Log 10 hours of work', '💪', 'Hours', false),
    ('Consistent', 'Maintain a 7-day streak', '🔥', 'Streaks', false),
    ('Prolific', 'Complete 5 subjects', '📚', 'Subjects', false)
  ) AS default_achievements(title, description, icon, category, completed)
  WHERE NOT EXISTS (
    SELECT 1 FROM achievements 
    WHERE user_id = p_user_id AND title = default_achievements.title
  );

  RETURN result_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger for new user signups
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_signup();

-- Update RLS policies to ensure signup operations work

-- User profiles policies
DROP POLICY IF EXISTS "Allow profile creation during signup" ON user_profiles;
CREATE POLICY "Allow profile creation during signup"
  ON user_profiles
  FOR INSERT
  TO anon, authenticated, supabase_auth_admin
  WITH CHECK (true);

-- User statistics policies  
DROP POLICY IF EXISTS "Allow statistics creation during signup" ON user_statistics;
CREATE POLICY "Allow statistics creation during signup"
  ON user_statistics
  FOR INSERT
  TO anon, authenticated, supabase_auth_admin
  WITH CHECK (true);

-- Achievements policies
DROP POLICY IF EXISTS "Allow achievement creation during signup" ON achievements;
CREATE POLICY "Allow achievement creation during signup"
  ON achievements
  FOR INSERT
  TO anon, authenticated, supabase_auth_admin
  WITH CHECK (true);

-- Users table policies
DROP POLICY IF EXISTS "Allow user registration during signup" ON users;
CREATE POLICY "Allow user registration during signup"
  ON users
  FOR INSERT
  TO anon, authenticated, supabase_auth_admin
  WITH CHECK (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, supabase_auth_admin;
GRANT INSERT ON public.users TO anon, authenticated, supabase_auth_admin;
GRANT INSERT ON public.user_profiles TO anon, authenticated, supabase_auth_admin;
GRANT INSERT ON public.user_statistics TO anon, authenticated, supabase_auth_admin;
GRANT INSERT ON public.achievements TO anon, authenticated, supabase_auth_admin;
GRANT SELECT ON public.user_tokens TO anon, authenticated, supabase_auth_admin;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION handle_new_user_signup() TO anon, authenticated, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION create_user_profile_manual(uuid, text, text) TO anon, authenticated, supabase_auth_admin;