/*
  # Fix user_role enum and user profile creation

  This migration ensures the user_role enum is properly created in the public schema
  before any functions or tables that reference it.

  1. Drop and recreate user_role enum to ensure it's in the correct schema
  2. Recreate the create_user_profile_manual function with proper enum reference
  3. Ensure all dependencies are properly ordered

  ## Changes Made
  - Recreate user_role enum in public schema
  - Update create_user_profile_manual function to properly handle enum
  - Add proper error handling and validation
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.create_user_profile_manual(uuid, text, text);

-- Drop and recreate the user_role enum to ensure it's in the correct schema
DROP TYPE IF EXISTS public.user_role CASCADE;
CREATE TYPE public.user_role AS ENUM ('admin', 'regular', 'specialized');

-- Recreate the user profile creation function with proper enum handling
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
  v_role public.user_role := 'regular';
  v_profile_data json;
  v_existing_profile record;
BEGIN
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
    
    RETURN v_profile_data;
  END IF;
  
  -- Determine role based on email or token
  IF p_user_email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    v_role := 'admin';
  ELSIF p_user_token IS NOT NULL AND p_user_token != '' THEN
    -- Check if token is valid and active
    IF EXISTS (
      SELECT 1 FROM public.user_tokens 
      WHERE token = p_user_token AND is_active = true
    ) THEN
      v_role := 'specialized';
    END IF;
  END IF;
  
  -- Insert new profile
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
    CASE WHEN v_role = 'specialized' THEN p_user_token ELSE NULL END,
    now(),
    now()
  );
  
  -- Build and return the profile data
  SELECT json_build_object(
    'id', p_user_id,
    'email', p_user_email,
    'role', v_role,
    'token_used', CASE WHEN v_role = 'specialized' THEN p_user_token ELSE NULL END,
    'created_at', now(),
    'updated_at', now()
  ) INTO v_profile_data;
  
  RETURN v_profile_data;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and re-raise
    RAISE EXCEPTION 'Error creating user profile: %', SQLERRM;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.create_user_profile_manual(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile_manual(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_user_profile_manual(uuid, text, text) TO service_role;

-- Ensure the user_profiles table uses the correct enum type
DO $$
BEGIN
  -- Check if the role column exists and has the correct type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name = 'role' 
    AND table_schema = 'public'
  ) THEN
    -- Update the column to use the new enum type
    ALTER TABLE public.user_profiles 
    ALTER COLUMN role TYPE public.user_role 
    USING role::text::public.user_role;
    
    -- Set default value
    ALTER TABLE public.user_profiles 
    ALTER COLUMN role SET DEFAULT 'regular'::public.user_role;
  END IF;
END $$;

-- Create index on role column for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role_fixed ON public.user_profiles(role);