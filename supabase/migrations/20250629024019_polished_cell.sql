/*
  # Fix ambiguous column reference in create_user_profile_manual function

  1. Database Changes
    - Drop and recreate create_user_profile_manual function with proper constraint references
    - Use constraint names instead of column names to avoid ambiguity
    - Maintain all existing functionality

  2. Security
    - Preserve all existing RLS policies and permissions
    - Maintain SECURITY DEFINER for controlled access
*/

-- Drop the existing function to avoid conflicts
DROP FUNCTION IF EXISTS create_user_profile_manual(uuid, text, text) CASCADE;

-- Create the manual profile creation function with proper constraint references
CREATE FUNCTION create_user_profile_manual(
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

    -- Insert into users table using constraint name to avoid ambiguity
    INSERT INTO users (id, email, created_at, updated_at)
    VALUES (p_user_id, p_user_email, now(), now())
    ON CONFLICT ON CONSTRAINT users_pkey DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = now();

    -- Insert into user_profiles table using constraint name to avoid ambiguity
    INSERT INTO user_profiles (id, email, role, token_used, created_at, updated_at)
    VALUES (p_user_id, p_user_email, v_role, v_token_used, now(), now())
    ON CONFLICT ON CONSTRAINT user_profiles_pkey DO UPDATE SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        token_used = EXCLUDED.token_used,
        updated_at = now();

    -- Insert basic statistics using constraint name to avoid ambiguity
    INSERT INTO user_statistics (user_id, total_hours, average_daily_hours, max_session_hours, days_since_start, current_streak, updated_at)
    VALUES (p_user_id, 0, 0, 0, 0, 0, now())
    ON CONFLICT ON CONSTRAINT user_statistics_user_id_key DO NOTHING;

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

-- Grant function execution permissions
GRANT EXECUTE ON FUNCTION create_user_profile_manual(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile_manual(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION create_user_profile_manual(uuid, text, text) TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION create_user_profile_manual(uuid, text, text) TO anon;

-- Verify the function was created successfully
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'create_user_profile_manual'
        AND routine_type = 'FUNCTION'
    ) THEN
        RAISE NOTICE 'create_user_profile_manual function created successfully with constraint-based conflict resolution';
    ELSE
        RAISE WARNING 'Failed to create create_user_profile_manual function';
    END IF;
END $$;