/*
  # Simple Token Setup and Debugging

  1. Clear and recreate tokens
  2. Verify token insertion
  3. Test basic queries
*/

-- Clear existing tokens completely
DELETE FROM user_tokens;

-- Insert tokens with explicit values
INSERT INTO user_tokens (token, description, is_active, created_at) VALUES
  ('hello_1210', 'Primary specialized access token for testing', true, now()),
  ('SPEC_ACCESS_2025', 'Specialized access token for 2025', true, now()),
  ('ADVANCED_USER_TOKEN', 'Advanced user access token', true, now()),
  ('BETA_TESTER_ACCESS', 'Beta tester specialized access', true, now()),
  ('DEV_TOKEN_123', 'Development testing token', true, now());

-- Verify tokens were inserted
DO $$
DECLARE
    token_count integer;
    hello_token_exists boolean;
BEGIN
    -- Count total tokens
    SELECT COUNT(*) INTO token_count FROM user_tokens WHERE is_active = true;
    RAISE NOTICE 'Total active tokens inserted: %', token_count;
    
    -- Check specifically for hello_1210
    SELECT EXISTS(
        SELECT 1 FROM user_tokens 
        WHERE token = 'hello_1210' AND is_active = true
    ) INTO hello_token_exists;
    RAISE NOTICE 'hello_1210 token exists and is active: %', hello_token_exists;
    
    -- Log all tokens for verification
    FOR token_count IN (
        SELECT token FROM user_tokens WHERE is_active = true ORDER BY token
    ) LOOP
        RAISE NOTICE 'Active token found: %', token_count;
    END LOOP;
END $$;

-- Ensure proper permissions for token queries
GRANT SELECT ON user_tokens TO anon, authenticated;

-- Test the exact query pattern that Supabase client uses
-- This should return data if the token exists
SELECT * FROM user_tokens 
WHERE token = 'hello_1210' AND is_active = true;

-- Test the EXISTS pattern used in validation
SELECT EXISTS(
    SELECT 1 FROM user_tokens 
    WHERE token = 'hello_1210' AND is_active = true
) as token_validation_result;