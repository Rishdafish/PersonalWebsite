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
  isSupabaseConfigured: boolean;
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

  // Check if Supabase is properly configured
  const isSupabaseConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

  useEffect(() => {
    let mounted = true;

    // Get initial session with improved error handling
    const getInitialSession = async () => {
      try {
        if (!isSupabaseConfigured) {
          console.warn('Supabase environment variables not configured');
          if (mounted) {
            setLoading(false);
          }
          return;
        }

        // Add timeout to prevent hanging
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Session check timeout')), 10000);
        });

        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]) as any;
        
        if (error) {
          console.error('Error getting session:', error);
          if (mounted) {
            setLoading(false);
          }
          return;
        }
        
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

    // Listen for auth changes only if Supabase is configured
    let subscription: any = null;
    if (isSupabaseConfigured) {
      try {
        const { data } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (mounted) {
              try {
                if (session?.user) {
                  await loadUserProfile(session.user);
                } else {
                  setUser(null);
                  setUserProfile(null);
                }
                setLoading(false);
              } catch (error) {
                console.error('Error in auth state change:', error);
                setLoading(false);
              }
            }
          }
        );
        subscription = data.subscription;
      } catch (error) {
        console.error('Error setting up auth listener:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    }

    return () => {
      mounted = false;
      if (subscription) {
        try {
          subscription.unsubscribe();
        } catch (error) {
          console.error('Error unsubscribing from auth changes:', error);
        }
      }
    };
  }, [isSupabaseConfigured]);

  const loadUserProfile = async (authUser: SupabaseUser) => {
    try {
      if (!isSupabaseConfigured) {
        createBasicUser(authUser);
        return;
      }

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
    if (!isSupabaseConfigured) {
      return false;
    }

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
    if (!isSupabaseConfigured) {
      throw new Error('Authentication service is not configured. Please contact the administrator to set up the database connection.');
    }

    try {
      // Add timeout to prevent hanging
      const loginPromise = supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Login request timeout - please check your connection')), 15000);
      });

      const { data, error } = await Promise.race([loginPromise, timeoutPromise]) as any;

      if (error) {
        console.error('Login error:', error);
        
        // Provide more specific error messages
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        } else if (error.message.includes('Email not confirmed')) {
          throw new Error('Please check your email and confirm your account before logging in.');
        } else if (error.message.includes('Too many requests')) {
          throw new Error('Too many login attempts. Please wait a few minutes before trying again.');
        } else if (error.message.includes('Supabase not configured')) {
          throw new Error('Authentication service is not properly configured. Please contact the administrator.');
        } else {
          throw new Error(`Login failed: ${error.message}`);
        }
      }

      if (!data.user) {
        throw new Error('Login failed - no user data received. Please try again.');
      }

      await loadUserProfile(data.user);
      return true;
    } catch (error: any) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string, token?: string): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      throw new Error('Authentication service is not configured. Please contact the administrator to set up the database connection.');
    }

    try {
      // Validate token if provided
      if (token) {
        const isValidToken = await validateToken(token);
        if (!isValidToken) {
          throw new Error('Invalid or expired access token. Please check the token and try again.');
        }
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

      // Add timeout to prevent hanging
      const registerPromise = supabase.auth.signUp(signUpData);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Registration request timeout - please check your connection')), 15000);
      });

      const { data, error } = await Promise.race([registerPromise, timeoutPromise]) as any;

      if (error) {
        console.error('Registration error:', error);
        
        // Provide more specific error messages
        if (error.message.includes('User already registered')) {
          throw new Error('An account with this email already exists. Please try logging in instead.');
        } else if (error.message.includes('Password should be at least')) {
          throw new Error('Password must be at least 6 characters long.');
        } else if (error.message.includes('Invalid email')) {
          throw new Error('Please enter a valid email address.');
        } else if (error.message.includes('Supabase not configured')) {
          throw new Error('Authentication service is not properly configured. Please contact the administrator.');
        } else {
          throw new Error(`Registration failed: ${error.message}`);
        }
      }

      if (!data.user) {
        throw new Error('Registration failed - no user data received. Please try again.');
      }

      // Create basic user immediately
      createBasicUser(data.user);
      return true;
    } catch (error: any) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
      setUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if logout fails
      setUser(null);
      setUserProfile(null);
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
      validateToken,
      isSupabaseConfigured
    }}>
      {children}
    </AuthContext.Provider>
  );
};