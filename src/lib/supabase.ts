import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔧 Supabase Configuration Check:');
console.log('URL:', supabaseUrl ? '✅ Present' : '❌ Missing');
console.log('Anon Key:', supabaseAnonKey ? '✅ Present' : '❌ Missing');
console.log('Full URL:', supabaseUrl);
console.log('Key length:', supabaseAnonKey?.length || 0);

// Validate URL format
if (!supabaseUrl || !supabaseUrl.startsWith('https://')) {
  console.error('❌ Invalid or missing Supabase URL');
  throw new Error('Missing or invalid VITE_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey || supabaseAnonKey.length < 20) {
  console.error('❌ Invalid or missing Supabase anon key');
  throw new Error('Missing or invalid VITE_SUPABASE_ANON_KEY environment variable');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

console.log('✅ Supabase client initialized with URL:', supabaseUrl);

// Test connection
supabase.from('user_tokens').select('count').limit(1)
  .then(({ data, error }) => {
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is fine
      console.error('❌ Supabase connection test failed:', error);
    } else {
      console.log('✅ Supabase connection test successful');
    }
  })
  .catch((error) => {
    console.error('❌ Supabase connection test error:', error);
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

// API functions for blog posts
export const blogAPI = {
  async getAll(userId?: string) {
    try {
      let query = supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (userId) {
        query = query.eq('user_id', userId);
      } else {
        query = query.eq('published', true);
      }
      
      const { data, error } = await query;
      if (error) {
        console.error('❌ Error fetching blog posts:', error);
        throw error;
      }
      return data;
    } catch (error) {
      console.error('❌ Blog API getAll error:', error);
      throw error;
    }
  },

  async create(post: Omit<BlogPost, 'id' | 'created_at' | 'updated_at'>) {
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .insert([post])
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error creating blog post:', error);
        throw error;
      }
      return data;
    } catch (error) {
      console.error('❌ Blog API create error:', error);
      throw error;
    }
  },

  async update(id: string, updates: Partial<BlogPost>) {
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error updating blog post:', error);
        throw error;
      }
      return data;
    } catch (error) {
      console.error('❌ Blog API update error:', error);
      throw error;
    }
  },

  async delete(id: string) {
    try {
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('❌ Error deleting blog post:', error);
        throw error;
      }
    } catch (error) {
      console.error('❌ Blog API delete error:', error);
      throw error;
    }
  }
};

// API functions for projects
export const projectsAPI = {
  async getAll(userId?: string) {
    try {
      let query = supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      const { data, error } = await query;
      if (error) {
        console.error('❌ Error fetching projects:', error);
        throw error;
      }
      return data;
    } catch (error) {
      console.error('❌ Projects API getAll error:', error);
      throw error;
    }
  },

  async create(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([project])
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error creating project:', error);
        throw error;
      }
      return data;
    } catch (error) {
      console.error('❌ Projects API create error:', error);
      throw error;
    }
  },

  async update(id: string, updates: Partial<Project>) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error updating project:', error);
        throw error;
      }
      return data;
    } catch (error) {
      console.error('❌ Projects API update error:', error);
      throw error;
    }
  },

  async delete(id: string) {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('❌ Error deleting project:', error);
        throw error;
      }
    } catch (error) {
      console.error('❌ Projects API delete error:', error);
      throw error;
    }
  }
};

// API functions for work entries with annual data
export const workEntriesAPI = {
  async getAnnualData(userId: string, year?: number) {
    try {
      const targetYear = year || new Date().getFullYear();
      const startDate = `${targetYear}-01-01`;
      const endDate = `${targetYear}-12-31`;
      
      const { data, error } = await supabase
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
        .order('entry_date', { ascending: true });
      
      if (error) {
        console.error('❌ Error fetching annual work data:', error);
        throw error;
      }
      return data;
    } catch (error) {
      console.error('❌ Work entries API getAnnualData error:', error);
      throw error;
    }
  },

  async getDailyTotals(userId: string, year?: number) {
    try {
      const targetYear = year || new Date().getFullYear();
      const startDate = `${targetYear}-01-01`;
      const endDate = `${targetYear}-12-31`;
      
      const { data, error } = await supabase
        .from('work_entries')
        .select('entry_date, hours')
        .eq('user_id', userId)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate);
      
      if (error) {
        console.error('❌ Error fetching daily totals:', error);
        throw error;
      }
      
      // Group by date and sum hours
      const dailyTotals = data.reduce((acc, entry) => {
        const date = entry.entry_date;
        acc[date] = (acc[date] || 0) + entry.hours;
        return acc;
      }, {} as Record<string, number>);
      
      return dailyTotals;
    } catch (error) {
      console.error('❌ Work entries API getDailyTotals error:', error);
      throw error;
    }
  }
};