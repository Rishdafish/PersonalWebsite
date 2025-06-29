/*
  # Add missing RLS policies for blog posts and projects

  1. Blog Posts Policies
    - Allow public read access to published posts
    - Allow authenticated users to manage their own posts
    - Allow service role full access

  2. Projects Policies  
    - Allow public read access to all projects
    - Allow authenticated users to manage their own projects
    - Allow service role full access

  3. Blog Comments Policies
    - Allow public read access to comments
    - Allow authenticated users to manage their own comments
    - Allow service role full access
*/

-- Blog Posts RLS Policies
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

-- Projects RLS Policies
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

-- Blog Comments RLS Policies
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

-- Verify RLS policies were created
DO $$
DECLARE
    blog_policies_count integer;
    projects_policies_count integer;
    comments_policies_count integer;
BEGIN
    -- Count blog post policies
    SELECT COUNT(*) INTO blog_policies_count
    FROM pg_policies 
    WHERE tablename = 'blog_posts';
    
    -- Count project policies
    SELECT COUNT(*) INTO projects_policies_count
    FROM pg_policies 
    WHERE tablename = 'projects';
    
    -- Count comment policies
    SELECT COUNT(*) INTO comments_policies_count
    FROM pg_policies 
    WHERE tablename = 'blog_comments';
    
    RAISE NOTICE 'RLS Policies created - Blog Posts: %, Projects: %, Comments: %', 
        blog_policies_count, projects_policies_count, comments_policies_count;
        
    IF blog_policies_count >= 6 AND projects_policies_count >= 5 AND comments_policies_count >= 5 THEN
        RAISE NOTICE 'All RLS policies successfully created!';
    ELSE
        RAISE WARNING 'Some RLS policies may be missing. Please check the migration.';
    END IF;
END $$;