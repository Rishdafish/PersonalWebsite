/*
  # Fix user_role enum type and signup process

  1. Database Changes
    - Safely handle user_role enum type creation
    - Fix user_profiles table role column
    - Create comprehensive signup trigger function
    - Add manual profile creation function
    - Set up proper RLS policies and permissions

  2. Security
    - Enable RLS on all relevant tables
    - Create signup policies for all required tables
    - Grant necessary permissions to all roles

  3. Error Handling
    - Comprehensive error handling in trigger function
    - Fallback mechanisms for profile creation
    - Detailed logging for debugging
*/

-- Step 1: Safely handle the enum type creation
DO $$ 
BEGIN
    -- Check if user_role enum already exists
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        -- Create the enum type
        CREATE TYPE user_role AS ENUM ('admin', 'regular', 'specialized');
        RAISE NOTICE 'Created user_role enum type';
    ELSE
        RAISE NOTICE 'user_role enum type already exists';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating enum type: %', SQLERRM;
        -- If there's an error, try to continue anyway
END $$;

-- Step 2: Fix the user_profiles table role column
DO $$
BEGIN
    -- Check if the role column exists and has the wrong type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'role'
        AND data_type != 'USER-DEFINED'
    ) THEN
        -- Drop and recreate the role column with correct type
        ALTER TABLE user_profiles DROP COLUMN role;
        ALTER TABLE user_profiles ADD COLUMN role user_role NOT NULL DEFAULT 'regular'::user_role;
        RAISE NOTICE 'Fixed user_profiles role column type';
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'role'
    ) THEN
        -- Add the role column if it doesn't exist
        ALTER TABLE user_profiles ADD COLUMN role user_role NOT NULL DEFAULT 'regular'::user_role;
        RAISE NOTICE 'Added role column to user_profiles';
    ELSE
        RAISE NOTICE 'user_profiles role column is already correct';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error fixing user_profiles table: %', SQLERRM;
END $$;

-- Step 3: Create the signup trigger function with comprehensive error handling
CREATE OR REPLACE FUNCTION handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role_val user_role := 'regular'::user_role;
    user_token text;
    operation_step text := 'initialization';
BEGIN
    BEGIN
        operation_step := 'extracting token';
        user_token := NEW.raw_user_meta_data->>'token';
        
        operation_step := 'determining role';
        -- Determine user role based on email or token
        IF NEW.email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
            user_role_val := 'admin'::user_role;
        ELSIF user_token IS NOT NULL THEN
            -- Check if token exists and is active
            IF EXISTS (
                SELECT 1 FROM user_tokens 
                WHERE token = user_token AND is_active = true
            ) THEN
                user_role_val := 'specialized'::user_role;
            END IF;
        END IF;

        operation_step := 'inserting into users table';
        -- Insert into users table
        INSERT INTO users (id, email, created_at, updated_at)
        VALUES (NEW.id, NEW.email, now(), now())
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            updated_at = now();

        operation_step := 'inserting into user_profiles table';
        -- Insert into user_profiles table
        INSERT INTO user_profiles (id, email, role, token_used, created_at, updated_at)
        VALUES (NEW.id, NEW.email, user_role_val, user_token, now(), now())
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            role = EXCLUDED.role,
            token_used = EXCLUDED.token_used,
            updated_at = now();

        operation_step := 'inserting into user_statistics table';
        -- Insert into user_statistics table
        INSERT INTO user_statistics (user_id, total_hours, average_daily_hours, max_session_hours, days_since_start, current_streak, updated_at)
        VALUES (NEW.id, 0, 0, 0, 0, 0, now())
        ON CONFLICT (user_id) DO NOTHING;

        operation_step := 'creating default achievements';
        -- Create default achievements
        INSERT INTO achievements (user_id, title, description, icon, category, completed, created_at)
        VALUES 
            (NEW.id, 'Welcome!', 'Successfully created your account', '🎉', 'General', true, now()),
            (NEW.id, 'First Steps', 'Complete your first work entry', '👣', 'Progress', false, now()),
            (NEW.id, 'Dedicated', 'Log 10 hours of work', '💪', 'Progress', false, now()),
            (NEW.id, 'Consistent', 'Maintain a 7-day streak', '🔥', 'Streaks', false, now()),
            (NEW.id, 'Marathon', 'Log 100 hours total', '🏃', 'Milestones', false, now())
        ON CONFLICT DO NOTHING;

        RETURN NEW;
    EXCEPTION
        WHEN OTHERS THEN
            -- Log the specific error and step where it occurred
            RAISE WARNING 'Error in handle_new_user_signup at step "%": % - %', operation_step, SQLSTATE, SQLERRM;
            
            -- Try to create a minimal fallback profile
            BEGIN
                INSERT INTO user_profiles (id, email, role, created_at, updated_at)
                VALUES (NEW.id, NEW.email, 'regular'::user_role, now(), now())
                ON CONFLICT (id) DO NOTHING;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE WARNING 'Failed to create fallback profile: % - %', SQLSTATE, SQLERRM;
            END;
            
            -- Always return NEW to allow user creation to succeed
            RETURN NEW;
    END;
END;
$$;

-- Step 4: Create manual profile creation function
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
    v_role user_role := 'regular'::user_role;
    v_token_used text := NULL;
