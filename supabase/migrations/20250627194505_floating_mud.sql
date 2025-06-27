/*
  # Debug Token Validation Issues

  1. Clear and recreate tokens with explicit verification
  2. Add debugging functions to test token validation
  3. Ensure proper data types and constraints
*/

-- Clear existing tokens completely
TRUNCATE user_tokens RESTART IDENTITY CASCADE;

-- Insert tokens with explicit verification
INSERT INTO user_tokens (token, description, is_active, created_at) VALUES
  ('hello_1210', 'Primary specialized access token for testing', true, now()),
  ('SPEC_ACCESS_2025', 'Specialized access token for 2025', true, now()),
  ('ADVANCED_USER_TOKEN', 'Advanced user access token', true, now()),
  ('BETA_TESTER_ACCESS', 'Beta tester specialized access', true, now()),
  ('DEV_TOKEN_123', 'Development testing token', true, now());

-- Create a debug function to test token validation exactly as the frontend does
CREATE OR REPLACE FUNCTION debug_token_validation(test_token text)
RETURNS TABLE(
  token_exists boolean,
  token_active boolean,
  token_data json,
  validation_result boolean
) AS $$
BEGIN
  -- Check if token exists at all
  SELECT EXISTS(SELECT 1 FROM user_tokens WHERE user_tokens.token = test_token) INTO token_exists;
  
  -- Check if token is active
  SELECT EXISTS(SELECT 1 FROM user_tokens WHERE user_tokens.token = test_token AND is_active = true) INTO token_active;
  
  -- Get token data
  SELECT row_to_json(user_tokens.*) INTO token_data 
  FROM user_tokens 
  WHERE user_tokens.token = test_token;
  
  -- Perform the exact validation query the frontend uses
  SELECT EXISTS(
    SELECT 1 FROM user_tokens 
    WHERE user_tokens.token = test_token 
    AND is_active = true
  ) INTO validation_result;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Test the hello_1210 token specifically
SELECT * FROM debug_token_validation('hello_1210');

-- Also test with a non-existent token
SELECT * FROM debug_token_validation('nonexistent_token');

-- Verify all tokens in the database
SELECT 
  token,
  description,
  is_active,
  created_at,
  length(token) as token_length,
  token = 'hello_1210' as is_hello_token
FROM user_tokens 
ORDER BY created_at;

-- Create a function that mimics the exact Supabase client query
CREATE OR REPLACE FUNCTION test_supabase_query(test_token text)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  -- This mimics the exact query: .select('*').eq('token', token).eq('is_active', true)
  SELECT json_agg(row_to_json(user_tokens.*)) INTO result
  FROM user_tokens
  WHERE token = test_token AND is_active = true;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Test the Supabase-style query
SELECT test_supabase_query('hello_1210') as supabase_query_result;

-- Grant permissions to ensure the queries work
GRANT SELECT ON user_tokens TO anon, authenticated;
GRANT EXECUTE ON FUNCTION debug_token_validation(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION test_supabase_query(text) TO anon, authenticated;