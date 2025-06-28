/*
  # Fix User Role System and Authentication

  1. Database Changes
    - Create user_role enum type
    - Update user_profiles.role column to use enum
    - Create authentication trigger functions
    - Set up RLS policies for admin access

  2. Security
    - Enable proper role-based access control
    - Set up signup policies for new users
    - Create admin policies for content management
*/

-- Create enum type for user roles
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'regular', 'specialized');
    END IF;
END $$;

-- Clean up existing objects
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP FUNCTION IF EXISTS handle_new_user_signup() CASCADE;
DROP FUNCTION IF EXISTS create_user_profile_manual(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS check_trigger_status() CASCADE;

-- Remove existing admin policies
DROP POLICY IF EXISTS "Admins can manage all blog posts" ON blog_posts;
DROP POLICY IF EXISTS "Admins can manage all projects" ON projects;
DROP POLICY IF EXISTS "Admins can delete any comment" ON blog_comments;

-- Update user_profiles role column
DO $$
BEGIN
    -- Check if column exists and update it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name = 'role'
        AND table_schema = 'public'
    ) THEN
        -- Update existing column to use enum
        ALTER TABLE user_profiles 
        ALTER COLUMN role TYPE user_role 
        USING CASE 
            WHEN role::text = 'admin' THEN 'admin'::user_role
            WHEN role::text = 'specialized' THEN 'specialized'::user_role
            ELSE 'regular'::user_role
        END;
        
        ALTER TABLE user_profiles 
        ALTER COLUMN role SET DEFAULT 'regular'::user_role;
    ELSE
        -- Add column if it doesn't exist
        ALTER TABLE user_profiles 
        ADD COLUMN role user_role NOT NULL DEFAULT 'regular'::user_role;
    END IF;
END $$;

-- Create signup handler function
CREATE FUNCTION handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role_val user_role := 'regular'::user_role;
    user_token text;
BEGIN
    -- Get token from metadata
    user_token := NEW.raw_user_meta_data->>'token';
    
    -- Determine role based on email or token
    IF NEW.email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
        user_role_val := 'admin'::user_role;
    ELSIF user_token IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM user_tokens WHERE token = user_token AND is_active = true) THEN
            user_role_val := 'specialized'::user_role;
        END IF;
    END IF;

    -- Create user record
    INSERT INTO users (id, email, created_at, updated_at)
    VALUES (NEW.id, NEW.email, now(), now())
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = now();

    -- Create user profile
    INSERT INTO user_profiles (id, email, role, token_used, created_at, updated_at)
    VALUES (NEW.id, NEW.email, user_role_val, user_token, now(), now())
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        token_used = EXCLUDED.token_used,
        updated_at = now();

    -- Create user statistics
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
        RETURN NEW;
END;
$$;

-- Create manual profile creation function
CREATE FUNCTION create_user_profile_manual(
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
    -- Determine role
    IF user_email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
        user_role_val := 'admin'::user_role;
    ELSIF user_token IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM user_tokens WHERE token = user_token AND is_active = true) THEN
            user_role_val := 'specialized'::user_role;
        END IF;
    END IF;

    -- Create all user records
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

    -- Return profile data
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

-- Create status check function
CREATE FUNCTION check_trigger_status()
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

-- Create the auth trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user_signup();

-- Create signup policies
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

-- Create admin policies
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