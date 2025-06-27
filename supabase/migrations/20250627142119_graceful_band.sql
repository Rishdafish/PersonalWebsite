/*
  # User Roles and Authentication System

  1. New Tables
    - `user_profiles` - Extended user information with roles
    - `user_tokens` - Valid registration tokens for specialized users
  
  2. User Roles
    - `admin` - Full access to all features (3 fixed accounts)
    - `regular` - Limited access (view blogs, projects only)
    - `specialized` - Enhanced access (includes hours page, can comment)
  
  3. Security
    - Enable RLS on all tables
    - Add policies for role-based access control
    - Secure token validation system
*/

-- Create enum for user roles
CREATE TYPE user_role AS ENUM ('admin', 'regular', 'specialized');

-- Create user_profiles table to extend auth.users
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role user_role NOT NULL DEFAULT 'regular',
  token_used text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_tokens table for specialized user registration
CREATE TABLE IF NOT EXISTS user_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;

-- Insert the specialized user token
INSERT INTO user_tokens (token, description) 
VALUES ('hello1212', 'Specialized user registration token')
ON CONFLICT (token) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS user_profiles_email_idx ON user_profiles(email);
CREATE INDEX IF NOT EXISTS user_profiles_role_idx ON user_profiles(role);
CREATE INDEX IF NOT EXISTS user_tokens_token_idx ON user_tokens(token);

-- RLS Policies for user_profiles
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can manage profiles"
  ON user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for user_tokens (read-only for authenticated users)
CREATE POLICY "Authenticated users can read active tokens"
  ON user_tokens
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Service role can manage tokens"
  ON user_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update existing table policies to include role-based access

-- Update blog_posts policies
DROP POLICY IF EXISTS "Users can manage own blog posts" ON blog_posts;
DROP POLICY IF EXISTS "Public can read published blog posts" ON blog_posts;

CREATE POLICY "Admins can manage all blog posts"
  ON blog_posts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "All users can read published blog posts"
  ON blog_posts
  FOR SELECT
  TO authenticated
  USING (published = true);

CREATE POLICY "Public can read published blog posts"
  ON blog_posts
  FOR SELECT
  TO anon
  USING (published = true);

-- Update projects policies
DROP POLICY IF EXISTS "Users can manage own projects" ON projects;
DROP POLICY IF EXISTS "Public can read projects" ON projects;

CREATE POLICY "Admins can manage all projects"
  ON projects
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "All users can read projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Public can read projects"
  ON projects
  FOR SELECT
  TO anon
  USING (true);

-- Update hours-related table policies (subjects, work_entries, user_statistics, achievements)
DROP POLICY IF EXISTS "Users can manage own subjects" ON subjects;
CREATE POLICY "Admins and specialized users can manage own subjects"
  ON subjects
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'specialized')
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'specialized')
    )
  );

DROP POLICY IF EXISTS "Users can manage own work entries" ON work_entries;
CREATE POLICY "Admins and specialized users can manage own work entries"
  ON work_entries
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'specialized')
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'specialized')
    )
  );

DROP POLICY IF EXISTS "Users can manage own statistics" ON user_statistics;
CREATE POLICY "Admins and specialized users can manage own statistics"
  ON user_statistics
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'specialized')
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'specialized')
    )
  );

DROP POLICY IF EXISTS "Users can manage own achievements" ON achievements;
CREATE POLICY "Admins and specialized users can manage own achievements"
  ON achievements
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'specialized')
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'specialized')
    )
  );

-- Create comments table for blog posts
CREATE TABLE IF NOT EXISTS blog_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE blog_comments ENABLE ROW LEVEL SECURITY;

-- Comments policies
CREATE POLICY "All users can read comments"
  ON blog_comments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Specialized users and admins can create comments"
  ON blog_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'specialized')
    )
  );

CREATE POLICY "Users can update own comments"
  ON blog_comments
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'specialized')
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'specialized')
    )
  );

CREATE POLICY "Admins can delete any comment"
  ON blog_comments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can delete own comments"
  ON blog_comments
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'specialized')
    )
  );

-- Function to handle new user registration with role assignment
CREATE OR REPLACE FUNCTION handle_new_user_with_role()
RETURNS TRIGGER AS $$
DECLARE
  user_role_val user_role := 'regular';
  admin_emails text[] := ARRAY['rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com'];
BEGIN
  -- Check if user is admin
  IF NEW.email = ANY(admin_emails) THEN
    user_role_val := 'admin';
  -- Check if user provided a valid token in raw_user_meta_data
  ELSIF NEW.raw_user_meta_data->>'token' IS NOT NULL THEN
    -- Validate token
    IF EXISTS (
      SELECT 1 FROM user_tokens 
      WHERE token = NEW.raw_user_meta_data->>'token' AND is_active = true
    ) THEN
      user_role_val := 'specialized';
    END IF;
  END IF;

  -- Insert user profile
  INSERT INTO public.user_profiles (id, email, role, token_used, created_at, updated_at)
  VALUES (
    NEW.id, 
    NEW.email, 
    user_role_val,
    CASE WHEN user_role_val = 'specialized' THEN NEW.raw_user_meta_data->>'token' ELSE NULL END,
    NOW(), 
    NOW()
  );

  -- Create initial data for admin and specialized users
  IF user_role_val IN ('admin', 'specialized') THEN
    -- Insert initial user statistics
    INSERT INTO public.user_statistics (user_id, total_hours, average_daily_hours, max_session_hours, days_since_start, current_streak, updated_at)
    VALUES (NEW.id, 0, 0, 0, 0, 0, NOW());
    
    -- Create default achievements
    INSERT INTO public.achievements (user_id, title, description, icon, category, completed, created_at)
    VALUES 
      (NEW.id, 'First Steps', 'Welcome to your learning journey!', '🎯', 'Getting Started', false, NOW()),
      (NEW.id, 'Early Bird', 'Log your first study session', '🌅', 'Study Habits', false, NOW()),
      (NEW.id, 'Consistency King', 'Study for 7 days in a row', '👑', 'Streaks', false, NOW()),
      (NEW.id, 'Marathon Runner', 'Study for 10+ hours in a single session', '🏃‍♂️', 'Endurance', false, NOW()),
      (NEW.id, 'Subject Master', 'Complete your first subject', '🎓', 'Completion', false, NOW());
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Error in handle_new_user_with_role: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user handling
DROP TRIGGER IF EXISTS on_auth_user_created_with_role ON auth.users;
CREATE TRIGGER on_auth_user_created_with_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_with_role();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blog_comments_updated_at
  BEFORE UPDATE ON blog_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();