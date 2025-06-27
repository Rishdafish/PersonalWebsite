/*
  # Fix Enum Schema Qualification

  This migration ensures all policies that reference the user_role enum
  use the fully qualified public.user_role type to avoid search_path issues.
  
  1. Update all policies that cast to user_role enum
  2. Ensure proper schema qualification for enum references
  3. Maintain all existing functionality
*/

-- Update blog_posts policies with proper enum qualification
DROP POLICY IF EXISTS "Admins can manage all blog posts" ON public.blog_posts;
CREATE POLICY "Admins can manage all blog posts"
  ON public.blog_posts
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.role = 'admin'::public.user_role
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.role = 'admin'::public.user_role
  ));

-- Update projects policies with proper enum qualification
DROP POLICY IF EXISTS "Admins can manage all projects" ON public.projects;
CREATE POLICY "Admins can manage all projects"
  ON public.projects
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.role = 'admin'::public.user_role
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.role = 'admin'::public.user_role
  ));

-- Update blog_comments policies with proper enum qualification
DROP POLICY IF EXISTS "Admins can delete any comment" ON public.blog_comments;
CREATE POLICY "Admins can delete any comment"
  ON public.blog_comments
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.role = 'admin'::public.user_role
  ));

-- Ensure user_profiles column default is properly qualified
ALTER TABLE public.user_profiles 
  ALTER COLUMN role SET DEFAULT 'regular'::public.user_role;

-- Update functions to use fully qualified enum types
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.user_role := 'regular'::public.user_role;
  _token text;
BEGIN
  _token := NEW.raw_user_meta_data ->> 'token';

  IF NEW.email IN ('rishabh.biry@gmail.com','biryrishabh01@gmail.com','biryrishabh@gmail.com') THEN
    _role := 'admin'::public.user_role;
  ELSIF _token IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.user_tokens
                    WHERE token = _token AND is_active = true) THEN
    _role := 'specialized'::public.user_role;
  END IF;

  -- Insert into users table
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();

  -- Insert into user_profiles table
  INSERT INTO public.user_profiles (id, email, role, token_used, created_at, updated_at)
  VALUES (NEW.id, NEW.email, _role, _token, now(), now())
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
    RAISE WARNING 'Error in handle_new_user_signup: %', SQLERRM;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_user_profile_manual(
  user_id uuid,
  user_email text,
  user_token text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.user_role := 'regular'::public.user_role;
  _json json;
BEGIN
  IF user_email IN ('rishabh.biry@gmail.com','biryrishabh01@gmail.com','biryrishabh@gmail.com') THEN
    _role := 'admin'::public.user_role;
  ELSIF user_token IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.user_tokens
                    WHERE token = user_token AND is_active = true) THEN
    _role := 'specialized'::public.user_role;
  END IF;

  -- Insert into users table
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (user_id, user_email, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();

  -- Insert into user_profiles table
  INSERT INTO public.user_profiles (id, email, role, token_used, created_at, updated_at)
  VALUES (user_id, user_email, _role, user_token, now(), now())
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
  SELECT to_jsonb(up) INTO _json
  FROM public.user_profiles up
  WHERE up.id = user_id;

  RETURN _json;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating user profile: %', SQLERRM;
END;
$$;

-- Create debugging function with proper enum qualification
CREATE OR REPLACE FUNCTION public.check_trigger_status()
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
      SELECT 1 FROM pg_type t 
      JOIN pg_namespace n ON n.oid = t.typnamespace 
      WHERE t.typname = 'user_role' AND n.nspname = 'public'
    ),
    'timestamp', now()
  ) INTO result;
  
  RETURN result;
END;
$$;