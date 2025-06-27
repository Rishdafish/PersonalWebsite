/*
  # Fix user_role enum type and column dependencies

  1. Database Changes
    - Recreate user_role enum type if missing
    - Temporarily drop policies that depend on the role column
    - Update user_profiles.role column to use enum type
    - Recreate all dependent policies
    - Create/update trigger functions for user signup
    - Ensure proper RLS policies for signup process

  2. Security
    - Maintain all existing RLS policies
    - Ensure signup process has proper permissions
    - Preserve role-based access controls
*/

-- Drop existing trigger first to remove dependency on function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Now we can safely drop functions without cascade errors
DROP FUNCTION IF EXISTS check_trigger_status();
DROP FUNCTION IF EXISTS create_user_profile_manual(uuid, text, text);
DROP FUNCTION IF EXISTS create_user_profile_manual(uuid, text);
DROP FUNCTION IF EXISTS handle_new_user_signup();

-- Recreate the user_role enum type if it doesn't exist
DO $$
BEGIN
  -- Check if the enum type exists, if not create it
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'regular', 'specialized');
  END IF;
END $$;

-- Temporarily drop policies that depend on the role column
DO $$
BEGIN
  -- Drop policies that reference user_profiles.role
  DROP POLICY IF EXISTS "Admins can delete any comment" ON blog_comments;
  DROP POLICY IF EXISTS "Admins can manage all blog posts" ON blog_posts;
  DROP POLICY IF EXISTS "Admins can manage all projects" ON projects;
  
  -- Drop any other policies that might reference the role column
  DROP POLICY IF EXISTS "Allow authenticated users to read own profile" ON user_profiles;
  DROP POLICY IF EXISTS "Allow authenticated users to update own profile" ON user_profiles;
  DROP POLICY IF EXISTS "Allow profile creation during signup" ON user_profiles;
  DROP POLICY IF EXISTS "Service role can manage profiles" ON user_profiles;
END $$;

-- Now safely update the user_profiles.role column
DO $$
BEGIN
  -- Check if the column exists and update it to use the enum type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name = 'role'
    AND table_schema = 'public'
  ) THEN
    -- Update the column to use the enum type and set default
    ALTER TABLE user_profiles 
    ALTER COLUMN role TYPE user_role USING role::user_role,
    ALTER COLUMN role SET DEFAULT 'regular'::user_role;
  ELSE
    -- If column doesn't exist, add it
    ALTER TABLE user_profiles 
    ADD COLUMN role user_role NOT NULL DEFAULT 'regular'::user_role;
  END IF;
END $$;

-- Recreate all the policies that were dropped
DO $$
BEGIN
  -- Recreate user_profiles policies
  CREATE POLICY "Allow authenticated users to read own profile"
    ON user_profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

  CREATE POLICY "Allow authenticated users to update own profile"
    ON user_profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

  CREATE POLICY "Allow profile creation during signup"
    ON user_profiles
    FOR INSERT
    TO anon, authenticated, supabase_auth_admin
    WITH CHECK (true);

  CREATE POLICY "Service role can manage profiles"
    ON user_profiles
    FOR ALL
    TO service_role, supabase_auth_admin
    USING (true)
    WITH CHECK (true);

  -- Recreate admin policies that depend on role
  CREATE POLICY "Admins can delete any comment"
    ON blog_comments
    FOR DELETE
    TO authenticated
    USING (EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'::user_role
    ));

  CREATE POLICY "Admins can manage all blog posts"
    ON blog_posts
    FOR ALL
    TO authenticated
    USING (EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'::user_role
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'::user_role
    ));

  CREATE POLICY "Admins can manage all projects"
    ON projects
    FOR ALL
    TO authenticated
    USING (EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'::user_role
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'::user_role
    ));
END $$;

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
    'enum_exists', EXISTS(
      SELECT 1 FROM pg_type WHERE typname = 'user_role'
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
  user_role_val user_role := 'regular'::user_role;
  user_token text;
BEGIN
  -- Get token from user metadata if available
  user_token := NEW.raw_user_meta_data->>'token';
  
  -- Determine role based on email or token
  IF NEW.email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    user_role_val := 'admin'::user_role;
  ELSIF user_token IS NOT NULL THEN
    -- Check if token exists and is valid
    IF EXISTS (
      SELECT 1 FROM user_tokens 
      WHERE token = user_token AND is_active = true
    ) THEN
      user_role_val := 'specialized'::user_role;
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
  VALUES (NEW.id, NEW.email, user_role_val, user_token, now(), now())
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
  user_role_val user_role := 'regular'::user_role;
  result json;
BEGIN
  -- Determine role based on email or token
  IF user_email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    user_role_val := 'admin'::user_role;
  ELSIF user_token IS NOT NULL THEN
    -- Check if token exists and is valid
    IF EXISTS (
      SELECT 1 FROM user_tokens 
      WHERE token = user_token AND is_active = true
    ) THEN
      user_role_val := 'specialized'::user_role;
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
  VALUES (user_id, user_email, user_role_val, user_token, now(), now())
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