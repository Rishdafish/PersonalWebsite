/*
  # Fix create_user_profile_manual function

  1. Database Functions
    - Drop existing `create_user_profile_manual` function if it exists
    - Create new `create_user_profile_manual` function with proper parameter naming
    - Function creates user profile with role determination based on email and token
    - Returns the created user profile data

  2. Security
    - Function uses SECURITY DEFINER to run with elevated privileges
    - Proper parameter naming to avoid column reference ambiguity
    - Validates token if provided before assigning specialized role

  3. Logic
    - Checks for admin emails and assigns admin role
    - Validates token for specialized role assignment
    - Defaults to regular role for standard users
    - Creates both user_profiles and users table entries
    - Returns complete profile data for immediate use
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS create_user_profile_manual(uuid, text, text);

-- Create the corrected function with unambiguous parameter names
CREATE OR REPLACE FUNCTION create_user_profile_manual(
  p_user_id uuid,
  p_user_email text,
  p_user_token text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  email text,
  role user_role,
  token_used text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role user_role := 'regular';
  v_token_valid boolean := false;
BEGIN
  -- Check if user is admin based on email
  IF p_user_email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    v_role := 'admin';
  -- Check if token is provided and valid for specialized role
  ELSIF p_user_token IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM user_tokens 
      WHERE token = p_user_token AND is_active = true
    ) INTO v_token_valid;
    
    IF v_token_valid THEN
      v_role := 'specialized';
    END IF;
  END IF;

  -- Insert into users table first (if not exists)
  INSERT INTO users (id, email, created_at, updated_at)
  VALUES (p_user_id, p_user_email, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();

  -- Insert into user_profiles table
  INSERT INTO user_profiles (id, email, role, token_used, created_at, updated_at)
  VALUES (p_user_id, p_user_email, v_role, p_user_token, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    token_used = EXCLUDED.token_used,
    updated_at = now();

  -- Return the created/updated profile
  RETURN QUERY
  SELECT 
    user_profiles.id,
    user_profiles.email,
    user_profiles.role,
    user_profiles.token_used,
    user_profiles.created_at,
    user_profiles.updated_at
  FROM user_profiles
  WHERE user_profiles.id = p_user_id;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION create_user_profile_manual(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile_manual(uuid, text, text) TO service_role;