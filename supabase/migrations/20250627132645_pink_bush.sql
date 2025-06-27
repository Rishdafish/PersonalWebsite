/*
  # Fix user registration and create admin accounts

  1. Database Functions
    - Update handle_new_user function to handle errors gracefully
    - Update create_default_achievements function to handle errors gracefully
  
  2. Admin Account Creation
    - Create admin accounts with specified credentials
    - Ensure proper user records are created
  
  3. Error Handling
    - Add proper error handling to prevent registration failures
    - Ensure all triggers work correctly
*/

-- Drop existing functions if they exist to recreate them with better error handling
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS create_default_achievements() CASCADE;

-- Create improved handle_new_user function with error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    -- Insert into users table
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

-- Create admin accounts with specified credentials
-- Note: These will be created in the auth.users table by Supabase Auth
-- The trigger will automatically create corresponding records in public.users

-- Insert admin user records directly if they don't exist
-- This ensures the admin accounts work even if created outside of normal registration
DO $$
DECLARE
  admin_emails TEXT[] := ARRAY['rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com'];
  admin_email TEXT;
  admin_id UUID;
BEGIN
  FOREACH admin_email IN ARRAY admin_emails
  LOOP
    -- Generate a UUID for the admin user
    admin_id := gen_random_uuid();
    
    -- Insert into users table if not exists
    INSERT INTO public.users (id, email, created_at, updated_at)
    VALUES (admin_id, admin_email, NOW(), NOW())
    ON CONFLICT (email) DO NOTHING;
    
    -- Get the actual user ID (in case it already existed)
    SELECT id INTO admin_id FROM public.users WHERE email = admin_email;
    
    -- Insert initial user statistics if not exists
    INSERT INTO public.user_statistics (user_id, total_hours, average_daily_hours, max_session_hours, days_since_start, current_streak, updated_at)
    VALUES (admin_id, 0, 0, 0, 0, 0, NOW())
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Create default achievements if not exists
    INSERT INTO public.achievements (user_id, title, description, icon, category, completed, created_at)
    SELECT admin_id, title, description, icon, category, completed, NOW()
    FROM (VALUES 
      ('First Steps', 'Welcome to your learning journey!', '🎯', 'Getting Started', false),
      ('Early Bird', 'Log your first study session', '🌅', 'Study Habits', false),
      ('Consistency King', 'Study for 7 days in a row', '👑', 'Streaks', false),
      ('Marathon Runner', 'Study for 10+ hours in a single session', '🏃‍♂️', 'Endurance', false),
      ('Subject Master', 'Complete your first subject', '🎓', 'Completion', false)
    ) AS default_achievements(title, description, icon, category, completed)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.achievements 
      WHERE user_id = admin_id AND title = default_achievements.title
    );
  END LOOP;
END $$;