/*
  # Fix User Registration System

  1. Database Functions
    - Create robust user registration trigger
    - Create manual profile creation function
    - Create default achievements function
    - Create updated_at trigger function

  2. RLS Policies
    - Allow user creation during signup for anon users
    - Proper permissions for all related tables
    - Service role access for all operations

  3. Permissions
    - Grant necessary permissions to anon, authenticated, and service roles
    - Ensure triggers can execute properly

  4. Test Data
    - Insert test tokens for specialized access validation
*/

-- Drop all existing triggers to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_user_created_achievements ON public.users;
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;

-- Drop existing functions to recreate them
DROP FUNCTION IF EXISTS public.handle_new_user_signup() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user_with_role() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.create_user_profile_manual(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.create_default_achievements_for_user(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Create the updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the main user registration function
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  user_role user_role := 'regular';
  user_token text;
  token_exists boolean := false;
BEGIN
  -- Log the trigger execution
  RAISE LOG 'User registration trigger started for: %', NEW.email;
  
  -- Get token from user metadata if available
  user_token := NEW.raw_user_meta_data->>'token';
  RAISE LOG 'Token from metadata: %', COALESCE(user_token, 'none');
  
  -- Determine role based on email or token
  IF NEW.email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    user_role := 'admin';
    RAISE LOG 'Admin role assigned based on email: %', NEW.email;
  ELSIF user_token IS NOT NULL AND user_token != '' THEN
    -- Check if token exists and is active
    SELECT EXISTS (
      SELECT 1 FROM public.user_tokens 
      WHERE token = user_token AND is_active = true
    ) INTO token_exists;
    
    IF token_exists THEN
      user_role := 'specialized';
      RAISE LOG 'Specialized role assigned based on valid token: %', user_token;
    ELSE
      RAISE LOG 'Invalid or inactive token provided: %', user_token;
    END IF;
  END IF;

  -- Insert into public.users table
  BEGIN
    INSERT INTO public.users (id, email, created_at, updated_at)
    VALUES (NEW.id, NEW.email, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = NOW();
    
    RAISE LOG 'Successfully inserted/updated users table for: %', NEW.email;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error inserting into users table: %', SQLERRM;
    -- Continue with profile creation
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
    
    RAISE LOG 'Successfully created user profile for: % with role: %', NEW.email, user_role;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error creating user profile: %', SQLERRM;
    -- This is critical, so we'll raise an exception
    RAISE EXCEPTION 'Failed to create user profile: %', SQLERRM;
  END;

  -- Initialize user statistics
  BEGIN
    INSERT INTO public.user_statistics (user_id, total_hours, average_daily_hours, max_session_hours, days_since_start, current_streak, updated_at)
    VALUES (NEW.id, 0, 0, 0, 0, 0, NOW())
    ON CONFLICT (user_id) DO NOTHING;
    
    RAISE LOG 'Successfully initialized user statistics for: %', NEW.email;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error initializing user statistics: %', SQLERRM;
    -- Non-critical, continue
  END;

  -- Create default achievements
  BEGIN
    INSERT INTO public.achievements (user_id, title, description, icon, category, completed, created_at)
    VALUES 
      (NEW.id, 'Welcome!', 'Welcome to the platform', '🎉', 'General', true, NOW()),
      (NEW.id, 'First Steps', 'Complete your first hour of work', '👶', 'Progress', false, NOW()),
      (NEW.id, 'Dedicated', 'Log 10 hours of work', '💪', 'Progress', false, NOW()),
      (NEW.id, 'Consistent', 'Work for 7 days in a row', '🔥', 'Streak', false, NOW()),
      (NEW.id, 'Expert', 'Complete 100 hours of work', '🎓', 'Progress', false, NOW())
    ON CONFLICT DO NOTHING;
    
    RAISE LOG 'Successfully created default achievements for: %', NEW.email;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error creating default achievements: %', SQLERRM;
    -- Non-critical, continue
  END;

  RAISE LOG 'User registration completed successfully for: %', NEW.email;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'Critical error in user registration for %: %', NEW.email, SQLERRM;
  -- Re-raise the exception to fail the signup if something critical goes wrong
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create manual profile creation function for fallback
CREATE OR REPLACE FUNCTION public.create_user_profile_manual(
  user_id uuid,
  user_email text,
  user_token text DEFAULT NULL
)
RETURNS public.user_profiles AS $$
DECLARE
  user_role user_role := 'regular';
  token_exists boolean := false;
  result_profile public.user_profiles;
BEGIN
  RAISE LOG 'Manual profile creation started for: %', user_email;
  
  -- Determine role based on email or token
  IF user_email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    user_role := 'admin';
    RAISE LOG 'Admin role assigned based on email: %', user_email;
  ELSIF user_token IS NOT NULL AND user_token != '' THEN
    -- Check if token exists and is active
    SELECT EXISTS (
      SELECT 1 FROM public.user_tokens 
      WHERE token = user_token AND is_active = true
    ) INTO token_exists;
    
    IF token_exists THEN
      user_role := 'specialized';
      RAISE LOG 'Specialized role assigned based on valid token: %', user_token;
    ELSE
      RAISE LOG 'Invalid or inactive token provided: %', user_token;
    END IF;
  END IF;

  -- Insert into users table if not exists
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (user_id, user_email, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();

  -- Insert or update user profile
  INSERT INTO public.user_profiles (id, email, role, token_used, created_at, updated_at)
  VALUES (user_id, user_email, user_role, user_token, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    token_used = EXCLUDED.token_used,
    updated_at = NOW()
  RETURNING * INTO result_profile;

  -- Initialize user statistics if not exists
  INSERT INTO public.user_statistics (user_id, total_hours, average_daily_hours, max_session_hours, days_since_start, current_streak, updated_at)
  VALUES (user_id, 0, 0, 0, 0, 0, NOW())
  ON CONFLICT (user_id) DO NOTHING;

  -- Create default achievements if they don't exist
  INSERT INTO public.achievements (user_id, title, description, icon, category, completed, created_at)
  SELECT user_id, title, description, icon, category, completed, NOW()
  FROM (VALUES 
    ('Welcome!', 'Welcome to the platform', '🎉', 'General', true),
    ('First Steps', 'Complete your first hour of work', '👶', 'Progress', false),
    ('Dedicated', 'Log 10 hours of work', '💪', 'Progress', false),
    ('Consistent', 'Work for 7 days in a row', '🔥', 'Streak', false),
    ('Expert', 'Complete 100 hours of work', '🎓', 'Progress', false)
  ) AS default_achievements(title, description, icon, category, completed)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.achievements 
    WHERE achievements.user_id = create_user_profile_manual.user_id 
    AND achievements.title = default_achievements.title
  );

  RAISE LOG 'Manual profile creation completed for: % with role: %', user_email, user_role;
  RETURN result_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop ALL existing RLS policies that might conflict
DROP POLICY IF EXISTS "Allow profile creation during signup" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow user registration during signup" ON public.users;
DROP POLICY IF EXISTS "Allow achievement creation during signup" ON public.achievements;
DROP POLICY IF EXISTS "Allow statistics creation during signup" ON public.user_statistics;
DROP POLICY IF EXISTS "Allow authenticated users to read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Service role can manage users" ON public.users;
DROP POLICY IF EXISTS "Service role can manage profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role can manage achievements" ON public.achievements;
DROP POLICY IF EXISTS "Service role can manage statistics" ON public.user_statistics;
DROP POLICY IF EXISTS "Allow users to manage own achievements" ON public.achievements;
DROP POLICY IF EXISTS "Allow users to manage own statistics" ON public.user_statistics;

-- Create comprehensive RLS policies for user registration

-- Users table policies
CREATE POLICY "Allow user registration during signup" ON public.users
  FOR INSERT 
  TO anon, authenticated, supabase_auth_admin
  WITH CHECK (true);

CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can manage users" ON public.users
  FOR ALL 
  TO service_role, supabase_auth_admin
  USING (true)
  WITH CHECK (true);

-- User profiles policies
CREATE POLICY "Allow profile creation during signup" ON public.user_profiles
  FOR INSERT 
  TO anon, authenticated, supabase_auth_admin
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read own profile" ON public.user_profiles
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Allow authenticated users to update own profile" ON public.user_profiles
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can manage profiles" ON public.user_profiles
  FOR ALL 
  TO service_role, supabase_auth_admin
  USING (true)
  WITH CHECK (true);

-- User statistics policies
CREATE POLICY "Allow statistics creation during signup" ON public.user_statistics
  FOR INSERT 
  TO anon, authenticated, supabase_auth_admin
  WITH CHECK (true);

CREATE POLICY "Allow users to manage own statistics" ON public.user_statistics
  FOR ALL 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage statistics" ON public.user_statistics
  FOR ALL 
  TO service_role, supabase_auth_admin
  USING (true)
  WITH CHECK (true);

-- Achievements policies
CREATE POLICY "Allow achievement creation during signup" ON public.achievements
  FOR INSERT 
  TO anon, authenticated, supabase_auth_admin
  WITH CHECK (true);

CREATE POLICY "Allow users to manage own achievements" ON public.achievements
  FOR ALL 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage achievements" ON public.achievements
  FOR ALL 
  TO service_role, supabase_auth_admin
  USING (true)
  WITH CHECK (true);

-- Create the main trigger for user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant necessary permissions to all roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, supabase_auth_admin;

-- Grant table permissions
GRANT INSERT, SELECT ON public.users TO anon, authenticated, supabase_auth_admin;
GRANT INSERT, SELECT ON public.user_profiles TO anon, authenticated, supabase_auth_admin;
GRANT INSERT, SELECT ON public.achievements TO anon, authenticated, supabase_auth_admin;
GRANT INSERT, SELECT ON public.user_statistics TO anon, authenticated, supabase_auth_admin;
GRANT SELECT ON public.user_tokens TO anon, authenticated, supabase_auth_admin;

-- Grant function execution permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO anon, authenticated, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.create_user_profile_manual(uuid, text, text) TO anon, authenticated, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO anon, authenticated, supabase_auth_admin;

-- Grant all permissions to service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, supabase_auth_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role, supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, supabase_auth_admin;

-- Ensure test tokens exist for validation
DELETE FROM public.user_tokens;

INSERT INTO public.user_tokens (token, description, is_active, created_at) VALUES
  ('hello_1210', 'Primary specialized access token for testing', true, NOW()),
  ('SPECIALIZED_ACCESS_2024', 'Specialized access token for 2024', true, NOW()),
  ('BETA_TESTER_TOKEN', 'Beta tester access token', true, NOW()),
  ('ADMIN_OVERRIDE_KEY', 'Admin override access key', true, NOW()),
  ('DEV_TOKEN_123', 'Development testing token', true, NOW());

-- Verify the setup
DO $$
DECLARE
    trigger_exists boolean;
    token_count integer;
    function_exists boolean;
BEGIN
    -- Check if trigger exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'on_auth_user_created' 
        AND event_object_table = 'users'
        AND event_object_schema = 'auth'
    ) INTO trigger_exists;
    
    -- Check token count
    SELECT COUNT(*) INTO token_count FROM public.user_tokens WHERE is_active = true;
    
    -- Check if function exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'handle_new_user_signup'
        AND routine_schema = 'public'
    ) INTO function_exists;
    
    RAISE LOG 'Setup verification:';
    RAISE LOG '- Trigger exists: %', trigger_exists;
    RAISE LOG '- Function exists: %', function_exists;
    RAISE LOG '- Active tokens: %', token_count;
    
    IF trigger_exists AND function_exists AND token_count > 0 THEN
        RAISE LOG '✅ User registration system setup completed successfully';
    ELSE
        RAISE LOG '❌ User registration system setup has issues';
    END IF;
END $$;