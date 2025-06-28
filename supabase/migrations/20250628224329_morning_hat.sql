/*
  # Create user profile manual function

  1. New Functions
    - `create_user_profile_manual` - Creates user profile with proper column disambiguation
      - Parameters: p_user_id (uuid), p_user_email (text), p_user_token (text, optional)
      - Returns: user profile record
      - Handles token validation and role assignment
  
  2. Security
    - Function uses SECURITY DEFINER to run with elevated privileges
    - Validates tokens against user_tokens table
    - Assigns appropriate roles based on token or email
  
  3. Logic
    - Checks if profile already exists
    - Validates token if provided
    - Determines role (admin for specific emails, specialized for valid tokens, regular otherwise)
    - Creates profile in user_profiles table
    - Returns created profile
*/

-- Drop function if it exists to avoid conflicts
DROP FUNCTION IF EXISTS create_user_profile_manual(uuid, text, text);

-- Create the user profile manual creation function
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
  v_token_used text := NULL;
  v_existing_profile user_profiles%ROWTYPE;
BEGIN
  -- Check if profile already exists
  SELECT * INTO v_existing_profile
  FROM user_profiles up
  WHERE up.id = p_user_id;
  
  -- If profile exists, return it
  IF FOUND THEN
    RETURN QUERY
    SELECT 
      v_existing_profile.id,
      v_existing_profile.email,
      v_existing_profile.role,
      v_existing_profile.token_used,
      v_existing_profile.created_at,
      v_existing_profile.updated_at;
    RETURN;
  END IF;
  
  -- Determine role based on email or token
  IF p_user_email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    v_role := 'admin';
  ELSIF p_user_token IS NOT NULL THEN
    -- Validate token
    IF EXISTS (
      SELECT 1 
      FROM user_tokens ut 
      WHERE ut.token = p_user_token 
        AND ut.is_active = true
    ) THEN
      v_role := 'specialized';
      v_token_used := p_user_token;
    END IF;
  END IF;
  
  -- Insert new profile with explicit column references
  INSERT INTO user_profiles (id, email, role, token_used, created_at, updated_at)
  VALUES (p_user_id, p_user_email, v_role, v_token_used, now(), now());
  
  -- Return the created profile
  RETURN QUERY
  SELECT 
    p_user_id as id,
    p_user_email as email,
    v_role as role,
    v_token_used as token_used,
    now() as created_at,
    now() as updated_at;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION create_user_profile_manual(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile_manual(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION create_user_profile_manual(uuid, text, text) TO supabase_auth_admin;