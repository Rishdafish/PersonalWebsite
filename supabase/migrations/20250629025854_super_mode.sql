/*
  # Fix user registration and profile creation

  1. Recreate user_role enum in public schema
  2. Ensure user_profiles table has correct structure
  3. Create robust user profile creation function
  4. Add proper permissions and policies
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.create_user_profile_manual(uuid, text, text);

-- Drop and recreate the user_role enum to ensure it's in the correct schema
DROP TYPE IF EXISTS public.user_role CASCADE;
CREATE TYPE public.user_role AS ENUM ('admin', 'regular', 'specialized');

-- Ensure user_profiles table has the role column with correct type
DO $$
BEGIN
  -- Check if role column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name = 'role' 
    AND table_schema = 'public'
  ) THEN
    -- Add the role column if it doesn't exist
    ALTER TABLE public.user_profiles 
    ADD COLUMN role public.user_role NOT NULL DEFAULT 'regular'::public.user_role;
  ELSE
    -- Update existing column to use the new enum type
    ALTER TABLE public.user_profiles 
    ALTER COLUMN role TYPE public.user_role 
    USING COALESCE(role::text, 'regular')::public.user_role;
    
    -- Set default value
    ALTER TABLE public.user_profiles 
    ALTER COLUMN role SET DEFAULT 'regular'::public.user_role;
  END IF;
END $$;

-- Create the user profile creation function with proper enum handling
CREATE OR REPLACE FUNCTION public.create_user_profile_manual(
  p_user_id uuid,
  p_user_email text,
  p_user_token text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role := 'regular'::public.user_role;
  v_profile_data json;
  v_existing_profile record;
BEGIN
  -- Log the attempt
  RAISE LOG 'Creating user profile for: % with token: %', p_user_email, COALESCE(p_user_token, 'none');
  
  -- Check if profile already exists
  SELECT * INTO v_existing_profile
  FROM public.user_profiles
  WHERE id = p_user_id;
  
  IF FOUND THEN
    -- Return existing profile
    SELECT json_build_object(
      'id', v_existing_profile.id,
      'email', v_existing_profile.email,
      'role', v_existing_profile.role,
      'token_used', v_existing_profile.token_used,
      'created_at', v_existing_profile.created_at,
      'updated_at', v_existing_profile.updated_at
    ) INTO v_profile_data;
    
    RAISE LOG 'Returning existing profile for: %', p_user_email;
    RETURN v_profile_data;
  END IF;
  
  -- Determine role based on email or token
  IF p_user_email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    v_role := 'admin'::public.user_role;
    RAISE LOG 'Admin role assigned to: %', p_user_email;
  ELSIF p_user_token IS NOT NULL AND p_user_token != '' THEN
    -- Check if token is valid and active
    IF EXISTS (
      SELECT 1 FROM public.user_tokens 
      WHERE token = p_user_token AND is_active = true
    ) THEN
      v_role := 'specialized'::public.user_role;
      RAISE LOG 'Specialized role assigned via token to: %', p_user_email;
    ELSE
      RAISE LOG 'Invalid token provided for: %', p_user_email;
    END IF;
  END IF;
  
  -- Insert new profile
  BEGIN
    INSERT INTO public.user_profiles (
      id,
      email,
      role,
      token_used,
      created_at,
      updated_at
    ) VALUES (
      p_user_id,
      p_user_email,
      v_role,
      CASE WHEN v_role = 'specialized'::public.user_role THEN p_user_token ELSE NULL END,
      now(),
      now()
    );
    
    RAISE LOG 'User profile created successfully for: % with role: %', p_user_email, v_role;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error inserting user profile: %', SQLERRM;
    RAISE EXCEPTION 'Failed to create user profile: %', SQLERRM;
  END;
  
  -- Create user statistics record
  BEGIN
    INSERT INTO public.user_statistics (
      user_id,
      total_hours,
      average_daily_hours,
      max_session_hours,
      days_since_start,
      current_streak,
      updated_at
    ) VALUES (
      p_user_id,
      0,
      0,
      0,
      0,
      0,
      now()
    ) ON CONFLICT (user_id) DO NOTHING;
    
    RAISE LOG 'User statistics created for: %', p_user_email;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error creating user statistics: %', SQLERRM;
    -- Don't fail the whole operation for statistics
  END;
  
  -- Create default achievements
  BEGIN
    INSERT INTO public.achievements (user_id, title, description, icon, category, completed, created_at)
    VALUES 
      (p_user_id, 'Welcome!', 'You''ve successfully created your account', '🎉', 'General', true, now()),
      (p_user_id, 'First Steps', 'Complete your first hour of work', '👣', 'Hours', false, now()),
      (p_user_id, 'Dedicated', 'Log 10 hours of work', '💪', 'Hours', false, now()),
      (p_user_id, 'Consistent', 'Maintain a 7-day streak', '🔥', 'Streaks', false, now()),
      (p_user_id, 'Prolific', 'Complete 5 subjects', '📚', 'Subjects', false, now())
    ON CONFLICT (user_id, title) DO NOTHING;
    
    RAISE LOG 'Default achievements created for: %', p_user_email;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error creating achievements: %', SQLERRM;
    -- Don't fail the whole operation for achievements
  END;
  
  -- Build and return the profile data
  SELECT json_build_object(
    'id', p_user_id,
    'email', p_user_email,
    'role', v_role,
    'token_used', CASE WHEN v_role = 'specialized'::public.user_role THEN p_user_token ELSE NULL END,
    'created_at', now(),
    'updated_at', now()
  ) INTO v_profile_data;
  
  RETURN v_profile_data;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and re-raise
    RAISE LOG 'Critical error in create_user_profile_manual: %', SQLERRM;
    RAISE EXCEPTION 'Error creating user profile: %', SQLERRM;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.create_user_profile_manual(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile_manual(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_user_profile_manual(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_user_profile_manual(uuid, text, text) TO supabase_auth_admin;

-- Create index on role column for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role_fixed ON public.user_profiles(role);

-- Ensure RLS policies allow profile creation during signup
DROP POLICY IF EXISTS "Allow profile creation during signup" ON public.user_profiles;
CREATE POLICY "Allow profile creation during signup"
  ON public.user_profiles
  FOR INSERT
  TO anon, authenticated, supabase_auth_admin
  WITH CHECK (true);

-- Update existing policy for reading own profile
DROP POLICY IF EXISTS "Allow authenticated users to read own profile" ON public.user_profiles;
CREATE POLICY "Allow authenticated users to read own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Update existing policy for updating own profile  
DROP POLICY IF EXISTS "Allow authenticated users to update own profile" ON public.user_profiles;
CREATE POLICY "Allow authenticated users to update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure service role has full access
DROP POLICY IF EXISTS "Service role can manage profiles" ON public.user_profiles;
CREATE POLICY "Service role can manage profiles"
  ON public.user_profiles
  FOR ALL
  TO service_role, supabase_auth_admin
  USING (true)
  WITH CHECK (true);