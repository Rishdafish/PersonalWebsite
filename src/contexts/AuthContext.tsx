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
  connectionError: string | null;
  retryConnection: () => Promise<void>;
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

// Reduced timeout for faster feedback and retry logic
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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Check if Supabase is properly configured
  const isSupabaseConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

  // Simple connection test with better error detection
  const testSupabaseConnection = async (): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      setConnectionError('Supabase environment variables are not configured. Please check your .env file.');
      return false;
    }

    try {
      // Use a simple health check with shorter timeout
      const { error } = await withTimeout(
        supabase.auth.getSession(),
        10000,
        'Connection timeout'
      );

      if (error) {
        if (error.message.includes('Invalid API key') || error.message.includes('JWT')) {
          setConnectionError('Invalid Supabase configuration. Please verify your environment variables.');
          return false;
        }
        
        if (error.message.includes('fetch')) {
          setConnectionError('Network error. Your Supabase project may be paused or unreachable.');
          return false;
        }
      }

      setConnectionError(null);
      setRetryCount(0);
      return true;
    } catch (error: any) {
      console.error('Supabase connection test error:', error);
      
      if (error.message.includes('timeout')) {
        setConnectionError('Connection timeout. Your Supabase project may be paused due to inactivity. Please check your Supabase dashboard.');
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        setConnectionError('Network error. Please check your internet connection or verify your Supabase project is active.');
      } else {
        setConnectionError('Unable to connect to the database. Please try again or check your Supabase project status.');
      }
      return false;
    }
  };

  // Retry connection function
  const retryConnection = async (): Promise<void> => {
    setLoading(true);
    setRetryCount(prev => prev + 1);
    
    const connectionOk = await testSupabaseConnection();
    if (connectionOk) {
      // Try to get session again
      try {
        const { data: { session }, error } = await withTimeout(
          supabase.auth.getSession(),
          15000,
          'Session check timeout'
        );
        
        if (!error && session?.user) {
          await loadUserProfile(session.user);
        }
      } catch (error) {
        console.error('Error getting session after retry:', error);
      }
    }
    
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;

    // Get initial session with better error handling
    const getInitialSession = async () => {
      try {
        if (!isSupabaseConfigured) {
          console.warn('Supabase environment variables not configured');
          setConnectionError('Authentication service is not configured. Please check your environment variables.');
          if (mounted) {
            setLoading(false);
          }
          return;
        }

        // Test connection first with shorter timeout
        const connectionOk = await testSupabaseConnection();
        if (!connectionOk) {
          if (mounted) {
            setLoading(false);
          }
          return;
        }

        // Get session with shorter timeout
        const { data: { session }, error } = await withTimeout(
          supabase.auth.getSession(),
          15000,
          'Session check timeout'
        );
        
        if (error) {
          console.error('Error getting session:', error);
          setConnectionError('Failed to retrieve session. Please try refreshing the page.');
          if (mounted) {
            setLoading(false);
          }
          return;
        }
        
        if (mounted) {
          if (session?.user) {
            await loadUserProfile(session.user);
          }
          setConnectionError(null);
          setLoading(false);
        }
      } catch (error: any) {
        console.error('Error getting initial session:', error);
        if (error.message.includes('timeout')) {
          setConnectionError('Connection timeout. Your Supabase project may be paused. Please check your dashboard and try again.');
        } else {
          setConnectionError('Failed to initialize authentication. Please refresh the page.');
        }
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
                setConnectionError(null);
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
        setConnectionError('Failed to set up authentication listener.');
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

      // Check if user_profiles table exists and has data with shorter timeout
      const { data: profile, error } = await withTimeout(
        supabase
          .from('user_profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle(),
        10000,
        'Profile loading timeout'
      );

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading user profile:', error);
        // Fall back to basic user info instead of failing
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
    } catch (error: any) {
      console.error('Error loading user profile:', error);
      // Always fall back to basic user info to prevent blocking the app
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
      const { data, error } = await withTimeout(
        supabase
          .from('user_tokens')
          .select('*')
          .eq('token', token)
          .eq('is_active', true)
          .maybeSingle(),
        10000,
        'Token validation timeout'
      );

      return !error && !!data;
    } catch (error: any) {
      console.error('Error validating token:', error);
      return false;
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      throw new Error('Authentication service is not configured. Please contact the administrator to set up the database connection.');
    }

    // Test connection first
    const connectionOk = await testSupabaseConnection();
    if (!connectionOk) {
      throw new Error(connectionError || 'Unable to connect to the authentication service. Your Supabase project may be paused.');
    }

    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
        15000,
        'Login request timeout'
      );

      if (error) {
        console.error('Login error:', error);
        
        // Provide more specific error messages
        if (error.message.includes('Invalid login credentials') || error.message.includes('invalid_credentials')) {
          throw new Error('Invalid email or password. Please check your credentials and try again.');
        } else if (error.message.includes('Email not confirmed')) {
          throw new Error('Please check your email and confirm your account before logging in.');
        } else if (error.message.includes('Too many requests')) {
          throw new Error('Too many login attempts. Please wait a few minutes before trying again.');
        } else {
          throw new Error(`Login failed: ${error.message}`);
        }
      }

      if (!data.user) {
        throw new Error('Login failed - no user data received. Please try again.');
      }

      await loadUserProfile(data.user);
      setConnectionError(null);
      return true;
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.message.includes('timeout')) {
        throw new Error('Login request timeout. Please check your connection and ensure your Supabase project is active.');
      }
      throw error;
    }
  };

  const register = async (email: string, password: string, token?: string): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      throw new Error('Authentication service is not configured. Please contact the administrator to set up the database connection.');
    }

    // Test connection first
    const connectionOk = await testSupabaseConnection();
    if (!connectionOk) {
      throw new Error(connectionError || 'Unable to connect to the authentication service. Your Supabase project may be paused.');
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

      const { data, error } = await withTimeout(
        supabase.auth.signUp(signUpData),
        15000,
        'Registration request timeout'
      );

      if (error) {
        console.error('Registration error:', error);
        
        // Provide more specific error messages
        if (error.message.includes('User already registered')) {
          throw new Error('An account with this email already exists. Please try logging in instead.');
        } else if (error.message.includes('Password should be at least')) {
          throw new Error('Password must be at least 6 characters long.');
        } else if (error.message.includes('Invalid email')) {
          throw new Error('Please enter a valid email address.');
        } else {
          throw new Error(`Registration failed: ${error.message}`);
        }
      }

      if (!data.user) {
        throw new Error('Registration failed - no user data received. Please try again.');
      }

      // Create basic user immediately
      createBasicUser(data.user);
      setConnectionError(null);
      return true;
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.message.includes('timeout')) {
        throw new Error('Registration request timeout. Please check your connection and ensure your Supabase project is active.');
      }
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (isSupabaseConfigured) {
        await withTimeout(
          supabase.auth.signOut(),
          10000,
          'Logout timeout'
        );
      }
      setUser(null);
      setUserProfile(null);
      setConnectionError(null);
    } catch (error: any) {
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
      isSupabaseConfigured,
      connectionError,
      retryConnection
    }}>
      {children}
    </AuthContext.Provider>
  );
};