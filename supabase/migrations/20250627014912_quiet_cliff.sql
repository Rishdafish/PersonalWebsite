/*
  # Hours Tracking System Database Schema

  1. New Tables
    - `user_statistics`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `total_hours` (numeric)
      - `average_daily_hours` (numeric)
      - `max_session_hours` (numeric)
      - `days_since_start` (integer)
      - `current_streak` (integer)
      - `updated_at` (timestamp)

    - `subjects`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `target_hours` (numeric)
      - `current_hours` (numeric)
      - `icon` (text)
      - `completed` (boolean)
      - `created_at` (timestamp)

    - `achievements`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `title` (text)
      - `description` (text)
      - `icon` (text)
      - `category` (text)
      - `completed` (boolean)
      - `completed_at` (timestamp)
      - `created_at` (timestamp)

    - `work_entries`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `subject_id` (uuid, references subjects)
      - `hours` (numeric)
      - `description` (text)
      - `entry_date` (date)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- User Statistics Table
CREATE TABLE IF NOT EXISTS user_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  total_hours numeric DEFAULT 0,
  average_daily_hours numeric DEFAULT 0,
  max_session_hours numeric DEFAULT 0,
  days_since_start integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own statistics"
  ON user_statistics
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Subjects Table
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

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subjects"
  ON subjects
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Achievements Table
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

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own achievements"
  ON achievements
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Work Entries Table
CREATE TABLE IF NOT EXISTS work_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  hours numeric NOT NULL CHECK (hours > 0),
  description text NOT NULL,
  entry_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE work_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own work entries"
  ON work_entries
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Insert default achievements for new users
CREATE OR REPLACE FUNCTION create_default_achievements()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO achievements (user_id, title, description, icon, category, completed)
  VALUES 
    (NEW.id, 'First Steps', 'Log your first hour of work', '🎯', 'Milestones', false),
    (NEW.id, '10 Hour Milestone', 'Complete 10 hours of work', '⏰', 'Milestones', false),
    (NEW.id, '50 Hour Milestone', 'Complete 50 hours of work', '💪', 'Milestones', false),
    (NEW.id, '100 Hour Milestone', 'Complete 100 hours of work', '🏆', 'Milestones', false),
    (NEW.id, 'Marathon Session', 'Work for 8+ hours in a single day', '🏃', 'Dedication', false),
    (NEW.id, 'Week Warrior', 'Work 7 consecutive days', '🔥', 'Consistency', false),
    (NEW.id, 'Subject Master', 'Complete your first subject', '🎓', 'Achievement', false),
    (NEW.id, 'Early Bird', 'Start working before 7 AM', '🌅', 'Dedication', false),
    (NEW.id, 'Night Owl', 'Work past 10 PM', '🦉', 'Dedication', false),
    (NEW.id, 'Consistent Learner', 'Work 30 consecutive days', '📈', 'Consistency', false);
  
  INSERT INTO user_statistics (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default data for new users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'create_user_defaults'
  ) THEN
    CREATE TRIGGER create_user_defaults
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION create_default_achievements();
  END IF;
END $$;