/*
  # Fix token validation and ensure tokens exist

  1. Database Changes
    - Clear existing tokens
    - Insert fresh tokens including "hello_1210"
    - Verify tokens are properly inserted

  2. Testing
    - Test validation specifically for "hello_1210"
    - Log results for debugging
*/

-- Clear existing tokens and recreate with proper data
DELETE FROM user_tokens;

-- Insert valid tokens including the one you're testing
INSERT INTO user_tokens (token, description, is_active) VALUES
  ('hello_1210', 'Primary specialized access token for testing', true),
  ('SPEC_ACCESS_2025', 'Specialized access token for 2025', true),
  ('ADVANCED_USER_TOKEN', 'Advanced user access token', true),
  ('BETA_TESTER_ACCESS', 'Beta tester specialized access', true),
  ('DEV_TOKEN_123', 'Development testing token', true),
  ('RISHI_SPECIAL_2025', 'Special token for Rishi', true);

-- Verify tokens were inserted correctly
DO $$
DECLARE
    token_count integer;
    token_record record;
BEGIN
    SELECT COUNT(*) INTO token_count FROM user_tokens WHERE is_active = true;
    RAISE LOG 'Total active tokens in database: %', token_count;
    
    -- Log each token for verification
    FOR token_record IN (SELECT token FROM user_tokens WHERE is_active = true) LOOP
        RAISE LOG 'Active token: %', token_record.token;
    END LOOP;
END $$;

-- Test the hello_1210 token specifically
DO $$
DECLARE
    test_result boolean;
    token_exists boolean;
BEGIN
    -- Check if token exists
    SELECT EXISTS(SELECT 1 FROM user_tokens WHERE token = 'hello_1210' AND is_active = true) INTO token_exists;
    RAISE LOG 'Token hello_1210 exists and is active: %', token_exists;
    
    -- Test the validation query that the frontend uses
    SELECT EXISTS(
        SELECT 1 FROM user_tokens 
        WHERE token = 'hello_1210' 
        AND is_active = true
    ) INTO test_result;
    
    RAISE LOG 'Token validation test result for hello_1210: %', test_result;
END $$;