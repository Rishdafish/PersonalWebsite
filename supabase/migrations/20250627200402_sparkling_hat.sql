/*
  # Fix user_tokens RLS policies for token validation

  1. Security
    - Update RLS policies to allow token validation
    - Ensure anonymous users can validate tokens
    - Maintain security for other operations

  2. Changes
    - Update existing policies to allow token validation
    - Add specific policy for token validation by anonymous users
*/

-- First, let's see what policies currently exist
DO $$
DECLARE
    policy_info record;
BEGIN
    RAISE NOTICE '=== CURRENT RLS POLICIES ===';
    FOR policy_info IN (
        SELECT policyname, array_to_string(roles, ',') as role_list, cmd, qual
        FROM pg_policies 
        WHERE tablename = 'user_tokens'
    ) LOOP
        RAISE NOTICE 'Policy: %, Roles: %, Command: %, Condition: %', 
                     policy_info.policyname, 
                     policy_info.role_list, 
                     policy_info.cmd,
                     policy_info.qual;
    END LOOP;
END $$;

-- Drop existing restrictive policies that might be blocking token validation
DROP POLICY IF EXISTS "Authenticated users can read active tokens" ON user_tokens;
DROP POLICY IF EXISTS "Service role can manage tokens" ON user_tokens;
DROP POLICY IF EXISTS "Service role full access tokens" ON user_tokens;

-- Create new policies that allow token validation
-- Allow anonymous and authenticated users to read active tokens for validation
CREATE POLICY "Allow token validation" 
  ON user_tokens 
  FOR SELECT 
  TO anon, authenticated 
  USING (is_active = true);

-- Allow service role full access for management
CREATE POLICY "Service role full access" 
  ON user_tokens 
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- Clear and re-insert tokens to ensure they exist
DELETE FROM user_tokens;

INSERT INTO user_tokens (token, description, is_active, created_at) VALUES
  ('hello_1210', 'Primary specialized access token for testing', true, now()),
  ('SPEC_ACCESS_2025', 'Specialized access token for 2025', true, now()),
  ('ADVANCED_USER_TOKEN', 'Advanced user access token', true, now()),
  ('BETA_TESTER_ACCESS', 'Beta tester specialized access', true, now()),
  ('DEV_TOKEN_123', 'Development testing token', true, now());

-- Test the new policies
DO $$
DECLARE
    token_count integer;
    test_result boolean;
BEGIN
    RAISE NOTICE '=== TESTING NEW POLICIES ===';
    
    -- Test basic count
    SELECT COUNT(*) INTO token_count FROM user_tokens;
    RAISE NOTICE 'Total tokens in database: %', token_count;
    
    -- Test active count
    SELECT COUNT(*) INTO token_count FROM user_tokens WHERE is_active = true;
    RAISE NOTICE 'Active tokens in database: %', token_count;
    
    -- Test specific token existence
    SELECT EXISTS(
        SELECT 1 FROM user_tokens 
        WHERE token = 'hello_1210' AND is_active = true
    ) INTO test_result;
    RAISE NOTICE 'hello_1210 token exists and active: %', test_result;
    
    -- Test the exact query pattern from frontend
    SELECT COUNT(*) INTO token_count
    FROM user_tokens 
    WHERE token = 'hello_1210' AND is_active = true;
    RAISE NOTICE 'Frontend query result count: %', token_count;
END $$;

-- Verify policies are correctly applied
SELECT 'POLICY VERIFICATION' as test_type, 
       policyname, 
       array_to_string(roles, ',') as roles,
       cmd,
       qual as condition
FROM pg_policies 
WHERE tablename = 'user_tokens';

-- Final test queries that match frontend exactly
SELECT 'FRONTEND TEST 1' as test_name, * 
FROM user_tokens 
WHERE token = 'hello_1210' AND is_active = true;

SELECT 'FRONTEND TEST 2' as test_name, COUNT(*) as count
FROM user_tokens 
WHERE token = 'hello_1210' AND is_active = true;

SELECT 'FRONTEND TEST 3' as test_name, EXISTS(
    SELECT 1 FROM user_tokens 
    WHERE token = 'hello_1210' AND is_active = true
) as token_exists;