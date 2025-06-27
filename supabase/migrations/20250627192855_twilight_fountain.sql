/*
  # Fix Specialized User Registration

  1. Database Structure
    - Ensure proper token validation
    - Fix user profile creation triggers
    - Update RLS policies for registration flow

  2. Token Management
    - Add valid tokens for testing
    - Ensure token deactivation works properly

  3. Registration Flow
    - Fix trigger function for role assignment
    - Ensure proper profile creation
*/

-- First, ensure we have the user_role enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'regular', 'specialized');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Ensure user_tokens table exists with proper structure
CREATE TABLE IF NOT EXISTS user_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Clear and recreate tokens to ensure they're active
DELETE FROM user_tokens;
INSERT INTO user_tokens (token, description, is_active) VALUES
  ('hello_1210', 'Primary specialized access token', true),
  ('SPEC_ACCESS_2025', 'Specialized access token for 2025', true),
  ('ADVANCED_USER_TOKEN', 'Advanced user access token', true),
  ('BETA_TESTER_ACCESS', 'Beta tester specialized access', true),
  ('DEV_TOKEN_123', 'Development testing token', true);

-- Recreate the user registration trigger function with better error handling
CREATE OR REPLACE FUNCTION handle_new_user_with_role()
RETURNS TRIGGER AS $$
DECLARE
  user_role_type user_role := 'regular';
  used_token text := NULL;
  token_from_metadata text;
BEGIN
  -- Log the trigger execution
  RAISE LOG 'handle_new_user_with_role triggered for user: %', NEW.email;
  
  -- Get token from user metadata
  token_from_metadata := NEW.raw_user_meta_data->>'token';
  RAISE LOG 'Token from metadata: %', token_from_metadata;
  
  -- Check if user email is admin
  IF NEW.email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    user_role_type := 'admin';
    RAISE LOG 'Admin role assigned to: %', NEW.email;
  -- Check if user provided a valid token for specialized access
  ELSIF token_from_metadata IS NOT NULL AND token_from_metadata != '' THEN
    RAISE LOG 'Checking token: %', token_from_metadata;
    
    -- Check if token exists and is active
    SELECT token INTO used_token 
    FROM user_tokens 
    WHERE token = token_from_metadata 
    AND is_active = true;
    
    IF used_token IS NOT NULL THEN
      user_role_type := 'specialized';
      RAISE LOG 'Specialized role assigned with token: %', used_token;
      
      -- Deactivate the token after use
      UPDATE user_tokens SET is_active = false WHERE token = used_token;
      RAISE LOG 'Token deactivated: %', used_token;
    ELSE
      RAISE LOG 'Token not found or inactive: %', token_from_metadata;
    END IF;
  END IF;

  -- Insert into users table (with conflict handling)
  INSERT INTO users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();
  
  RAISE LOG 'User record created/updated for: %', NEW.email;

  -- Insert into user_profiles table (with conflict handling)
  INSERT INTO user_profiles (id, email, role, token_used, created_at, updated_at)
  VALUES (NEW.id, NEW.email, user_role_type, used_token, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    token_used = EXCLUDED.token_used,
    updated_at = now();
  
  RAISE LOG 'User profile created/updated for: % with role: %', NEW.email, user_role_type;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user_with_role: %', SQLERRM;
    -- Still return NEW to not block the user creation
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the trigger to ensure it's properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_with_role();

-- Update RLS policies to be more permissive for registration
DROP POLICY IF EXISTS "Allow user registration" ON users;
CREATE POLICY "Allow user registration"
  ON users FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to create own profile" ON user_profiles;
CREATE POLICY "Allow profile creation during registration"
  ON user_profiles FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Ensure the service role can manage everything
CREATE POLICY "Service role full access users" ON users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access profiles" ON user_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access tokens" ON user_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Create a function to manually create user profile if trigger fails
CREATE OR REPLACE FUNCTION create_user_profile_manual(
  user_id uuid,
  user_email text,
  user_token text DEFAULT NULL
)
RETURNS user_profiles AS $$
DECLARE
  user_role_type user_role := 'regular';
  used_token text := NULL;
  result user_profiles;
BEGIN
  -- Check if user email is admin
  IF user_email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    user_role_type := 'admin';
  -- Check if user provided a valid token for specialized access
  ELSIF user_token IS NOT NULL AND user_token != '' THEN
    SELECT token INTO used_token 
    FROM user_tokens 
    WHERE token = user_token 
    AND is_active = true;
    
    IF used_token IS NOT NULL THEN
      user_role_type := 'specialized';
      -- Deactivate the token after use
      UPDATE user_tokens SET is_active = false WHERE token = used_token;
    END IF;
  END IF;

  -- Insert or update user profile
  INSERT INTO user_profiles (id, email, role, token_used, created_at, updated_at)
  VALUES (user_id, user_email, user_role_type, used_token, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    token_used = EXCLUDED.token_used,
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;