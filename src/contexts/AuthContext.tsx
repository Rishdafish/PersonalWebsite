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
    let loadingTimeout: NodeJS.Timeout;

    // Set a maximum loading time of 8 seconds
    loadingTimeout = setTimeout(() => {
      if (mounted) {
        console.log('🚨 Auth loading timeout reached, setting loading to false');
        setLoading(false);
      }
    }, 8000);

    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('🔍 Getting initial session...');
        
        // Test Supabase connection first
        const { data: testData, error: testError } = await supabase
          .from('user_tokens')
          .select('count')
          .limit(1);
        
        if (testError) {
          console.error('❌ Supabase connection test failed:', testError);
          throw new Error('Database connection failed');
        }
        
        console.log('✅ Supabase connection test passed');
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error getting session:', error);
          // Clear any invalid session data
          await supabase.auth.signOut();
          if (mounted) {
            setUser(null);
            setUserProfile(null);
            setLoading(false);
          }
          return;
        }

        if (session?.user && mounted) {
          console.log('✅ Found existing session for:', session.user.email);
          await loadUserProfile(session.user);
        } else if (mounted) {
          console.log('ℹ️ No existing session found');
          setUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        console.error('❌ Error in getInitialSession:', error);
        if (mounted) {
          setUser(null);
          setUserProfile(null);
        }
      } finally {
        if (mounted) {
          clearTimeout(loadingTimeout);
          setLoading(false);
          console.log('✅ Initial session check complete, loading set to false');
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('🔄 Auth state changed:', event, session?.user?.email || 'no user');

        if (event === 'SIGNED_OUT' || !session?.user) {
          console.log('👋 User signed out or no user');
          setUser(null);
          setUserProfile(null);
          setLoading(false);
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          console.log('🔑 User signed in or token refreshed');
          if (session?.user) {
            await loadUserProfile(session.user);
          }
        }

        setLoading(false);
        console.log('✅ Auth state change handled, loading set to false');
      }
    );

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const loadUserProfile = async (authUser: SupabaseUser) => {
    try {
      console.log('👤 Loading profile for user:', authUser.email);
      
      // First check if user_profiles table exists and is accessible
      const { data: tableCheck, error: tableError } = await supabase
        .from('user_profiles')
        .select('count')
        .limit(1);
      
      if (tableError) {
        console.error('❌ user_profiles table access error:', tableError);
        // Create a fallback user if table doesn't exist
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          role: 'regular',
          isAdmin: false,
          isSpecialized: false,
          isRegular: true
        });
        return;
      }
      
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error) {
        console.error('❌ Error loading user profile:', error);
        
        // If profile doesn't exist, try to create it
        if (error.code === 'PGRST116') {
          console.log('🔧 Profile not found, creating...');
          await createUserProfile(authUser);
          return;
        }
        
        // For other errors, set a default user
        console.log('⚠️ Setting default user due to profile error');
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          role: 'regular',
          isAdmin: false,
          isSpecialized: false,
          isRegular: true
        });
        return;
      }

      if (profile) {
        console.log('✅ Profile loaded successfully:', profile.email, profile.role);
        setUserProfile(profile);
        setUser({
          id: profile.id,
          email: profile.email,
          role: profile.role,
          isAdmin: profile.role === 'admin',
          isSpecialized: profile.role === 'specialized',
          isRegular: profile.role === 'regular'
        });
      }
    } catch (error) {
      console.error('❌ Error in loadUserProfile:', error);
      // Set a fallback user to prevent infinite loading
      setUser({
        id: authUser.id,
        email: authUser.email || '',
        role: 'regular',
        isAdmin: false,
        isSpecialized: false,
        isRegular: true
      });
    }
  };

  const createUserProfile = async (authUser: SupabaseUser) => {
    try {
      console.log('🔧 Creating user profile for:', authUser.email);
      
      // Determine role based on email
      let role: 'admin' | 'regular' | 'specialized' = 'regular';
      if (['rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com'].includes(authUser.email || '')) {
        role = 'admin';
        console.log('👑 Admin role assigned');
      }

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .insert([{
          id: authUser.id,
          email: authUser.email || '',
          role: role
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating user profile:', error);
        // Set a fallback user even if profile creation fails
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          role: role,
          isAdmin: role === 'admin',
          isSpecialized: role === 'specialized',
          isRegular: role === 'regular'
        });
        return;
      }

      if (profile) {
        console.log('✅ Profile created successfully:', profile.email, profile.role);
        setUserProfile(profile);
        setUser({
          id: profile.id,
          email: profile.email,
          role: profile.role,
          isAdmin: profile.role === 'admin',
          isSpecialized: profile.role === 'specialized',
          isRegular: profile.role === 'regular'
        });
      }
    } catch (error) {
      console.error('❌ Error creating user profile:', error);
      // Set a fallback user
      setUser({
        id: authUser.id,
        email: authUser.email || '',
        role: 'regular',
        isAdmin: false,
        isSpecialized: false,
        isRegular: true
      });
    }
  };

  const validateToken = async (token: string): Promise<boolean> => {
    try {
      console.log('🔍 Validating token:', token.substring(0, 5) + '...');
      const { data, error } = await supabase
        .from('user_tokens')
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      const isValid = !error && !!data;
      console.log('🎫 Token validation result:', isValid);
      return isValid;
    } catch (error) {
      console.error('❌ Error validating token:', error);
      return false;
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('🔐 Starting login process for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ Login error:', error.message, error);
        return false;
      }

      if (data.user) {
        console.log('✅ Login successful, user:', data.user.email);
        console.log('📧 User confirmation status:', data.user.email_confirmed_at ? 'confirmed' : 'not confirmed');
        
        // The auth state change handler will load the profile
        return true;
      }

      console.log('⚠️ Login returned no user');
      return false;
    } catch (error) {
      console.error('❌ Login error (catch):', error);
      return false;
    }
  };

  const register = async (email: string, password: string, token?: string): Promise<boolean> => {
    try {
      console.log('📝 Starting registration process for:', email);
      
      // Validate token if provided
      if (token) {
        console.log('🎫 Validating provided token...');
        const isValidToken = await validateToken(token);
        if (!isValidToken) {
          console.error('❌ Invalid token provided');
          throw new Error('Invalid or expired token');
        }
        console.log('✅ Token is valid');
      }

      const signUpData: any = {
        email,
        password,
        options: {
          emailRedirectTo: undefined // Disable email confirmation
        }
      };

      // Add token to metadata if provided
      if (token) {
        signUpData.options.data = {
          token: token
        };
        console.log('🎫 Token added to signup metadata');
      }

      console.log('📤 Sending signup request to Supabase...');
      const { data, error } = await supabase.auth.signUp(signUpData);

      if (error) {
        console.error('❌ Registration error:', error.message, error);
        return false;
      }

      if (data.user) {
        console.log('✅ Registration successful, user:', data.user.email);
        console.log('📧 User ID:', data.user.id);
        console.log('📧 Email confirmation required:', !data.user.email_confirmed_at);
        
        // If email confirmation is not required, the user should be signed in
        if (data.user.email_confirmed_at || data.session) {
          console.log('🎉 User is immediately available, no email confirmation needed');
          return true;
        } else {
          console.log('📧 Email confirmation may be required');
          return true; // Still consider it successful
        }
      }

      console.log('⚠️ Registration returned no user');
      return false;
    } catch (error) {
      console.error('❌ Registration error (catch):', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      console.log('👋 Logging out user');
      await supabase.auth.signOut();
      setUser(null);
      setUserProfile(null);
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout error:', error);
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

  console.log('🔍 Current auth state:', {
    loading,
    isAuthenticated,
    userEmail: user?.email,
    userRole: user?.role
  });

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