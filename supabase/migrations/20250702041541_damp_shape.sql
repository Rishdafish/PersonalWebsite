/*
  # Consolidated Database Schema Migration

  This migration creates the complete database schema for the portfolio application,
  handling existing objects gracefully to avoid conflicts.

  ## New Tables
  - `user_profiles` - User profile information with role-based access
  - `user_tokens` - Specialized access tokens
  - `users` - Mirror of auth.users for easier querying
  - `blog_posts` - Blog post content and metadata
  - `blog_comments` - Comments on blog posts
  - `projects` - Portfolio projects
  - `subjects` - Study subjects for hours tracking
  - `work_entries` - Time tracking entries
  - `achievements` - User achievements and milestones
  - `user_statistics` - Aggregated user statistics

  ## Security
  - Enable RLS on all tables
  - Create comprehensive policies for role-based access
  - Secure functions with proper permissions

  ## Functions
  - User signup handling with automatic profile creation
  - Manual profile creation for edge cases
  - Updated timestamp triggers
*/

-- Create user role enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'regular', 'specialized');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create user profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role user_role NOT NULL DEFAULT 'regular',
  token_used text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user tokens table for specialized access
CREATE TABLE IF NOT EXISTS user_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create users table (mirrors auth.users for easier querying)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create blog posts table
CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  published boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create blog comments table
CREATE TABLE IF NOT EXISTS blog_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  technologies text[] DEFAULT '{}',
  status text DEFAULT 'Planning',
  github_url text,
  live_demo_url text,
  start_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subjects table for hours tracking
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_hours numeric DEFAULT 0,
  current_hours numeric DEFAULT 0,
  icon text DEFAULT '📚',
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create work entries table
CREATE TABLE IF NOT EXISTS work_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  hours numeric NOT NULL CHECK (hours > 0),
  description text NOT NULL,
  entry_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  icon text DEFAULT '🏆',
  category text DEFAULT 'General',
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create user statistics table
CREATE TABLE IF NOT EXISTS user_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  total_hours numeric DEFAULT 0,
  average_daily_hours numeric DEFAULT 0,
  max_session_hours numeric DEFAULT 0,
  days_since_start integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users(created_at);
CREATE INDEX IF NOT EXISTS user_profiles_email_idx ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role_fixed ON user_profiles(role);
CREATE INDEX IF NOT EXISTS user_tokens_token_idx ON user_tokens(token);
CREATE INDEX IF NOT EXISTS idx_user_tokens_token_active ON user_tokens(token) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS blog_posts_user_id_idx ON blog_posts(user_id);
CREATE INDEX IF NOT EXISTS blog_posts_published_idx ON blog_posts(published);
CREATE INDEX IF NOT EXISTS blog_posts_created_at_idx ON blog_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);
CREATE INDEX IF NOT EXISTS projects_status_idx ON projects(status);
CREATE INDEX IF NOT EXISTS projects_created_at_idx ON projects(created_at DESC);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_statistics ENABLE ROW LEVEL SECURITY;

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at (drop existing first to avoid conflicts)
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON blog_posts;
DROP TRIGGER IF EXISTS update_blog_comments_updated_at ON blog_comments;
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user_signup()
RETURNS TRIGGER AS $$
DECLARE
  user_role_val user_role := 'regular';
  user_token text;
