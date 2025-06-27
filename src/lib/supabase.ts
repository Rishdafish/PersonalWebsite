import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Create Supabase client with optimized settings for better reliability
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'x-client-info': 'supabase-js-web'
    }
  },
  // Add retry configuration
  db: {
    schema: 'public'
  }
});

// Database types
export interface UserStatistics {
  id: string;
  user_id: string;
  total_hours: number;
  average_daily_hours: number;
  max_session_hours: number;
  days_since_start: number;
  current_streak: number;
  updated_at: string;
}

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  target_hours: number;
  current_hours: number;
  icon: string;
  completed: boolean;
  created_at: string;
}

export interface Achievement {
  id: string;
  user_id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  completed: boolean;
  completed_at?: string;
  created_at: string;
}

export interface WorkEntry {
  id: string;
  user_id: string;
  subject_id: string;
  hours: number;
  description: string;
  entry_date: string;
  created_at: string;
  subjects?: Subject;
}

export interface BlogPost {
  id: string;
  user_id: string;
  title: string;
  content: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string;
  technologies: string[];
  status: string;
  github_url?: string;
  live_demo_url?: string;
  start_date: string;
  created_at: string;
  updated_at: string;
}

// Helper function with shorter timeout and better error handling
const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number = 15000,
  errorMessage: string = 'Request timed out'
): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
};

// Retry wrapper for database operations
const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 2,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error.message.includes('Invalid API key') || 
          error.message.includes('JWT') ||
          error.message.includes('credentials') ||
          attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
      }
    }
  }
  
  throw lastError!;
};

// API functions for blog posts with improved error handling
export const blogAPI = {
  async getAll(userId?: string) {
    try {
      return await withRetry(async () => {
        let query = supabase
          .from('blog_posts')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (userId) {
          query = query.eq('user_id', userId);
        } else {
          query = query.eq('published', true);
        }
        
        const { data, error } = await withTimeout(
          query,
          15000,
          'Failed to load blog posts - request timed out'
        );
        
        if (error) throw error;
        return data || [];
      });
    } catch (error: any) {
      console.error('Error in blogAPI.getAll:', error);
      if (error.message.includes('timeout')) {
        throw new Error('Connection timeout. Please check if your Supabase project is active.');
      }
      return [];
    }
  },

  async create(post: Omit<BlogPost, 'id' | 'created_at' | 'updated_at'>) {
    try {
      return await withRetry(async () => {
        const { data, error } = await withTimeout(
          supabase
            .from('blog_posts')
            .insert([post])
            .select()
            .single(),
          15000,
          'Failed to create blog post - request timed out'
        );
        
        if (error) throw error;
        return data;
      });
    } catch (error: any) {
      console.error('Error in blogAPI.create:', error);
      if (error.message.includes('timeout')) {
        throw new Error('Connection timeout. Please check if your Supabase project is active.');
      }
      throw error;
    }
  },

  async update(id: string, updates: Partial<BlogPost>) {
    try {
      return await withRetry(async () => {
        const { data, error } = await withTimeout(
          supabase
            .from('blog_posts')
            .update(updates)
            .eq('id', id)
            .select()
            .maybeSingle(),
          15000,
          'Failed to update blog post - request timed out'
        );
        
        if (error) throw error;
        return data;
      });
    } catch (error: any) {
      console.error('Error in blogAPI.update:', error);
      if (error.message.includes('timeout')) {
        throw new Error('Connection timeout. Please check if your Supabase project is active.');
      }
      throw error;
    }
  },

  async delete(id: string) {
    try {
      return await withRetry(async () => {
        const { error } = await withTimeout(
          supabase
            .from('blog_posts')
            .delete()
            .eq('id', id),
          15000,
          'Failed to delete blog post - request timed out'
        );
        
        if (error) throw error;
      });
    } catch (error: any) {
      console.error('Error in blogAPI.delete:', error);
      if (error.message.includes('timeout')) {
        throw new Error('Connection timeout. Please check if your Supabase project is active.');
      }
      throw error;
    }
  }
};

