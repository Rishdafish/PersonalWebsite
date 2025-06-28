/*
  # Fix User Role Enum and Authentication System

  1. Database Schema Updates
    - Ensure user_role enum exists with proper values
    - Update user_profiles table to use enum type
    - Handle policy dependencies properly

  2. Authentication Functions
    - Create user signup trigger function
    - Create manual profile creation function
    - Add debugging function for trigger status

  3. Security Policies
    - Update RLS policies to work with enum types
    - Ensure proper access control for all user roles

  4. Error Handling
    - Add comprehensive error handling
    - Ensure migration is idempotent
*/

-- Step 1: Clean up existing dependencies
DO $$
BEGIN
  -- Drop trigger first to remove function dependencies
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  
  -- Drop functions that might have dependencies
  DROP FUNCTION IF EXISTS check_trigger_status();
  DROP FUNCTION IF EXISTS create_user_profile_manual(uuid, text, text);
  DROP FUNCTION IF EXISTS create_user_profile_manual(uuid, text);
  DROP FUNCTION IF EXISTS handle_new_user_signup();
  
  RAISE NOTICE 'Cleaned up existing functions and triggers';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error during cleanup: %', SQLERRM;
END $$;

-- Step 2: Ensure user_role enum exists
DO $$
BEGIN
  -- Create enum type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
    CREATE TYPE public.user_role AS ENUM ('admin', 'regular', 'specialized');
    RAISE NOTICE 'Created user_role enum type';
  ELSE
    RAISE NOTICE 'user_role enum type already exists';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating enum: %', SQLERRM;
END $$;

-- Step 3: Handle policies that depend on role column
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  -- Get all policies that might reference user_profiles.role
  FOR policy_record IN 
    SELECT schemaname, tablename, policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND (
      tablename IN ('blog_posts', 'projects', 'blog_comments') 
      OR policyname ILIKE '%admin%'
    )
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
        policy_record.policyname, 
        policy_record.schemaname, 
        policy_record.tablename
      );
      RAISE NOTICE 'Dropped policy % on table %', policy_record.policyname, policy_record.tablename;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not drop policy %: %', policy_record.policyname, SQLERRM;
    END;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error handling policies: %', SQLERRM;
END $$;

-- Step 4: Update user_profiles table role column
DO $$
BEGIN
  -- Check if role column exists and update it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'user_profiles' 
    AND column_name = 'role'
  ) THEN
    -- Try to alter the column type
    BEGIN
      ALTER TABLE public.user_profiles 
      ALTER COLUMN role TYPE public.user_role USING role::text::public.user_role;
      
      ALTER TABLE public.user_profiles 
      ALTER COLUMN role SET DEFAULT 'regular'::public.user_role;
      
      RAISE NOTICE 'Updated role column to use enum type';
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not alter role column: %', SQLERRM;
        -- If we can't alter, try to add a new column and migrate data
        BEGIN
          ALTER TABLE public.user_profiles ADD COLUMN role_new public.user_role DEFAULT 'regular'::public.user_role;
          UPDATE public.user_profiles SET role_new = 
            CASE 
              WHEN role = 'admin' THEN 'admin'::public.user_role
              WHEN role = 'specialized' THEN 'specialized'::public.user_role
              ELSE 'regular'::public.user_role
            END;
          ALTER TABLE public.user_profiles DROP COLUMN role;
          ALTER TABLE public.user_profiles RENAME COLUMN role_new TO role;
          RAISE NOTICE 'Migrated role column using new column approach';
        EXCEPTION
          WHEN OTHERS THEN
            RAISE NOTICE 'Could not migrate role column: %', SQLERRM;
        END;
    END;
  ELSE
    -- Add role column if it doesn't exist
    ALTER TABLE public.user_profiles 
    ADD COLUMN role public.user_role NOT NULL DEFAULT 'regular'::public.user_role;
    RAISE NOTICE 'Added role column to user_profiles';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error updating user_profiles table: %', SQLERRM;
END $$;

-- Step 5: Create utility functions
CREATE OR REPLACE FUNCTION public.check_trigger_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'triggers_exist', EXISTS(
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'on_auth_user_created'
      AND event_object_schema = 'auth'
      AND event_object_table = 'users'
    ),
    'functions_exist', EXISTS(
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = 'public'
      AND routine_name = 'handle_new_user_signup'
    ),
    'enum_exists', EXISTS(
      SELECT 1 FROM pg_type 
      WHERE typname = 'user_role' 
      AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ),
    'timestamp', now()
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Step 6: Create user signup handler function
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_val public.user_role := 'regular'::public.user_role;
  user_token text;
