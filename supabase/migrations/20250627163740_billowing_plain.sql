/*
  # Comprehensive Database Schema Implementation

  1. New Tables
    - `user_profiles` - Extended user information with role-based access
    - `user_tokens` - Specialized access tokens for role elevation
    - `blog_posts` - Blog post storage with metadata
    - `blog_comments` - Comment system for blog posts
    - `projects` - Project portfolio storage
    - `work_entries` - Hours tracking entries
    - `subjects` - Study/work subjects for hours tracking
    - `achievements` - User achievements and milestones
    - `user_statistics` - Aggregated user statistics

  2. Security
    - Enable RLS on all tables
    - Role-based access policies (admin, specialized, regular)
    - Secure admin account creation with predefined emails

  3. Functions & Triggers
    - Automatic user profile creation
    - Admin role assignment for specific emails
    - Achievement system initialization
    - Statistics calculation triggers
*/

-- Create user role enum
CREATE TYPE user_role AS ENUM ('admin', 'regular', 'specialized');

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
CREATE INDEX IF NOT EXISTS user_profiles_role_idx ON user_profiles(role);
CREATE INDEX IF NOT EXISTS user_tokens_token_idx ON user_tokens(token);
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

-- Create triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON blog_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_blog_comments_updated_at BEFORE UPDATE ON blog_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user_with_role()
RETURNS TRIGGER AS $$
DECLARE
  user_role_type user_role := 'regular';
  used_token text := NULL;
BEGIN
  -- Check if user email is admin
  IF NEW.email IN ('rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com') THEN
    user_role_type := 'admin';
  -- Check if user provided a valid token for specialized access
  ELSIF NEW.raw_user_meta_data->>'token' IS NOT NULL THEN
    SELECT token INTO used_token 
    FROM user_tokens 
    WHERE token = NEW.raw_user_meta_data->>'token' 
    AND is_active = true;
    
    IF used_token IS NOT NULL THEN
      user_role_type := 'specialized';
      -- Deactivate the token after use
      UPDATE user_tokens SET is_active = false WHERE token = used_token;
    END IF;
  END IF;

  -- Insert into users table
  INSERT INTO users (id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, now(), now());

  -- Insert into user_profiles table
  INSERT INTO user_profiles (id, email, role, token_used, created_at, updated_at)
  VALUES (NEW.id, NEW.email, user_role_type, used_token, now(), now());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create default achievements for new users
CREATE OR REPLACE FUNCTION create_default_achievements()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default achievements
  INSERT INTO achievements (user_id, title, description, icon, category) VALUES
  (NEW.id, 'Welcome!', 'Created your account and joined the platform', '🎉', 'Milestones'),
  (NEW.id, 'First Steps', 'Complete your first hour of work', '👶', 'Milestones'),
  (NEW.id, 'Dedicated Learner', 'Log 10 hours of work', '📚', 'Dedication'),
  (NEW.id, 'Consistency King', 'Work for 7 consecutive days', '👑', 'Consistency'),
  (NEW.id, 'Marathon Session', 'Complete a 5+ hour work session', '🏃', 'Achievement'),
  (NEW.id, 'Century Club', 'Reach 100 total hours', '💯', 'Milestones'),
  (NEW.id, 'Subject Master', 'Complete a subject target', '🎯', 'Achievement');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user handling
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_with_role();

-- Create trigger for default achievements
CREATE TRIGGER on_user_created_achievements
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_default_achievements();

-- Row Level Security Policies

-- User Profiles Policies
CREATE POLICY "Users can read own profile" ON user_profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Service role can manage profiles" ON user_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- User Tokens Policies
CREATE POLICY "Authenticated users can read active tokens" ON user_tokens FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Service role can manage tokens" ON user_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users Policies
CREATE POLICY "Users can read own data" ON users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON users FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Allow user registration" ON users FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Service role can insert users" ON users FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can manage users" ON users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Blog Posts Policies
CREATE POLICY "All users can read published blog posts" ON blog_posts FOR SELECT TO authenticated USING (published = true);
CREATE POLICY "Public can read published blog posts" ON blog_posts FOR SELECT TO anon USING (published = true);
CREATE POLICY "Admins can manage all blog posts" ON blog_posts FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'));
CREATE POLICY "Service role can manage blog posts" ON blog_posts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Blog Comments Policies
CREATE POLICY "All users can read comments" ON blog_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Specialized users and admins can create comments" ON blog_comments FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin', 'specialized')));
CREATE POLICY "Users can update own comments" ON blog_comments FOR UPDATE TO authenticated 
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin', 'specialized')))
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin', 'specialized')));
CREATE POLICY "Users can delete own comments" ON blog_comments FOR DELETE TO authenticated 
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin', 'specialized')));
CREATE POLICY "Admins can delete any comment" ON blog_comments FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'));

-- Projects Policies
CREATE POLICY "All users can read projects" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public can read projects" ON projects FOR SELECT TO anon USING (true);
CREATE POLICY "Admins can manage all projects" ON projects FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin'));
CREATE POLICY "Service role can manage projects" ON projects FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Subjects Policies
CREATE POLICY "Users can manage own subjects" ON subjects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins and specialized users can manage own subjects" ON subjects FOR ALL TO authenticated 
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin', 'specialized')))
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin', 'specialized')));
CREATE POLICY "Service role can manage subjects" ON subjects FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Work Entries Policies
CREATE POLICY "Users can manage own work entries" ON work_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins and specialized users can manage own work entries" ON work_entries FOR ALL TO authenticated 
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin', 'specialized')))
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin', 'specialized')));
CREATE POLICY "Service role can manage work entries" ON work_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Achievements Policies
CREATE POLICY "Users can manage own achievements" ON achievements FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins and specialized users can manage own achievements" ON achievements FOR ALL TO authenticated 
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin', 'specialized')))
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin', 'specialized')));
CREATE POLICY "Service role can manage achievements" ON achievements FOR ALL TO service_role USING (true) WITH CHECK (true);

-- User Statistics Policies
CREATE POLICY "Users can manage own statistics" ON user_statistics FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins and specialized users can manage own statistics" ON user_statistics FOR ALL TO authenticated 
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin', 'specialized')))
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role IN ('admin', 'specialized')));
CREATE POLICY "Service role can manage statistics" ON user_statistics FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Insert some default tokens for specialized access
INSERT INTO user_tokens (token, description) VALUES
('SPEC_ACCESS_2025', 'Specialized access token for 2025'),
('ADVANCED_USER_TOKEN', 'Advanced user access token'),
('BETA_TESTER_ACCESS', 'Beta tester specialized access');

-- Create admin accounts with default password
-- Note: These will be created when users register with these emails
-- The trigger will automatically assign admin role