// API functions for projects with improved error handling
export const projectsAPI = {
  async getAll(userId?: string) {
    try {
      return await withRetry(async () => {
        let query = supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (userId) {
          query = query.eq('user_id', userId);
        }
        
        const { data, error } = await withTimeout(
          query,
          15000,
          'Failed to load projects - request timed out'
        );
        
        if (error) throw error;
        return data || [];
      });
    } catch (error: any) {
      console.error('Error in projectsAPI.getAll:', error);
      if (error.message.includes('timeout')) {
        throw new Error('Connection timeout. Please check if your Supabase project is active.');
      }
      return [];
    }
  },

  async create(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) {
    try {
      return await withRetry(async () => {
        const { data, error } = await withTimeout(
          supabase
            .from('projects')
            .insert([project])
            .select()
            .single(),
          15000,
          'Failed to create project - request timed out'
        );
        
        if (error) throw error;
        return data;
      });
    } catch (error: any) {
      console.error('Error in projectsAPI.create:', error);
      if (error.message.includes('timeout')) {
        throw new Error('Connection timeout. Please check if your Supabase project is active.');
      }
      throw error;
    }
  },

  async update(id: string, updates: Partial<Project>) {
    try {
      return await withRetry(async () => {
        const { data, error } = await withTimeout(
          supabase
            .from('projects')
            .update(updates)
            .eq('id', id)
            .select()
            .maybeSingle(),
          15000,
          'Failed to update project - request timed out'
        );
        
        if (error) throw error;
        return data;
      });
    } catch (error: any) {
      console.error('Error in projectsAPI.update:', error);
      if (error.message.includes('timeout')) {
        throw new Error('Connection timeout. Please check if your Supabase project is active.');
      }
      throw error;
    }
  },

  async delete(id: string) {
    try {
      return await withRetry(async () => {
        const { error } = await withTimeout(
          supabase
            .from('projects')
            .delete()
            .eq('id', id),
          15000,
          'Failed to delete project - request timed out'
        );
        
        if (error) throw error;
      });
    } catch (error: any) {
      console.error('Error in projectsAPI.delete:', error);
      if (error.message.includes('timeout')) {
        throw new Error('Connection timeout. Please check if your Supabase project is active.');
      }
      throw error;
    }
  }
};

// API functions for work entries with annual data and improved error handling
export const workEntriesAPI = {
  async getAnnualData(userId: string, year?: number) {
    try {
      return await withRetry(async () => {
        const targetYear = year || new Date().getFullYear();
        const startDate = `${targetYear}-01-01`;
        const endDate = `${targetYear}-12-31`;
        
        const { data, error } = await withTimeout(
          supabase
            .from('work_entries')
            .select(`
              *,
              subjects (
                id,
                name,
                icon
              )
            `)
            .eq('user_id', userId)
            .gte('entry_date', startDate)
            .lte('entry_date', endDate)
            .order('entry_date', { ascending: true }),
          15000,
          'Failed to load annual data - request timed out'
        );
        
        if (error) throw error;
        return data || [];
      });
    } catch (error: any) {
      console.error('Error in workEntriesAPI.getAnnualData:', error);
      if (error.message.includes('timeout')) {
        console.warn('Annual data loading timeout, returning empty array');
      }
      return [];
    }
  },

  async getDailyTotals(userId: string, year?: number) {
    try {
      return await withRetry(async () => {
        const targetYear = year || new Date().getFullYear();
        const startDate = `${targetYear}-01-01`;
        const endDate = `${targetYear}-12-31`;
        
        const { data, error } = await withTimeout(
          supabase
            .from('work_entries')
            .select('entry_date, hours')
            .eq('user_id', userId)
            .gte('entry_date', startDate)
            .lte('entry_date', endDate),
          15000,
          'Failed to load daily totals - request timed out'
        );
        
        if (error) throw error;
        
        // Group by date and sum hours
        const dailyTotals = (data || []).reduce((acc, entry) => {
          const date = entry.entry_date;
          acc[date] = (acc[date] || 0) + entry.hours;
          return acc;
        }, {} as Record<string, number>);
        
        return dailyTotals;
      });
    } catch (error: any) {
      console.error('Error in workEntriesAPI.getDailyTotals:', error);
      if (error.message.includes('timeout')) {
        console.warn('Daily totals loading timeout, returning empty object');
      }
      return {};
    }
  }
};