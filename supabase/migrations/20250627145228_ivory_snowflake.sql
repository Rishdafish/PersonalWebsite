/*
  # Fix User Registration and Admin Setup

  1. Functions
    - Recreate handle_new_user function with proper error handling
    - Recreate create_default_achievements function with proper error handling
  
  2. Triggers
    - Set up triggers for automatic user record creation
    - Set up triggers for default achievements creation
  
  3. Security
    - Ensure RLS policies work correctly for new users
    - Admin accounts must be created through normal Supabase Auth registration
*/

-- Drop existing functions if they exist to recreate them with better error handling
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS create_default_achievements() CASCADE;

-- Create improved handle_new_user function with error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    -- Insert into users table (NEW.id comes from auth.users)
    INSERT INTO public.users (id, email, created_at, updated_at)
    VALUES (NEW.id, NEW.email, NOW(), NOW());
    
    -- Insert initial user statistics
    INSERT INTO public.user_statistics (user_id, total_hours, average_daily_hours, max_session_hours, days_since_start, current_streak, updated_at)
    VALUES (NEW.id, 0, 0, 0, 0, 0, NOW());
    
    RETURN NEW;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but don't fail the user creation
      RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
      RETURN NEW;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create improved create_default_achievements function with error handling
CREATE OR REPLACE FUNCTION create_default_achievements()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    -- Create default achievements for new users
    INSERT INTO public.achievements (user_id, title, description, icon, category, completed, created_at)
    VALUES 
      (NEW.id, 'First Steps', 'Welcome to your learning journey!', '🎯', 'Getting Started', false, NOW()),
      (NEW.id, 'Early Bird', 'Log your first study session', '🌅', 'Study Habits', false, NOW()),
      (NEW.id, 'Consistency King', 'Study for 7 days in a row', '👑', 'Streaks', false, NOW()),
      (NEW.id, 'Marathon Runner', 'Study for 10+ hours in a single session', '🏃‍♂️', 'Endurance', false, NOW()),
      (NEW.id, 'Subject Master', 'Complete your first subject', '🎓', 'Completion', false, NOW());
    
    RETURN NEW;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but don't fail the user creation
      RAISE WARNING 'Error in create_default_achievements: %', SQLERRM;
      RETURN NEW;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for new user handling
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

DROP TRIGGER IF EXISTS on_user_created_achievements ON public.users;
CREATE TRIGGER on_user_created_achievements
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION create_default_achievements();

-- Update RLS policies to ensure they work correctly
-- Make sure the auth.uid() function works properly in policies

-- Update users table policies to be more permissive for user creation
DROP POLICY IF EXISTS "Allow user registration" ON public.users;
CREATE POLICY "Allow user registration"
  ON public.users
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Ensure service role can manage all data
DROP POLICY IF EXISTS "Service role can manage users" ON public.users;
CREATE POLICY "Service role can manage users"
  ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update user_statistics policies
DROP POLICY IF EXISTS "Users can manage own statistics" ON public.user_statistics;
CREATE POLICY "Users can manage own statistics"
  ON public.user_statistics
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage statistics" ON public.user_statistics;
CREATE POLICY "Service role can manage statistics"
  ON public.user_statistics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update subjects policies
DROP POLICY IF EXISTS "Users can manage own subjects" ON public.subjects;
CREATE POLICY "Users can manage own subjects"
  ON public.subjects
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage subjects" ON public.subjects;
CREATE POLICY "Service role can manage subjects"
  ON public.subjects
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update achievements policies
DROP POLICY IF EXISTS "Users can manage own achievements" ON public.achievements;
CREATE POLICY "Users can manage own achievements"
  ON public.achievements
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage achievements" ON public.achievements;
CREATE POLICY "Service role can manage achievements"
  ON public.achievements
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update work_entries policies
DROP POLICY IF EXISTS "Users can manage own work entries" ON public.work_entries;
CREATE POLICY "Users can manage own work entries"
  ON public.work_entries
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage work entries" ON public.work_entries;
CREATE POLICY "Service role can manage work entries"
  ON public.work_entries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Note: Admin accounts need to be created through Supabase Auth interface
-- or by registering normally with the specified email addresses and password
-- The triggers will automatically create the corresponding records in public tables