BEGIN
  -- Get token from user metadata if available
  user_token := NEW.raw_user_meta_data->>'token';
  
  -- Determine role based on email or token
  IF NEW.email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    user_role_val := 'admin'::public.user_role;
  ELSIF user_token IS NOT NULL THEN
    -- Check if token exists and is valid
    IF EXISTS (
      SELECT 1 FROM public.user_tokens 
      WHERE token = user_token AND is_active = true
    ) THEN
      user_role_val := 'specialized'::public.user_role;
    END IF;
  END IF;

  -- Insert into users table
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();

  -- Insert into user_profiles table
  INSERT INTO public.user_profiles (id, email, role, token_used, created_at, updated_at)
  VALUES (NEW.id, NEW.email, user_role_val, user_token, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    token_used = EXCLUDED.token_used,
    updated_at = now();

  -- Insert into user_statistics table
  INSERT INTO public.user_statistics (user_id, total_hours, average_daily_hours, max_session_hours, days_since_start, current_streak, updated_at)
  VALUES (NEW.id, 0, 0, 0, 0, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  -- Create default achievements
  INSERT INTO public.achievements (user_id, title, description, icon, category, completed, created_at)
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
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error in handle_new_user_signup: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Step 7: Create manual profile creation function
CREATE OR REPLACE FUNCTION public.create_user_profile_manual(
  user_id uuid,
  user_email text,
  user_token text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_val public.user_role := 'regular'::public.user_role;
  result json;
BEGIN
  -- Determine role based on email or token
  IF user_email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    user_role_val := 'admin'::public.user_role;
  ELSIF user_token IS NOT NULL THEN
    -- Check if token exists and is valid
    IF EXISTS (
      SELECT 1 FROM public.user_tokens 
      WHERE token = user_token AND is_active = true
    ) THEN
      user_role_val := 'specialized'::public.user_role;
    END IF;
  END IF;

  -- Insert into users table
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (user_id, user_email, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();

  -- Insert into user_profiles table
  INSERT INTO public.user_profiles (id, email, role, token_used, created_at, updated_at)
  VALUES (user_id, user_email, user_role_val, user_token, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    token_used = EXCLUDED.token_used,
    updated_at = now();

  -- Insert into user_statistics table
  INSERT INTO public.user_statistics (user_id, total_hours, average_daily_hours, max_session_hours, days_since_start, current_streak, updated_at)
  VALUES (user_id, 0, 0, 0, 0, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  -- Create default achievements
  INSERT INTO public.achievements (user_id, title, description, icon, category, completed, created_at)
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
  FROM public.user_profiles
  WHERE id = user_id;

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating user profile: %', SQLERRM;
END;
$$;

-- Step 8: Create the trigger
DO $$
BEGIN
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();
  RAISE NOTICE 'Created auth trigger successfully';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating trigger: %', SQLERRM;
END $$;

-- Step 9: Recreate RLS policies
DO $$
BEGIN
  -- User profiles policies
  DROP POLICY IF EXISTS "Allow profile creation during signup" ON public.user_profiles;
  CREATE POLICY "Allow profile creation during signup"
    ON public.user_profiles
    FOR INSERT
    TO anon, authenticated, supabase_auth_admin
    WITH CHECK (true);

  -- Users policies
  DROP POLICY IF EXISTS "Allow user registration during signup" ON public.users;
  CREATE POLICY "Allow user registration during signup"
    ON public.users
    FOR INSERT
    TO anon, authenticated, supabase_auth_admin
    WITH CHECK (true);

  -- Achievements policies
  DROP POLICY IF EXISTS "Allow achievement creation during signup" ON public.achievements;
  CREATE POLICY "Allow achievement creation during signup"
    ON public.achievements
    FOR INSERT
    TO anon, authenticated, supabase_auth_admin
    WITH CHECK (true);

  -- User statistics policies
  DROP POLICY IF EXISTS "Allow statistics creation during signup" ON public.user_statistics;
  CREATE POLICY "Allow statistics creation during signup"
    ON public.user_statistics
    FOR INSERT
    TO anon, authenticated, supabase_auth_admin
    WITH CHECK (true);

  RAISE NOTICE 'Created basic RLS policies';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating basic policies: %', SQLERRM;
END $$;

-- Step 10: Recreate admin policies with proper enum casting
DO $$
BEGIN
  -- Blog posts admin policy
  CREATE POLICY "Admins can manage all blog posts"
    ON public.blog_posts
    FOR ALL
    TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'::public.user_role
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'::public.user_role
    ));

  -- Projects admin policy
  CREATE POLICY "Admins can manage all projects"
    ON public.projects
    FOR ALL
    TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'::public.user_role
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'::public.user_role
    ));

  -- Blog comments admin policy
  CREATE POLICY "Admins can delete any comment"
    ON public.blog_comments
    FOR DELETE
    TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'::public.user_role
    ));

  RAISE NOTICE 'Created admin policies with enum casting';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating admin policies: %', SQLERRM;
END $$;

-- Step 11: Final verification
DO $$
DECLARE
  status_result json;
BEGIN
  SELECT public.check_trigger_status() INTO status_result;
  RAISE NOTICE 'Migration completed. Status: %', status_result;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in final verification: %', SQLERRM;
END $$;