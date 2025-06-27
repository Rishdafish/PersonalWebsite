import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

// Clear any invalid session on initialization
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED' && !session) {
    // If token refresh failed, clear the session
    supabase.auth.signOut();
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