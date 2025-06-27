import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'regular' | 'specialized';
  token_used?: string;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  email: string;
  role: 'admin' | 'regular' | 'specialized';
  isAdmin: boolean;
  isSpecialized: boolean;
  isRegular: boolean;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, token?: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSpecialized: boolean;
  isRegular: boolean;
  hasHoursAccess: boolean;
  canComment: boolean;
  canEditContent: boolean;
  loading: boolean;
  validateToken: (token: string) => Promise<boolean>;
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Get initial session with timeout
    const getInitialSession = async () => {
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session check timeout')), 10000)
        );

        const sessionPromise = supabase.auth.getSession();
        
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as any;
        
        if (mounted) {
          if (session?.user) {
            await loadUserProfile(session.user);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted) {
          if (session?.user) {
            await loadUserProfile(session.user);
          } else {
            setUser(null);
            setUserProfile(null);
          }
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadUserProfile = async (authUser: SupabaseUser) => {
    try {
      // Check if user_profiles table exists and has data
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading user profile:', error);
        // Fall back to basic user info
        createBasicUser(authUser);
        return;
      }

      if (profile) {
        setUserProfile(profile);
        setUser({
          id: profile.id,
          email: profile.email,
          role: profile.role,
          isAdmin: profile.role === 'admin',
          isSpecialized: profile.role === 'specialized',
          isRegular: profile.role === 'regular'
        });
      } else {
        // Create basic user if no profile exists
        createBasicUser(authUser);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      createBasicUser(authUser);
    }
  };

  const createBasicUser = (authUser: SupabaseUser) => {
    // Determine role based on email
    const adminEmails = ['rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com'];
    const role = adminEmails.includes(authUser.email || '') ? 'admin' : 'regular';

    const basicProfile: UserProfile = {
      id: authUser.id,
      email: authUser.email || '',
      role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setUserProfile(basicProfile);
    setUser({
      id: authUser.id,
      email: authUser.email || '',
      role,
      isAdmin: role === 'admin',
      isSpecialized: role === 'specialized',
      isRegular: role === 'regular'
    });
  };

  const validateToken = async (token: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('user_tokens')
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .maybeSingle();

      return !error && !!data;
    } catch (error) {
      console.error('Error validating token:', error);
      return false;
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
      if (token && !(await validateToken(token))) {
        throw new Error('Invalid or expired token');
      }

      const signUpData: any = {
        email,
        password,
      };

      // Add token to metadata if provided
      if (token) {
        signUpData.options = {
          data: {
            token: token
          }
        };
      }

      const { data, error } = await supabase.auth.signUp(signUpData);

      if (error) {
        console.error('Registration error:', error.message);
        return false;
      }

      if (data.user) {
        // Create basic user immediately
        createBasicUser(data.user);
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
      setUserProfile(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Computed permissions
  const isAuthenticated = !!user;
  const isAdmin = user?.role === 'admin';
  const isSpecialized = user?.role === 'specialized';
  const isRegular = user?.role === 'regular';
  const hasHoursAccess = isAdmin || isSpecialized;
  const canComment = isAdmin || isSpecialized;
  const canEditContent = isAdmin;

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      login,
      register,
      logout,
      isAuthenticated,
      isAdmin,
      isSpecialized,
      isRegular,
      hasHoursAccess,
      canComment,
      canEditContent,
      loading,
      validateToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};