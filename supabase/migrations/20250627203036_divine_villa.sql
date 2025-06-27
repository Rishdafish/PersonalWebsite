/*
  # Fix Database Registration Error - Final

  1. Functions
    - Drop existing triggers first to avoid dependency issues
    - Create proper trigger functions for user registration
    - Add manual profile creation function for frontend fallback
    - Create achievement creation functions

  2. Triggers
    - Set up auth.users trigger for automatic profile creation
    - Add updated_at triggers for all relevant tables

  3. Security
    - Update RLS policies to allow proper user registration
    - Grant necessary permissions for user creation flow
    - Ensure supabase_auth_admin has required access

  4. Test Data
    - Add sample tokens for specialized access validation
*/

-- Drop all existing triggers first to avoid dependency issues
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_with_role ON auth.users;
DROP TRIGGER IF EXISTS on_user_created_achievements ON public.users;
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON public.blog_posts;
DROP TRIGGER IF EXISTS update_blog_comments_updated_at ON public.blog_comments;
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;

-- Now drop existing functions that might have different signatures
DROP FUNCTION IF EXISTS public.create_user_profile_manual(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.create_user_profile_manual(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user_with_role() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.create_default_achievements() CASCADE;
DROP FUNCTION IF EXISTS public.create_default_achievements_for_user(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Create the updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create the function to handle new user creation with role detection
CREATE OR REPLACE FUNCTION public.handle_new_user_with_role()
RETURNS TRIGGER AS $$
DECLARE
  user_role user_role := 'regular';
  user_token text;
BEGIN
  -- Get token from user metadata
  user_token := NEW.raw_user_meta_data->>'token';
  
  -- Check if user is admin based on email
  IF NEW.email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    user_role := 'admin';
  -- Check if token is valid for specialized access
  ELSIF user_token IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_tokens 
    WHERE token = user_token AND is_active = true
  ) THEN
    user_role := 'specialized';
  END IF;
  
  -- Insert into public.users table
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  
  -- Insert into user_profiles table
  INSERT INTO public.user_profiles (id, email, role, token_used, created_at, updated_at)
  VALUES (NEW.id, NEW.email, user_role, user_token, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    token_used = EXCLUDED.token_used,
    updated_at = NOW();
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error in handle_new_user_with_role: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create default achievements function
CREATE OR REPLACE FUNCTION public.create_default_achievements()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default achievements for new user
  INSERT INTO public.achievements (user_id, title, description, icon, category, completed, created_at)
  VALUES 
    (NEW.id, 'Welcome!', 'Created your account', '🎉', 'General', true, NOW()),
    (NEW.id, 'First Steps', 'Complete your first work entry', '👶', 'Progress', false, NOW()),
    (NEW.id, 'Dedicated', 'Log 10 hours of work', '💪', 'Progress', false, NOW()),
    (NEW.id, 'Consistent', 'Work for 7 days in a row', '🔥', 'Streak', false, NOW()),
    (NEW.id, 'Marathon', 'Log 100 hours total', '🏃', 'Progress', false, NOW())
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error in create_default_achievements: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function for creating achievements
CREATE OR REPLACE FUNCTION public.create_default_achievements_for_user(user_id uuid)
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create manual profile creation function for the frontend (returns user_profiles row)
CREATE OR REPLACE FUNCTION public.create_user_profile_manual(
  user_id uuid,
  user_email text,
  user_token text DEFAULT NULL
)
RETURNS public.user_profiles AS $$
DECLARE
  user_role user_role := 'regular';
  result_profile public.user_profiles;
BEGIN
  -- Determine role
  IF user_email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    user_role := 'admin';
  ELSIF user_token IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_tokens 
    WHERE token = user_token AND is_active = true
  ) THEN
    user_role := 'specialized';
  END IF;
  
  -- Insert into users table if not exists
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (user_id, user_email, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  
  -- Insert or update user profile
  INSERT INTO public.user_profiles (id, email, role, token_used, created_at, updated_at)
  VALUES (user_id, user_email, user_role, user_token, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    token_used = EXCLUDED.token_used,
    updated_at = NOW()
  RETURNING * INTO result_profile;
  
  -- Create default achievements
  PERFORM public.create_default_achievements_for_user(user_id);
  
  RETURN result_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the main trigger on auth.users for new user handling
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_with_role();

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_blog_comments_updated_at
  BEFORE UPDATE ON public.blog_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fix RLS policies to allow proper user creation

-- Users table policies
DROP POLICY IF EXISTS "Allow user registration during signup" ON public.users;
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Service role can manage users" ON public.users;
DROP POLICY IF EXISTS "Service role full access users" ON public.users;

CREATE POLICY "Allow user registration during signup" ON public.users
  FOR INSERT TO anon, authenticated, supabase_auth_admin
  WITH CHECK (true);

CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can manage users" ON public.users
  FOR ALL TO service_role, supabase_auth_admin
  USING (true)
  WITH CHECK (true);

-- User profiles policies
DROP POLICY IF EXISTS "Allow profile creation during signup" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role can manage profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role full access profiles" ON public.user_profiles;

CREATE POLICY "Allow profile creation during signup" ON public.user_profiles
  FOR INSERT TO anon, authenticated, supabase_auth_admin
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read own profile" ON public.user_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Allow authenticated users to update own profile" ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can manage profiles" ON public.user_profiles
  FOR ALL TO service_role, supabase_auth_admin
  USING (true)
  WITH CHECK (true);

-- Achievements policies - ensure they can be created during signup
DROP POLICY IF EXISTS "Allow users to manage own achievements" ON public.achievements;
DROP POLICY IF EXISTS "Service role can manage achievements" ON public.achievements;
DROP POLICY IF EXISTS "Allow achievement creation during signup" ON public.achievements;

CREATE POLICY "Allow users to manage own achievements" ON public.achievements
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage achievements" ON public.achievements
  FOR ALL TO service_role, supabase_auth_admin
  USING (true)
  WITH CHECK (true);

-- Allow anonymous and authenticated users to create achievements during signup
CREATE POLICY "Allow achievement creation during signup" ON public.achievements
  FOR INSERT TO anon, authenticated, supabase_auth_admin
  WITH CHECK (true);

-- User statistics policies
DROP POLICY IF EXISTS "Allow users to manage own statistics" ON public.user_statistics;
DROP POLICY IF EXISTS "Service role can manage statistics" ON public.user_statistics;

CREATE POLICY "Allow users to manage own statistics" ON public.user_statistics
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage statistics" ON public.user_statistics
  FOR ALL TO service_role, supabase_auth_admin
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions to functions
GRANT EXECUTE ON FUNCTION public.handle_new_user_with_role() TO anon, authenticated, service_role, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.create_default_achievements() TO anon, authenticated, service_role, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.create_user_profile_manual(uuid, text, text) TO anon, authenticated, service_role, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.create_default_achievements_for_user(uuid) TO anon, authenticated, service_role, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO anon, authenticated, service_role, supabase_auth_admin;

-- Ensure all tables have proper permissions for user registration
GRANT INSERT, SELECT ON public.users TO anon, authenticated, supabase_auth_admin;
GRANT INSERT, SELECT ON public.user_profiles TO anon, authenticated, supabase_auth_admin;
GRANT INSERT, SELECT ON public.achievements TO anon, authenticated, supabase_auth_admin;
GRANT SELECT ON public.user_tokens TO anon, authenticated, supabase_auth_admin;

-- Grant all permissions to service role and auth admin
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, supabase_auth_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role, supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, supabase_auth_admin;

-- Ensure user_tokens table has some test data for token validation
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_tokens WHERE token = 'SPECIALIZED_ACCESS_2024') THEN
    INSERT INTO public.user_tokens (token, description, is_active, created_at)
    VALUES 
      ('SPECIALIZED_ACCESS_2024', 'Specialized access token for 2024', true, NOW()),
      ('BETA_TESTER_TOKEN', 'Beta tester access token', true, NOW()),
      ('ADMIN_OVERRIDE_KEY', 'Admin override access key', true, NOW());
  END IF;
END $$;