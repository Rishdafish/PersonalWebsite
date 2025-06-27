/*
  # Fix Row Level Security Policies

  This migration fixes the RLS policies that are preventing user registration and profile creation.
  
  ## Changes Made
  
  1. **User Profiles Table**
     - Allow authenticated users to insert their own profile during registration
     - Allow authenticated users to read and update their own profile
     - Keep admin policies for management
  
  2. **Blog Posts Table** 
     - Allow authenticated users to create blog posts (not just admins)
     - Keep existing read policies for published posts
     - Keep admin management policies
  
  3. **Other Tables**
     - Update policies to work with the new user profile creation flow
     - Ensure users can access their own data after profile creation

  ## Security Notes
  - Users can only access their own data
  - Admin privileges are preserved
  - Public read access maintained where appropriate
*/

-- Drop existing problematic policies for user_profiles
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Create new policies for user_profiles that allow proper registration flow
CREATE POLICY "Allow authenticated users to read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Allow authenticated users to create own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow authenticated users to update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Update blog_posts policies to allow authenticated users to create posts
DROP POLICY IF EXISTS "Admins can manage all blog posts" ON blog_posts;

-- Allow authenticated users to create blog posts
CREATE POLICY "Allow authenticated users to create blog posts"
  ON blog_posts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to manage their own blog posts
CREATE POLICY "Allow users to manage own blog posts"
  ON blog_posts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Keep admin policy for managing all blog posts
CREATE POLICY "Admins can manage all blog posts"
  ON blog_posts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'admin'
    )
  );

-- Update subjects policies to work without requiring existing profile
DROP POLICY IF EXISTS "Users can manage own subjects" ON subjects;
DROP POLICY IF EXISTS "Admins and specialized users can manage own subjects" ON subjects;

CREATE POLICY "Allow users to manage own subjects"
  ON subjects
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Update work_entries policies
DROP POLICY IF EXISTS "Users can manage own work entries" ON work_entries;
DROP POLICY IF EXISTS "Admins and specialized users can manage own work entries" ON work_entries;

CREATE POLICY "Allow users to manage own work entries"
  ON work_entries
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Update user_statistics policies
DROP POLICY IF EXISTS "Users can manage own statistics" ON user_statistics;
DROP POLICY IF EXISTS "Admins and specialized users can manage own statistics" ON user_statistics;

CREATE POLICY "Allow users to manage own statistics"
  ON user_statistics
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Update achievements policies
DROP POLICY IF EXISTS "Users can manage own achievements" ON achievements;
DROP POLICY IF EXISTS "Admins and specialized users can manage own achievements" ON achievements;

CREATE POLICY "Allow users to manage own achievements"
  ON achievements
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Update blog_comments policies to be more permissive for basic functionality
DROP POLICY IF EXISTS "Specialized users and admins can create comments" ON blog_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON blog_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON blog_comments;

CREATE POLICY "Allow authenticated users to create comments"
  ON blog_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to manage own comments"
  ON blog_comments
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);