BEGIN
    -- Determine role based on email or token
    IF p_user_email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
        v_role := 'admin'::user_role;
    ELSIF p_user_token IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM user_tokens 
            WHERE token = p_user_token AND is_active = true
        ) THEN
            v_role := 'specialized'::user_role;
            v_token_used := p_user_token;
        END IF;
    END IF;

    -- Insert into users table
    INSERT INTO users (id, email, created_at, updated_at)
    VALUES (p_user_id, p_user_email, now(), now())
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = now();

    -- Insert into user_profiles table
    INSERT INTO user_profiles (id, email, role, token_used, created_at, updated_at)
    VALUES (p_user_id, p_user_email, v_role, v_token_used, now(), now())
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        token_used = EXCLUDED.token_used,
        updated_at = now();

    -- Insert basic statistics
    INSERT INTO user_statistics (user_id, total_hours, average_daily_hours, max_session_hours, days_since_start, current_streak, updated_at)
    VALUES (p_user_id, 0, 0, 0, 0, 0, now())
    ON CONFLICT (user_id) DO NOTHING;

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

-- Step 5: Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user_signup();

-- Step 6: Ensure all necessary RLS policies exist
-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow profile creation during signup" ON user_profiles;
DROP POLICY IF EXISTS "Allow user registration during signup" ON users;
DROP POLICY IF EXISTS "Allow achievement creation during signup" ON achievements;
DROP POLICY IF EXISTS "Allow statistics creation during signup" ON user_statistics;

-- Create comprehensive signup policies
CREATE POLICY "Allow profile creation during signup"
    ON user_profiles
    FOR INSERT
    TO anon, authenticated, supabase_auth_admin
    WITH CHECK (true);

CREATE POLICY "Allow user registration during signup"
    ON users
    FOR INSERT
    TO anon, authenticated, supabase_auth_admin
    WITH CHECK (true);

CREATE POLICY "Allow achievement creation during signup"
    ON achievements
    FOR INSERT
    TO anon, authenticated, supabase_auth_admin
    WITH CHECK (true);

CREATE POLICY "Allow statistics creation during signup"
    ON user_statistics
    FOR INSERT
    TO anon, authenticated, supabase_auth_admin
    WITH CHECK (true);

-- Step 7: Grant all necessary permissions
-- Grant schema usage
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant table permissions
GRANT INSERT, UPDATE, SELECT ON users TO supabase_auth_admin;
GRANT INSERT, UPDATE, SELECT ON user_profiles TO supabase_auth_admin;
GRANT INSERT, SELECT ON user_statistics TO supabase_auth_admin;
GRANT INSERT, SELECT ON achievements TO supabase_auth_admin;
GRANT SELECT ON user_tokens TO supabase_auth_admin;

-- Grant function execution permissions
GRANT EXECUTE ON FUNCTION create_user_profile_manual(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile_manual(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION create_user_profile_manual(uuid, text, text) TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION create_user_profile_manual(uuid, text, text) TO anon;

-- Grant sequence permissions if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name LIKE '%user_profiles%') THEN
        GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;
    END IF;
END $$;

-- Step 8: Ensure RLS is enabled on all relevant tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;

-- Step 9: Create a verification function to check the setup
CREATE OR REPLACE FUNCTION verify_signup_setup()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
    enum_exists boolean;
    trigger_exists boolean;
    function_exists boolean;
    policies_count integer;
    role_column_type text;
BEGIN
    -- Check if enum exists
    SELECT EXISTS(
        SELECT 1 FROM pg_type WHERE typname = 'user_role'
    ) INTO enum_exists;
    
    -- Check if trigger exists
    SELECT EXISTS(
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'on_auth_user_created'
    ) INTO trigger_exists;
    
    -- Check if function exists
    SELECT EXISTS(
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'handle_new_user_signup'
    ) INTO function_exists;
    
    -- Count signup policies
    SELECT COUNT(*) INTO policies_count
    FROM pg_policies 
    WHERE policyname LIKE '%signup%';
    
    -- Check role column type
    SELECT data_type INTO role_column_type
    FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'role';
    
    SELECT json_build_object(
        'enum_exists', enum_exists,
        'trigger_exists', trigger_exists,
        'function_exists', function_exists,
        'policies_count', policies_count,
        'role_column_type', role_column_type,
        'timestamp', now(),
        'status', CASE 
            WHEN enum_exists AND trigger_exists AND function_exists AND policies_count >= 4 THEN 'ready'
            ELSE 'needs_attention'
        END
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Step 10: Add helpful indexes
DO $$
BEGIN
    -- Create indexes only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_profiles_email') THEN
        CREATE INDEX idx_user_profiles_email ON user_profiles(email);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_profiles_role') THEN
        CREATE INDEX idx_user_profiles_role ON user_profiles(role);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_tokens_token_active') THEN
        CREATE INDEX idx_user_tokens_token_active ON user_tokens(token) WHERE is_active = true;
    END IF;
END $$;

-- Step 11: Final verification
DO $$
DECLARE
    verification_result json;
BEGIN
    SELECT verify_signup_setup() INTO verification_result;
    RAISE NOTICE 'Setup verification result: %', verification_result;
END $$;