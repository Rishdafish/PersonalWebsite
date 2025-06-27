/*
  # Fix RLS policy for subjects table

  1. Security Updates
    - Drop existing RLS policy that uses incorrect uid() function
    - Create new RLS policy using correct auth.uid() function
    - Ensure authenticated users can manage their own subjects

  This migration fixes the "new row violates row-level security policy" error
  by updating the RLS policy to use the correct Supabase auth function.
*/

-- Drop the existing policy that might be using incorrect uid() function
DROP POLICY IF EXISTS "Users can manage own subjects" ON subjects;

-- Create the correct RLS policy using auth.uid()
CREATE POLICY "Users can manage own subjects"
  ON subjects
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);