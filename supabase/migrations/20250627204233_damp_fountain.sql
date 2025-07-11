/*
  # Fix User Registration Database Trigger

  1. Database Trigger Fixes
    - Drop and recreate the user registration trigger with proper error handling
    - Add comprehensive logging for debugging
    - Ensure proper role assignment based on email and tokens

  2. RLS Policy Updates
    - Drop existing conflicting policies before creating new ones
    - Ensure proper permissions for user registration
    - Add service role access for all operations

  3. Manual Profile Creation
    - Add fallback function for manual profile creation
    - Include proper error handling and logging
*/

-- First, let's drop the existing trigger and function to recreate them properly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_with_role();

-- Create an improved user registration handler function
CREATE OR REPLACE FUNCTION public.handle_new_user_with_role()
RETURNS TRIGGER AS $$
DECLARE
  user_token TEXT;
  user_role user_role := 'regular';
  token_record RECORD;
BEGIN
  -- Log the trigger execution
  RAISE LOG 'handle_new_user_with_role triggered for user: %', NEW.email;
  
  -- Extract token from user metadata if present
  user_token := NEW.raw_user_meta_data->>'token';
  RAISE LOG 'Token from metadata: %', COALESCE(user_token, 'none');
  
  -- Determine user role based on email or token
  IF NEW.email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    user_role := 'admin';
    RAISE LOG 'Admin role assigned based on email: %', NEW.email;
  ELSIF user_token IS NOT NULL AND user_token != '' THEN
    -- Validate the token
    SELECT * INTO token_record 
    FROM public.user_tokens 
    WHERE token = user_token AND is_active = true;
    
    IF FOUND THEN
      user_role := 'specialized';
      RAISE LOG 'Specialized role assigned based on valid token: %', user_token;
    ELSE
      RAISE LOG 'Invalid or inactive token provided: %', user_token;
      user_role := 'regular';
    END IF;
  ELSE
    RAISE LOG 'Regular role assigned (no token or admin email)';
  END IF;

  -- Insert into users table first
  BEGIN
    INSERT INTO public.users (id, email, created_at, updated_at)
    VALUES (NEW.id, NEW.email, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = NOW();
    
    RAISE LOG 'Successfully inserted/updated users table for: %', NEW.email;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error inserting into users table: %', SQLERRM;
    -- Continue with profile creation even if users table fails
  END;

  -- Insert into user_profiles table
  BEGIN
    INSERT INTO public.user_profiles (id, email, role, token_used, created_at, updated_at)
    VALUES (NEW.id, NEW.email, user_role, user_token, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      token_used = EXCLUDED.token_used,
      updated_at = NOW();
    
    RAISE LOG 'Successfully inserted/updated user_profiles table for: % with role: %', NEW.email, user_role;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error inserting into user_profiles table: %', SQLERRM;
    RAISE EXCEPTION 'Failed to create user profile: %', SQLERRM;
  END;

  -- Create default achievements for the user
  BEGIN
    PERFORM public.create_default_achievements_for_user(NEW.id);
    RAISE LOG 'Successfully created default achievements for: %', NEW.email;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error creating default achievements: %', SQLERRM;
    -- Don't fail the entire process if achievements fail
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Critical error in handle_new_user_with_role: %', SQLERRM;
  RAISE EXCEPTION 'User registration failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_with_role();

-- Create a manual profile creation function for fallback scenarios
CREATE OR REPLACE FUNCTION public.create_user_profile_manual(
  user_id UUID,
  user_email TEXT,
  user_token TEXT DEFAULT NULL
)
RETURNS public.user_profiles AS $$
DECLARE
  user_role user_role := 'regular';
  token_record RECORD;
  result_profile public.user_profiles;
BEGIN
  RAISE LOG 'Manual profile creation for user: % with token: %', user_email, COALESCE(user_token, 'none');
  
  -- Determine user role
  IF user_email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    user_role := 'admin';
    RAISE LOG 'Admin role assigned based on email: %', user_email;
  ELSIF user_token IS NOT NULL AND user_token != '' THEN
    -- Validate the token
    SELECT * INTO token_record 
    FROM public.user_tokens 
    WHERE token = user_token AND is_active = true;
    
    IF FOUND THEN
      user_role := 'specialized';
      RAISE LOG 'Specialized role assigned based on valid token: %', user_token;
    ELSE
      RAISE LOG 'Invalid or inactive token provided: %', user_token;
      user_role := 'regular';
    END IF;
  END IF;

  -- Insert into users table
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (user_id, user_email, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();

  -- Insert into user_profiles table
  INSERT INTO public.user_profiles (id, email, role, token_used, created_at, updated_at)
  VALUES (user_id, user_email, user_role, user_token, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    token_used = EXCLUDED.token_used,
    updated_at = NOW()
  RETURNING * INTO result_profile;

  -- Create default achievements
  BEGIN
    PERFORM public.create_default_achievements_for_user(user_id);
    RAISE LOG 'Successfully created default achievements for: %', user_email;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error creating default achievements: %', SQLERRM;
  END;

  RAISE LOG 'Manual profile creation completed for: % with role: %', user_email, user_role;
  RETURN result_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop ALL existing policies that might conflict before creating new ones
DROP POLICY IF EXISTS "Allow profile creation during signup" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow user registration during signup" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Service role can manage users" ON public.users;
DROP POLICY IF EXISTS "Service role can manage profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role full access users" ON public.users;
DROP POLICY IF EXISTS "Service role full access profiles" ON public.user_profiles;

-- Create comprehensive RLS policies for user_profiles
CREATE POLICY "Allow profile creation during signup"
  ON public.user_profiles
  FOR INSERT
  TO anon, authenticated, supabase_auth_admin
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Allow authenticated users to update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can manage profiles"
  ON public.user_profiles
  FOR ALL
  TO service_role, supabase_auth_admin
  USING (true)
  WITH CHECK (true);

-- Create comprehensive RLS policies for users table
CREATE POLICY "Allow user registration during signup"
  ON public.users
  FOR INSERT
  TO anon, authenticated, supabase_auth_admin
  WITH CHECK (true);

CREATE POLICY "Users can read own data"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can manage users"
  ON public.users
  FOR ALL
  TO service_role, supabase_auth_admin
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated, service_role;
GRANT ALL ON public.user_profiles TO anon, authenticated, service_role;
GRANT ALL ON public.user_tokens TO anon, authenticated, service_role;
GRANT ALL ON public.achievements TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user_with_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_user_profile_manual(UUID, TEXT, TEXT) TO anon, authenticated, service_role;

-- Ensure the create_default_achievements_for_user function exists
CREATE OR REPLACE FUNCTION public.create_default_achievements_for_user(user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO public.achievements (user_id, title, description, icon, category, completed, created_at)
  VALUES 
    (user_id, 'Welcome!', 'Created your account', '🎉', 'General', true, NOW()),
    (user_id, 'First Steps', 'Complete your first work entry', '👶', 'Progress', false, NOW()),
    (user_id, 'Dedicated', 'Log 10 hours of work', '💪', 'Progress', false, NOW()),
    (user_id, 'Consistent', 'Work for 7 days in a row', '🔥', 'Streak', false, NOW()),
    (user_id, 'Marathon', 'Log 100 hours total', '🏃', 'Progress', false, NOW())
  ON CONFLICT DO NOTHING;
  
  RAISE LOG 'Default achievements created for user: %', user_id;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Error creating default achievements for user %: %', user_id, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the achievements function
GRANT EXECUTE ON FUNCTION public.create_default_achievements_for_user(UUID) TO anon, authenticated, service_role;

-- Test the trigger function by checking if it exists and is properly configured
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'on_auth_user_created' 
    AND event_object_table = 'users'
    AND event_object_schema = 'auth'
  ) THEN
    RAISE LOG 'Trigger on_auth_user_created is properly configured';
  ELSE
    RAISE LOG 'WARNING: Trigger on_auth_user_created is not found or not properly configured';
  END IF;
END $$;

-- Ensure some test tokens exist for validation
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_tokens WHERE token = 'SPECIALIZED_ACCESS_2024') THEN
    INSERT INTO public.user_tokens (token, description, is_active, created_at)
    VALUES 
      ('SPECIALIZED_ACCESS_2024', 'Specialized access token for 2024', true, NOW()),
      ('BETA_TESTER_TOKEN', 'Beta tester access token', true, NOW()),
      ('ADMIN_OVERRIDE_KEY', 'Admin override access key', true, NOW());
    
    RAISE LOG 'Test tokens created successfully';
  ELSE
    RAISE LOG 'Test tokens already exist';
  END IF;
END $$;

-- Log completion
DO $$
BEGIN
  RAISE LOG 'User registration trigger fix migration completed successfully';
END $$;