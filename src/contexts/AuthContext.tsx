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

    // Set a maximum loading time of 3 seconds (reduced further)
    loadingTimeout = setTimeout(() => {
      if (mounted) {
        console.log('🚨 Auth loading timeout reached, setting loading to false');
        setLoading(false);
      }
    }, 3000);

    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('🔍 Getting initial session...');
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error getting session:', error);
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
    const profileTimeout = setTimeout(() => {
      console.log('⏰ Profile loading timeout, creating fallback user');
      createFallbackUser(authUser);
    }, 2000); // Reduced to 2 seconds

    try {
      console.log('👤 Loading profile for user:', authUser.email);
      console.log('🆔 User ID:', authUser.id);
      
      // Skip database connectivity test for now and go straight to profile loading
      console.log('📋 Querying user_profiles table...');
      
      // Use a Promise.race to implement our own timeout
      const profileQuery = supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), 1500);
      });

      const { data: profile, error } = await Promise.race([profileQuery, timeoutPromise]) as any;

      clearTimeout(profileTimeout);

      if (error) {
        console.error('❌ Error loading user profile:', error);
        
        // For any error, create fallback user immediately
        console.log('⚠️ Creating fallback user due to profile error');
        createFallbackUser(authUser);
        return;
      }

      if (profile) {
        console.log('✅ Profile loaded successfully:', {
          email: profile.email,
          role: profile.role,
          id: profile.id
        });
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
        console.log('⚠️ No profile found, creating fallback user...');
        createFallbackUser(authUser);
      }
    } catch (error) {
      clearTimeout(profileTimeout);
      console.error('❌ Error in loadUserProfile:', error);
      createFallbackUser(authUser);
    }
  };

  const createFallbackUser = (authUser: SupabaseUser) => {
    console.log('🔧 Creating fallback user for:', authUser.email);
    
    // Determine role based on email
    let role: 'admin' | 'regular' | 'specialized' = 'regular';
    if (['rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com'].includes(authUser.email || '')) {
      role = 'admin';
      console.log('👑 Admin role assigned to fallback user');
    }

    const newUser = {
      id: authUser.id,
      email: authUser.email || '',
      role: role,
      isAdmin: role === 'admin',
      isSpecialized: role === 'specialized',
      isRegular: role === 'regular'
    };

    setUser(newUser);
    console.log('✅ Fallback user created successfully:', newUser);
    
    // Try to create the profile in the background (don't wait for it)
    createUserProfileBackground(authUser, role);
  };

  const createUserProfileBackground = async (authUser: SupabaseUser, role: 'admin' | 'regular' | 'specialized') => {
    try {
      console.log('🔧 Creating user profile in background for:', authUser.email);
      
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: authUser.id,
          email: authUser.email || '',
          role: role
        }, {
          onConflict: 'id'
        });

      if (error) {
        console.error('❌ Background profile creation failed:', error);
      } else {
        console.log('✅ Background profile created successfully');
      }
    } catch (error) {
      console.error('❌ Error in background profile creation:', error);
    }
  };

  const validateToken = async (token: string): Promise<boolean> => {
    try {
      console.log('🔍 Validating token:', token.substring(0, 5) + '...');
      
      const { data, error } = await Promise.race([
        supabase
          .from('user_tokens')
          .select('*')
          .eq('token', token)
          .eq('is_active', true)
          .single(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Token validation timeout')), 3000))
      ]) as any;

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
        return true;
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