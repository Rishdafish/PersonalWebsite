import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Console-only debugging function
const debugLog = (message: string, data?: any, isError = false) => {
  const timestamp = new Date().toISOString();
  const prefix = isError ? '❌ [SUPABASE ERROR]' : '🔧 [SUPABASE DEBUG]';
  
  if (data !== undefined) {
    console.log(`${prefix} ${timestamp}: ${message}`, data);
  } else {
    console.log(`${prefix} ${timestamp}: ${message}`);
  }
};

debugLog('🚀 Initializing Supabase client...');
debugLog('Environment check:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlLength: supabaseUrl?.length || 0,
  keyLength: supabaseAnonKey?.length || 0,
  nodeEnv: import.meta.env.MODE,
  // Show actual values for debugging (remove in production)
  actualUrl: supabaseUrl,
  actualKey: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING'
});

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = 'Missing Supabase environment variables';
  debugLog(errorMsg, {
    VITE_SUPABASE_URL: supabaseUrl ? 'Present' : 'Missing',
    VITE_SUPABASE_ANON_KEY: supabaseAnonKey ? 'Present' : 'Missing',
    allEnvVars: Object.keys(import.meta.env).filter(key => key.startsWith('VITE_'))
  }, true);
  
  throw new Error(errorMsg);
}

// Validate URL format
if (!supabaseUrl.includes('supabase.co')) {
  const errorMsg = 'Invalid Supabase URL format';
  debugLog(errorMsg, { url: supabaseUrl }, true);
  throw new Error(errorMsg);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

debugLog('✅ Supabase client created successfully');

// Enhanced connection test with shorter timeout for faster feedback
const testConnection = async () => {
  debugLog('🔍 Starting connection test...');
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Connection test timeout after 5 seconds'));
    }, 5000);
  });
  
  const connectionPromise = supabase.from('user_tokens').select('count').limit(1);
  
  try {
    const result = await Promise.race([connectionPromise, timeoutPromise]);
    const { data, error } = result as any;
    
    if (error && error.code !== 'PGRST116') {
      debugLog('Connection test failed', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        status: error.status
      }, true);
    } else {
      debugLog('✅ Connection test successful');
    }
  } catch (error: any) {
    debugLog('Connection test exception', {
      message: error.message,
      stack: error.stack
    }, true);
  }
};

// Run connection test
testConnection();

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

// Enhanced API functions with debugging
export const blogAPI = {
  async getAll(userId?: string) {
    try {
      debugLog('📖 Fetching blog posts', { userId, hasUserId: !!userId });
      
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
        debugLog('Blog API getAll error', error, true);
        throw error;
      }
      
      debugLog('✅ Blog posts fetched successfully', { count: data?.length || 0 });
      return data;
    } catch (error) {
      debugLog('Blog API getAll exception', error, true);
      throw error;
    }
  },

  async create(post: Omit<BlogPost, 'id' | 'created_at' | 'updated_at'>) {
    try {
      debugLog('📝 Creating blog post', { title: post.title });
      
      const { data, error } = await supabase
        .from('blog_posts')
        .insert([post])
        .select()
        .single();
      
      if (error) {
        debugLog('Blog API create error', error, true);
        throw error;
      }
      
      debugLog('✅ Blog post created successfully', { id: data.id });
      return data;
    } catch (error) {
      debugLog('Blog API create exception', error, true);
      throw error;
    }
  },

  async update(id: string, updates: Partial<BlogPost>) {
    try {
      debugLog('✏️ Updating blog post', { id, updates });
      
      const { data, error } = await supabase
        .from('blog_posts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        debugLog('Blog API update error', error, true);
        throw error;
      }
      
      debugLog('✅ Blog post updated successfully', { id: data.id });
      return data;
    } catch (error) {
      debugLog('Blog API update exception', error, true);
      throw error;
    }
  },

  async delete(id: string) {
    try {
      debugLog('🗑️ Deleting blog post', { id });
      
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', id);
      
      if (error) {
        debugLog('Blog API delete error', error, true);
        throw error;
      }
      
      debugLog('✅ Blog post deleted successfully', { id });
    } catch (error) {
      debugLog('Blog API delete exception', error, true);
      throw error;
    }
  }
};

// API functions for projects
export const projectsAPI = {
  async getAll(userId?: string) {
    try {
      debugLog('🚀 Fetching projects', { userId, hasUserId: !!userId });
      
      let query = supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        debugLog('Projects API getAll error', error, true);
        throw error;
      }
      
      debugLog('✅ Projects fetched successfully', { count: data?.length || 0 });
      return data;
    } catch (error) {
      debugLog('Projects API getAll exception', error, true);
      throw error;
    }
  },

  async create(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) {
    try {
      debugLog('🛠️ Creating project', { title: project.title });
      
      const { data, error } = await supabase
        .from('projects')
        .insert([project])
        .select()
        .single();
      
      if (error) {
        debugLog('Projects API create error', error, true);
        throw error;
      }
      
      debugLog('✅ Project created successfully', { id: data.id });
      return data;
    } catch (error) {
      debugLog('Projects API create exception', error, true);
      throw error;
    }
  },

  async update(id: string, updates: Partial<Project>) {
    try {
      debugLog('🔧 Updating project', { id, updates });
      
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        debugLog('Projects API update error', error, true);
        throw error;
      }
      
      debugLog('✅ Project updated successfully', { id: data.id });
      return data;
    } catch (error) {
      debugLog('Projects API update exception', error, true);
      throw error;
    }
  },

  async delete(id: string) {
    try {
      debugLog('🗑️ Deleting project', { id });
      
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);
      
      if (error) {
        debugLog('Projects API delete error', error, true);
        throw error;
      }
      
      debugLog('✅ Project deleted successfully', { id });
    } catch (error) {
      debugLog('Projects API delete exception', error, true);
      throw error;
    }
  }
};

// API functions for work entries with annual data
export const workEntriesAPI = {
  async getAnnualData(userId: string, year?: number) {
    try {
      const targetYear = year || new Date().getFullYear();
      debugLog('📊 Fetching annual work data', { userId, targetYear });
      
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
        debugLog('Work entries API getAnnualData error', error, true);
        throw error;
      }
      
      debugLog('✅ Annual work data fetched successfully', { count: data?.length || 0 });
      return data;
    } catch (error) {
      debugLog('Work entries API getAnnualData exception', error, true);
      throw error;
    }
  },

  async getDailyTotals(userId: string, year?: number) {
    try {
      const targetYear = year || new Date().getFullYear();
      debugLog('📈 Fetching daily totals', { userId, targetYear });
      
      const startDate = `${targetYear}-01-01`;
      const endDate = `${targetYear}-12-31`;
      
      const { data, error } = await supabase
        .from('work_entries')
        .select('entry_date, hours')
        .eq('user_id', userId)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate);
      
      if (error) {
        debugLog('Work entries API getDailyTotals error', error, true);
        throw error;
      }
      
      // Group by date and sum hours
      const dailyTotals = data.reduce((acc, entry) => {
        const date = entry.entry_date;
        acc[date] = (acc[date] || 0) + entry.hours;
        return acc;
      }, {} as Record<string, number>);
      
      debugLog('✅ Daily totals calculated successfully', { 
        entryCount: data?.length || 0,
        uniqueDays: Object.keys(dailyTotals).length 
      });
      
      return dailyTotals;
    } catch (error) {
      debugLog('Work entries API getDailyTotals exception', error, true);
      throw error;
    }
  }
};