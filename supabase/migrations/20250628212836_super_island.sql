/*
  # Complete User Management System Setup

  1. Database Schema
    - Create user_role enum type
    - Update user_profiles table with proper role column
    - Ensure all tables have proper structure

  2. Functions and Triggers
    - User signup handler with role assignment
    - Manual profile creation function
    - Utility functions for system monitoring

  3. Security Policies
    - RLS policies for signup process
    - Admin-specific access policies
    - Role-based permissions

  4. Default Data
    - Welcome achievements for new users
    - Initial statistics tracking
*/

-- Step 1: Create enum type for user roles (handle existing type)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'regular', 'specialized');
    END IF;
END $$;

-- Step 2: Clean up existing objects to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user_signup();
DROP FUNCTION IF EXISTS create_user_profile_manual(uuid, text, text);
DROP FUNCTION IF EXISTS create_user_profile_manual(uuid, text);
DROP FUNCTION IF EXISTS check_trigger_status();

-- Step 3: Remove existing admin policies that will be recreated
DROP POLICY IF EXISTS "Admins can manage all blog posts" ON blog_posts;
DROP POLICY IF EXISTS "Admins can manage all projects" ON projects;
DROP POLICY IF EXISTS "Admins can delete any comment" ON blog_comments;

-- Step 4: Update user_profiles table role column
ALTER TABLE user_profiles 
ALTER COLUMN role TYPE user_role 
USING CASE 
    WHEN role::text = 'admin' THEN 'admin'::user_role
    WHEN role::text = 'specialized' THEN 'specialized'::user_role
    ELSE 'regular'::user_role
END;

ALTER TABLE user_profiles 
ALTER COLUMN role SET DEFAULT 'regular'::user_role;

-- Step 5: Create function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role_val user_role := 'regular'::user_role;
    user_token text;
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
        -- Don't fail user creation if profile creation fails
        RETURN NEW;
END;
$$;

-- Step 6: Create function for manual profile creation
CREATE OR REPLACE FUNCTION create_user_profile_manual(
    user_id uuid,
    user_email text,
    user_token text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role_val user_role := 'regular'::user_role;
    result json;
BEGIN
    -- Determine user role
    IF user_email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
        user_role_val := 'admin'::user_role;
    ELSIF user_token IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM user_tokens 
            WHERE token = user_token AND is_active = true
        ) THEN
            user_role_val := 'specialized'::user_role;
        END IF;
    END IF;

    -- Create user records
    INSERT INTO users (id, email, created_at, updated_at)
    VALUES (user_id, user_email, now(), now())
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = now();

    INSERT INTO user_profiles (id, email, role, token_used, created_at, updated_at)
    VALUES (user_id, user_email, user_role_val, user_token, now(), now())
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        token_used = EXCLUDED.token_used,
        updated_at = now();

    INSERT INTO user_statistics (user_id, total_hours, average_daily_hours, max_session_hours, days_since_start, current_streak, updated_at)
    VALUES (user_id, 0, 0, 0, 0, 0, now())
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO achievements (user_id, title, description, icon, category, completed, created_at)
    VALUES 
        (user_id, 'Welcome!', 'Successfully created your account', '🎉', 'General', true, now()),
        (user_id, 'First Steps', 'Complete your first work entry', '👣', 'Progress', false, now()),
        (user_id, 'Dedicated', 'Log 10 hours of work', '💪', 'Progress', false, now()),
        (user_id, 'Consistent', 'Maintain a 7-day streak', '🔥', 'Streaks', false, now()),
        (user_id, 'Marathon', 'Log 100 hours total', '🏃', 'Milestones', false, now())
    ON CONFLICT DO NOTHING;

    -- Return the created profile
    SELECT json_build_object(
        'id', id,
        'email', email,
        'role', role,
        'token_used', token_used,
        'created_at', created_at,
        'updated_at', updated_at
    ) INTO result
    FROM user_profiles
    WHERE id = user_id;

    RETURN result;
END;
$$;

-- Step 7: Create utility function for checking trigger status
CREATE OR REPLACE FUNCTION check_trigger_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'triggers_exist', EXISTS(
            SELECT 1 FROM information_schema.triggers 
            WHERE trigger_name = 'on_auth_user_created'
        ),
        'functions_exist', EXISTS(
            SELECT 1 FROM information_schema.routines 
            WHERE routine_name = 'handle_new_user_signup'
        ),
        'enum_exists', EXISTS(
            SELECT 1 FROM pg_type WHERE typname = 'user_role'
        ),
        'timestamp', now()
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Step 8: Create trigger for automatic user profile creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user_signup();

-- Step 9: Create RLS policies for signup process
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

-- Step 10: Create admin-specific policies
CREATE POLICY "Admins can manage all blog posts"
    ON blog_posts
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid() 
        AND user_profiles.role = 'admin'::user_role
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid() 
        AND user_profiles.role = 'admin'::user_role
    ));

CREATE POLICY "Admins can manage all projects"
    ON projects
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid() 
        AND user_profiles.role = 'admin'::user_role
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid() 
        AND user_profiles.role = 'admin'::user_role
    ));

CREATE POLICY "Admins can delete any comment"
    ON blog_comments
    FOR DELETE
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid() 
        AND user_profiles.role = 'admin'::user_role
    ));