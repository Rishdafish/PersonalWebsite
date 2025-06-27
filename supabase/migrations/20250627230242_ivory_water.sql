/*
  # Fix Migration Cascade Dependencies

  This migration fixes the cascade dependency error by properly ordering the drop operations:
  1. Drop triggers first to remove dependencies
  2. Drop functions safely
  3. Recreate everything in correct order

  ## Changes Made
  - Reordered operations to handle dependencies correctly
  - Added proper CASCADE handling where needed
  - Ensured all RLS policies are updated for signup flow
*/

-- Drop existing trigger first to remove dependency on function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Now we can safely drop functions without cascade errors
DROP FUNCTION IF EXISTS check_trigger_status();
DROP FUNCTION IF EXISTS create_user_profile_manual(uuid, text, text);
DROP FUNCTION IF EXISTS create_user_profile_manual(uuid, text);
DROP FUNCTION IF EXISTS handle_new_user_signup();

-- Function to check trigger status (for debugging)
CREATE OR REPLACE FUNCTION check_trigger_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'triggers_exist', EXISTS(
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'on_auth_user_created'
    ),
    'functions_exist', EXISTS(
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'handle_new_user_signup'
    ),
    'timestamp', now()
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Function to handle new user signup (trigger function)
CREATE OR REPLACE FUNCTION handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role user_role := 'regular';
  user_token text;
BEGIN
  -- Get token from user metadata if available
  user_token := NEW.raw_user_meta_data->>'token';
  
  -- Determine role based on email or token
  IF NEW.email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    user_role := 'admin';
  ELSIF user_token IS NOT NULL THEN
    -- Check if token exists and is valid
    IF EXISTS (
      SELECT 1 FROM user_tokens 
      WHERE token = user_token AND is_active = true
    ) THEN
      user_role := 'specialized';
    END IF;
  END IF;

  -- Insert into users table
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();

  -- Insert into user_profiles table
  INSERT INTO public.user_profiles (id, email, role, token_used, created_at, updated_at)
  VALUES (NEW.id, NEW.email, user_role, user_token, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    token_used = EXCLUDED.token_used,
    updated_at = now();

  -- Insert into user_statistics table
  INSERT INTO public.user_statistics (user_id, total_hours, average_daily_hours, max_session_hours, days_since_start, current_streak, updated_at)
  VALUES (NEW.id, 0, 0, 0, 0, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  -- Create default achievements
  INSERT INTO public.achievements (user_id, title, description, icon, category, completed, created_at)
  VALUES 
    (NEW.id, 'Welcome!', 'Successfully created your account', '🎉', 'General', true, now()),
    (NEW.id, 'First Steps', 'Complete your first work entry', '👣', 'Progress', false, now()),
    (NEW.id, 'Dedicated', 'Log 10 hours of work', '💪', 'Progress', false, now()),
    (NEW.id, 'Consistent', 'Maintain a 7-day streak', '🔥', 'Streaks', false, now()),
    (NEW.id, 'Marathon', 'Log 100 hours total', '🏃', 'Milestones', false, now())
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error in handle_new_user_signup: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Function to manually create user profile
CREATE OR REPLACE FUNCTION create_user_profile_manual(
  user_id uuid,
  user_email text,
  user_token text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role user_role := 'regular';
  result json;
BEGIN
  -- Determine role based on email or token
  IF user_email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    user_role := 'admin';
  ELSIF user_token IS NOT NULL THEN
    -- Check if token exists and is valid
    IF EXISTS (
      SELECT 1 FROM user_tokens 
      WHERE token = user_token AND is_active = true
    ) THEN
      user_role := 'specialized';
    END IF;
  END IF;

  -- Insert into users table
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (user_id, user_email, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();

  -- Insert into user_profiles table
  INSERT INTO public.user_profiles (id, email, role, token_used, created_at, updated_at)
  VALUES (user_id, user_email, user_role, user_token, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    token_used = EXCLUDED.token_used,
    updated_at = now();

  -- Insert into user_statistics table
  INSERT INTO public.user_statistics (user_id, total_hours, average_daily_hours, max_session_hours, days_since_start, current_streak, updated_at)
  VALUES (user_id, 0, 0, 0, 0, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  -- Create default achievements
  INSERT INTO public.achievements (user_id, title, description, icon, category, completed, created_at)
  VALUES 
    (user_id, 'Welcome!', 'Successfully created your account', '🎉', 'General', true, now()),
    (user_id, 'First Steps', 'Complete your first work entry', '👣', 'Progress', false, now()),
    (user_id, 'Dedicated', 'Log 10 hours of work', '💪', 'Progress', false, now()),
    (user_id, 'Consistent', 'Maintain a 7-day streak', '🔥', 'Streaks', false, now()),
    (user_id, 'Marathon', 'Log 100 hours total', '🏃', 'Milestones', false, now())
  ON CONFLICT DO NOTHING;

  -- Return the created profile
  SELECT json_build_object(
    'id', id,
    'email', email,
    'role', role,
    'token_used', token_used,
    'created_at', created_at,
    'updated_at', updated_at
  ) INTO result
  FROM user_profiles
  WHERE id = user_id;

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating user profile: %', SQLERRM;
END;
$$;

-- Create trigger for new user signup (functions must exist before trigger)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_signup();

-- Ensure RLS policies allow profile creation during signup
DO $$
BEGIN
  -- Update user_profiles policies to allow creation during signup
  DROP POLICY IF EXISTS "Allow profile creation during signup" ON user_profiles;
  CREATE POLICY "Allow profile creation during signup"
    ON user_profiles
    FOR INSERT
    TO anon, authenticated, supabase_auth_admin
    WITH CHECK (true);

  -- Update users policies to allow creation during signup  
  DROP POLICY IF EXISTS "Allow user registration during signup" ON users;
  CREATE POLICY "Allow user registration during signup"
    ON users
    FOR INSERT
    TO anon, authenticated, supabase_auth_admin
    WITH CHECK (true);

  -- Update achievements policies to allow creation during signup
  DROP POLICY IF EXISTS "Allow achievement creation during signup" ON achievements;
  CREATE POLICY "Allow achievement creation during signup"
    ON achievements
    FOR INSERT
    TO anon, authenticated, supabase_auth_admin
    WITH CHECK (true);

  -- Update user_statistics policies to allow creation during signup
  DROP POLICY IF EXISTS "Allow statistics creation during signup" ON user_statistics;
  CREATE POLICY "Allow statistics creation during signup"
    ON user_statistics
    FOR INSERT
    TO anon, authenticated, supabase_auth_admin
    WITH CHECK (true);
END $$;