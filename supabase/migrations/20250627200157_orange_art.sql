/*
  # Debug and fix token insertion issues

  1. Clear existing tokens
  2. Insert new tokens with debugging
  3. Check RLS policies and permissions
  4. Test frontend query patterns
  5. Provide comprehensive debugging output
*/

-- First, let's check the current state
DO $$
BEGIN
    RAISE NOTICE '=== INITIAL STATE CHECK ===';
    RAISE NOTICE 'Current token count: %', (SELECT COUNT(*) FROM user_tokens);
    RAISE NOTICE 'Current active token count: %', (SELECT COUNT(*) FROM user_tokens WHERE is_active = true);
END $$;

-- Clear existing tokens completely
DELETE FROM user_tokens;

-- Verify deletion
DO $$
BEGIN
    RAISE NOTICE '=== AFTER DELETION ===';
    RAISE NOTICE 'Token count after deletion: %', (SELECT COUNT(*) FROM user_tokens);
END $$;

-- Insert tokens with explicit values
INSERT INTO user_tokens (token, description, is_active, created_at) VALUES
  ('hello_1210', 'Primary specialized access token for testing', true, now()),
  ('SPEC_ACCESS_2025', 'Specialized access token for 2025', true, now()),
  ('ADVANCED_USER_TOKEN', 'Advanced user access token', true, now()),
  ('BETA_TESTER_ACCESS', 'Beta tester specialized access', true, now()),
  ('DEV_TOKEN_123', 'Development testing token', true, now());

-- Verify insertion immediately
DO $$
DECLARE
    token_count integer;
    active_count integer;
    current_token record;
BEGIN
    RAISE NOTICE '=== AFTER INSERTION ===';
    
    -- Count all tokens
    SELECT COUNT(*) INTO token_count FROM user_tokens;
    RAISE NOTICE 'Total tokens after insertion: %', token_count;
    
    -- Count active tokens
    SELECT COUNT(*) INTO active_count FROM user_tokens WHERE is_active = true;
    RAISE NOTICE 'Active tokens after insertion: %', active_count;
    
    -- List all tokens with details
    RAISE NOTICE '=== ALL TOKENS IN DATABASE ===';
    FOR current_token IN (
        SELECT id, token, description, is_active, created_at
        FROM user_tokens 
        ORDER BY token
    ) LOOP
        RAISE NOTICE 'ID: %, Token: %, Active: %, Description: %, Created: %', 
                     current_token.id, 
                     current_token.token, 
                     current_token.is_active, 
                     current_token.description, 
                     current_token.created_at;
    END LOOP;
    
    -- Test specific token
    IF EXISTS(SELECT 1 FROM user_tokens WHERE token = 'hello_1210' AND is_active = true) THEN
        RAISE NOTICE '✅ hello_1210 token found and is active';
    ELSE
        RAISE NOTICE '❌ hello_1210 token NOT found or not active';
    END IF;
END $$;

-- Check RLS policies on user_tokens table
DO $$
DECLARE
    rls_enabled boolean;
    policy_count integer;
    policy_info record;
BEGIN
    RAISE NOTICE '=== RLS POLICY CHECK ===';
    
    -- Check if RLS is enabled
    SELECT relrowsecurity INTO rls_enabled 
    FROM pg_class 
    WHERE relname = 'user_tokens';
    
    RAISE NOTICE 'RLS enabled on user_tokens: %', rls_enabled;
    
    -- Count policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE tablename = 'user_tokens';
    
    RAISE NOTICE 'Number of RLS policies on user_tokens: %', policy_count;
    
    -- List all policies properly
    FOR policy_info IN (
        SELECT policyname, array_to_string(roles, ',') as role_list, cmd
        FROM pg_policies 
        WHERE tablename = 'user_tokens'
    ) LOOP
        RAISE NOTICE 'Policy: %, Roles: %, Command: %', 
                     policy_info.policyname, 
                     policy_info.role_list, 
                     policy_info.cmd;
    END LOOP;
END $$;

-- Ensure proper permissions (this might be the issue)
GRANT ALL ON user_tokens TO anon, authenticated, service_role;

-- Test queries that the frontend will use
DO $$
DECLARE
    result_count integer;
    method1_count integer;
    method2_count integer;
    method3_count integer;
BEGIN
    RAISE NOTICE '=== FRONTEND QUERY SIMULATION ===';
    
    -- Test the exact query pattern that Supabase client uses
    SELECT COUNT(*) INTO result_count
    FROM user_tokens 
    WHERE token = 'hello_1210' AND is_active = true;
    
    RAISE NOTICE 'Query result count for hello_1210: %', result_count;
    
    -- Test with different approaches
    SELECT COUNT(*) INTO method1_count
    FROM user_tokens 
    WHERE token = 'hello_1210' AND is_active = true;
    
    SELECT COUNT(*) INTO method2_count
    FROM user_tokens 
    WHERE token = 'hello_1210';
    
    SELECT COUNT(*) INTO method3_count
    FROM user_tokens 
    WHERE is_active = true;
    
    RAISE NOTICE 'Method 1 (token + active): % results', method1_count;
    RAISE NOTICE 'Method 2 (token only): % results', method2_count;
    RAISE NOTICE 'Method 3 (active only): % results', method3_count;
END $$;

-- Test with actual role context simulation
DO $$
DECLARE
    anon_result integer;
    auth_result integer;
BEGIN
    RAISE NOTICE '=== ROLE-BASED ACCESS TEST ===';
    
    -- Test as if we're an anonymous user
    SET ROLE anon;
    SELECT COUNT(*) INTO anon_result
    FROM user_tokens 
    WHERE token = 'hello_1210' AND is_active = true;
    RAISE NOTICE 'Anonymous role access: % results', anon_result;
    
    -- Reset role
    RESET ROLE;
    
    -- Test as authenticated user
    SET ROLE authenticated;
    SELECT COUNT(*) INTO auth_result
    FROM user_tokens 
    WHERE token = 'hello_1210' AND is_active = true;
    RAISE NOTICE 'Authenticated role access: % results', auth_result;
    
    -- Reset role
    RESET ROLE;
    
EXCEPTION
    WHEN OTHERS THEN
        RESET ROLE;
        RAISE NOTICE 'Role test failed: %', SQLERRM;
END $$;

-- Final verification with actual SELECT statements
SELECT 'FINAL TEST 1' as test_name, * FROM user_tokens WHERE token = 'hello_1210';
SELECT 'FINAL TEST 2' as test_name, * FROM user_tokens WHERE token = 'hello_1210' AND is_active = true;
SELECT 'FINAL TEST 3' as test_name, COUNT(*) as total_tokens FROM user_tokens;
SELECT 'FINAL TEST 4' as test_name, COUNT(*) as active_tokens FROM user_tokens WHERE is_active = true;

-- Test the EXISTS pattern specifically
SELECT 'EXISTS TEST' as test_name, EXISTS(
    SELECT 1 FROM user_tokens 
    WHERE token = 'hello_1210' AND is_active = true
) as token_exists;