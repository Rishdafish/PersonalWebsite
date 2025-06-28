/*
  # Fix user_role enum type and database schema

  1. Database Schema Fixes
    - Ensure user_role enum type exists
    - Fix user_profiles table role column
    - Recreate all necessary functions and triggers
    - Fix RLS policies

  2. Security
    - Proper RLS policies for signup process
    - Grant necessary permissions

  3. Functions
    - Recreate handle_new_user_signup function
    - Recreate create_user_profile_manual function
*/

-- Step 1: Drop existing objects that might conflict
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user_signup() CASCADE;
DROP FUNCTION IF EXISTS create_user_profile_manual(uuid, text, text) CASCADE;

-- Step 2: Ensure user_role enum type exists
DO $$ 
BEGIN
    -- Drop the type if it exists and recreate it
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        DROP TYPE user_role CASCADE;
    END IF;
    
    -- Create the enum type
    CREATE TYPE user_role AS ENUM ('admin', 'regular', 'specialized');
    
    RAISE NOTICE 'Created user_role enum type';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating user_role enum: %', SQLERRM;
END $$;

-- Step 3: Fix user_profiles table role column
DO $$
BEGIN
    -- Check if user_profiles table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        -- Drop the role column if it exists and recreate it
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'role') THEN
            ALTER TABLE user_profiles DROP COLUMN role;
        END IF;
        
        -- Add the role column with proper type
        ALTER TABLE user_profiles ADD COLUMN role user_role NOT NULL DEFAULT 'regular'::user_role;
        
        RAISE NOTICE 'Fixed user_profiles.role column';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error fixing user_profiles table: %', SQLERRM;
END $$;

-- Step 4: Create the signup trigger function
CREATE OR REPLACE FUNCTION handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role_val user_role := 'regular'::user_role;
    user_token text;
BEGIN
    BEGIN
        -- Extract token from user metadata
        user_token := NEW.raw_user_meta_data->>'token';
        
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

        -- Insert into users table
        INSERT INTO users (id, email, created_at, updated_at)
        VALUES (NEW.id, NEW.email, now(), now())
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            updated_at = now();

        -- Insert into user_profiles table
        INSERT INTO user_profiles (id, email, role, token_used, created_at, updated_at)
        VALUES (NEW.id, NEW.email, user_role_val, user_token, now(), now())
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            role = EXCLUDED.role,
            token_used = EXCLUDED.token_used,
            updated_at = now();

        -- Insert into user_statistics table
        INSERT INTO user_statistics (user_id, total_hours, average_daily_hours, max_session_hours, days_since_start, current_streak, updated_at)
        VALUES (NEW.id, 0, 0, 0, 0, 0, now())
        ON CONFLICT (user_id) DO NOTHING;

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
            -- Create minimal fallback profile
            INSERT INTO user_profiles (id, email, role, created_at, updated_at)
            VALUES (NEW.id, NEW.email, 'regular'::user_role, now(), now())
            ON CONFLICT (id) DO NOTHING;
            
            RETURN NEW;
    END;
END;
$$;

-- Step 5: Create manual profile creation function
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

-- Step 6: Create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user_signup();

-- Step 7: Ensure RLS policies exist
DROP POLICY IF EXISTS "Allow profile creation during signup" ON user_profiles;
DROP POLICY IF EXISTS "Allow user registration during signup" ON users;
DROP POLICY IF EXISTS "Allow achievement creation during signup" ON achievements;
DROP POLICY IF EXISTS "Allow statistics creation during signup" ON user_statistics;

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

-- Step 8: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT INSERT, UPDATE ON users TO supabase_auth_admin;
GRANT INSERT, UPDATE ON user_profiles TO supabase_auth_admin;
GRANT INSERT ON user_statistics TO supabase_auth_admin;
GRANT INSERT ON achievements TO supabase_auth_admin;
GRANT SELECT ON user_tokens TO supabase_auth_admin;

-- Step 9: Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION create_user_profile_manual(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile_manual(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION create_user_profile_manual(uuid, text, text) TO supabase_auth_admin;

-- Step 10: Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;