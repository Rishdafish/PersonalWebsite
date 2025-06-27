import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'regular' | 'specialized';

interface User {
  id: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, token?: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSpecialized: boolean;
  canAccessHours: boolean;
  canComment: boolean;
  canEditContent: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await loadUserProfile(session.user);
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          await loadUserProfile(session.user);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (authUser: SupabaseUser) => {
    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading user profile:', error);
        // Set user with default role if profile loading fails
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          role: 'regular' as UserRole
        });
        return;
      }

      // If no profile found, use default role
      const userRole = profile?.role || 'regular';

      setUser({
        id: authUser.id,
        email: authUser.email || '',
        role: userRole as UserRole
      });
    } catch (error) {
      console.error('Error loading user profile:', error);
      // Set user with default role if any error occurs
      setUser({
        id: authUser.id,
        email: authUser.email || '',
        role: 'regular' as UserRole
      });
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error.message);
        return false;
      }

      if (data.user) {
        await loadUserProfile(data.user);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const register = async (email: string, password: string, token?: string): Promise<boolean> => {
    try {
      // Validate token if provided
      if (token) {
        const { data: tokenData, error: tokenError } = await supabase
          .from('user_tokens')
          .select('token')
          .eq('token', token)
          .eq('is_active', true)
          .single();

        if (tokenError || !tokenData) {
          console.error('Invalid token provided');
          return false;
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: token ? { token } : {}
        }
      });

      if (error) {
        console.error('Registration error:', error.message);
        return false;
      }

      if (data.user) {
        // User profile will be created automatically by the trigger
        // Load the profile after a short delay to ensure trigger has executed
        setTimeout(async () => {
          await loadUserProfile(data.user!);
        }, 1000);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Registration error:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Role-based access control helpers
  const isAdmin = user?.role === 'admin';
  const isSpecialized = user?.role === 'specialized';
  const canAccessHours = isAdmin || isSpecialized;
  const canComment = isAdmin || isSpecialized;
  const canEditContent = isAdmin;

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      logout,
      isAuthenticated: !!user,
      isAdmin,
      isSpecialized,
      canAccessHours,
      canComment,
      canEditContent,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
};