BEGIN
  -- Get token from user metadata
  user_token := NEW.raw_user_meta_data->>'token';
  
  -- Determine role based on email or token
  IF NEW.email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    user_role_val := 'admin';
  ELSIF user_token IS NOT NULL THEN
    -- Check if token exists and is valid
    IF EXISTS (
      SELECT 1 FROM user_tokens 
      WHERE token = user_token AND is_active = true
    ) THEN
      user_role_val := 'specialized';
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
    (NEW.id, 'Welcome!', 'Created your account', '🎉', 'General', true, now()),
    (NEW.id, 'First Steps', 'Complete your first work entry', '👣', 'Progress', false, now()),
    (NEW.id, 'Dedicated', 'Log 10 hours of work', '💪', 'Progress', false, now()),
    (NEW.id, 'Consistent', 'Work for 7 days in a row', '🔥', 'Streaks', false, now()),
    (NEW.id, 'Marathon', 'Log 100 hours total', '🏃', 'Milestones', false, now())
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error in handle_new_user_signup: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the manual profile creation function
CREATE OR REPLACE FUNCTION create_user_profile_manual(
  p_user_id uuid,
  p_user_email text,
  p_user_token text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role := 'regular';
  v_profile_data json;
BEGIN
  -- Determine role based on email or token
  IF p_user_email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    v_role := 'admin';
  ELSIF p_user_token IS NOT NULL AND p_user_token != '' THEN
    -- Check if token is valid and active
    IF EXISTS (
      SELECT 1 FROM public.user_tokens 
      WHERE token = p_user_token AND is_active = true
    ) THEN
      v_role := 'specialized';
    END IF;
  END IF;
  
  -- Insert into users table
  INSERT INTO public.users (id, email, created_at, updated_at)
  VALUES (p_user_id, p_user_email, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();

  -- Insert into user_profiles table
  INSERT INTO public.user_profiles (id, email, role, token_used, created_at, updated_at)
  VALUES (p_user_id, p_user_email, v_role, p_user_token, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    token_used = EXCLUDED.token_used,
    updated_at = now();

  -- Insert into user_statistics table
  INSERT INTO public.user_statistics (user_id, total_hours, average_daily_hours, max_session_hours, days_since_start, current_streak, updated_at)
  VALUES (p_user_id, 0, 0, 0, 0, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  -- Create default achievements
  INSERT INTO public.achievements (user_id, title, description, icon, category, completed, created_at)
  VALUES 
    (p_user_id, 'Welcome!', 'Successfully created your account', '🎉', 'General', true, now()),
    (p_user_id, 'First Steps', 'Complete your first work entry', '👣', 'Progress', false, now()),
    (p_user_id, 'Dedicated', 'Log 10 hours of work', '💪', 'Progress', false, now()),
    (p_user_id, 'Consistent', 'Maintain a 7-day streak', '🔥', 'Streaks', false, now()),
    (p_user_id, 'Marathon', 'Log 100 hours total', '🏃', 'Milestones', false, now())
  ON CONFLICT DO NOTHING;

  -- Return the created profile
  SELECT json_build_object(
    'id', p_user_id,
    'email', p_user_email,
    'role', v_role,
    'token_used', p_user_token,
    'created_at', now(),
    'updated_at', now()
  ) INTO v_profile_data;
  
  RETURN v_profile_data;
END;
$$;

-- Create trigger for new user signup (drop existing first)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_signup();

-- Insert default tokens for specialized access
INSERT INTO user_tokens (token, description, is_active)
VALUES 
  ('hello_1210', 'Primary specialized access token', true),
  ('SPEC_ACCESS_2025', 'Specialized access token for 2025', true),
  ('ADVANCED_USER_TOKEN', 'Advanced user access token', true),
  ('BETA_TESTER_ACCESS', 'Beta tester specialized access', true)
ON CONFLICT (token) DO UPDATE SET 
  is_active = true,
  description = EXCLUDED.description;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow profile creation during signup" ON user_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Allow authenticated users to update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Service role can manage profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow token validation" ON user_tokens;
DROP POLICY IF EXISTS "Service role full access" ON user_tokens;
DROP POLICY IF EXISTS "Allow user registration during signup" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Service role can manage users" ON users;
DROP POLICY IF EXISTS "Allow public read access to published blog posts" ON blog_posts;
DROP POLICY IF EXISTS "Allow authenticated users to read their own blog posts" ON blog_posts;
DROP POLICY IF EXISTS "Allow authenticated users to create blog posts" ON blog_posts;
DROP POLICY IF EXISTS "Allow authenticated users to update their own blog posts" ON blog_posts;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own blog posts" ON blog_posts;
DROP POLICY IF EXISTS "Service role full access to blog posts" ON blog_posts;
DROP POLICY IF EXISTS "Allow public read access to blog comments" ON blog_comments;
DROP POLICY IF EXISTS "Allow authenticated users to create comments" ON blog_comments;
DROP POLICY IF EXISTS "Allow authenticated users to update their own comments" ON blog_comments;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own comments" ON blog_comments;
DROP POLICY IF EXISTS "Service role full access to blog comments" ON blog_comments;
DROP POLICY IF EXISTS "Allow public read access to projects" ON projects;
DROP POLICY IF EXISTS "Allow authenticated users to create projects" ON projects;
DROP POLICY IF EXISTS "Allow authenticated users to update their own projects" ON projects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their own projects" ON projects;
DROP POLICY IF EXISTS "Service role full access to projects" ON projects;
DROP POLICY IF EXISTS "Allow users to manage own subjects" ON subjects;
DROP POLICY IF EXISTS "Service role can manage subjects" ON subjects;
DROP POLICY IF EXISTS "Allow users to manage own work entries" ON work_entries;
DROP POLICY IF EXISTS "Service role can manage work entries" ON work_entries;
DROP POLICY IF EXISTS "Allow users to manage own achievements" ON achievements;
DROP POLICY IF EXISTS "Allow achievement creation during signup" ON achievements;
DROP POLICY IF EXISTS "Service role can manage achievements" ON achievements;
DROP POLICY IF EXISTS "Allow users to manage own statistics" ON user_statistics;
DROP POLICY IF EXISTS "Allow statistics creation during signup" ON user_statistics;
DROP POLICY IF EXISTS "Service role can manage statistics" ON user_statistics;

-- RLS Policies

-- User Profiles Policies
CREATE POLICY "Allow profile creation during signup"
  ON user_profiles
  FOR INSERT
  TO anon, authenticated, supabase_auth_admin
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Allow authenticated users to update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can manage profiles"
  ON user_profiles
  FOR ALL
  TO service_role, supabase_auth_admin
  USING (true)
  WITH CHECK (true);

-- User Tokens Policies
CREATE POLICY "Allow token validation"
  ON user_tokens
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Service role full access"
  ON user_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users Policies
CREATE POLICY "Allow user registration during signup"
  ON users
  FOR INSERT
  TO anon, authenticated, supabase_auth_admin
  WITH CHECK (true);

CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can manage users"
  ON users
  FOR ALL
  TO service_role, supabase_auth_admin
  USING (true)
  WITH CHECK (true);

-- Blog Posts Policies
CREATE POLICY "Allow public read access to published blog posts"
  ON blog_posts
  FOR SELECT
  TO anon, authenticated
  USING (published = true);

CREATE POLICY "Allow authenticated users to read their own blog posts"
  ON blog_posts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to create blog posts"
  ON blog_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to update their own blog posts"
  ON blog_posts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to delete their own blog posts"
  ON blog_posts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to blog posts"
  ON blog_posts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Blog Comments Policies
CREATE POLICY "Allow public read access to blog comments"
  ON blog_comments
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to create comments"
  ON blog_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to update their own comments"
  ON blog_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to delete their own comments"
  ON blog_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to blog comments"
  ON blog_comments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Projects Policies
CREATE POLICY "Allow public read access to projects"
  ON projects
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to create projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to update their own projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow authenticated users to delete their own projects"
  ON projects
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to projects"
  ON projects
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Subjects Policies
CREATE POLICY "Allow users to manage own subjects"
  ON subjects
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage subjects"
  ON subjects
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Work Entries Policies
CREATE POLICY "Allow users to manage own work entries"
  ON work_entries
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage work entries"
  ON work_entries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Achievements Policies
CREATE POLICY "Allow users to manage own achievements"
  ON achievements
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow achievement creation during signup"
  ON achievements
  FOR INSERT
  TO anon, authenticated, supabase_auth_admin
  WITH CHECK (true);

CREATE POLICY "Service role can manage achievements"
  ON achievements
  FOR ALL
  TO service_role, supabase_auth_admin
  USING (true)
  WITH CHECK (true);

-- User Statistics Policies
CREATE POLICY "Allow users to manage own statistics"
  ON user_statistics
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow statistics creation during signup"
  ON user_statistics
  FOR INSERT
  TO anon, authenticated, supabase_auth_admin
  WITH CHECK (true);

CREATE POLICY "Service role can manage statistics"
  ON user_statistics
  FOR ALL
  TO service_role, supabase_auth_admin
  USING (true)
  WITH CHECK (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role, supabase_auth_admin;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role, supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION create_user_profile_manual(uuid, text, text) TO anon, authenticated, service_role, supabase_auth_admin;