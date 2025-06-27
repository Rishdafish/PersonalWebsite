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
  logout: () => Promise<void>;
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

    // Set a maximum loading time to prevent infinite loading
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

        // Clear loading timeout when auth state changes
        clearTimeout(loadingTimeout);

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
      console.log('🆔 User ID:', authUser.id);
      
      // First try to get existing profile
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('❌ Error loading user profile:', error);
        await createUserProfileManually(authUser);
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
        console.log('⚠️ No profile found, creating one manually...');
        await createUserProfileManually(authUser);
      }
    } catch (error) {
      console.error('❌ Error in loadUserProfile:', error);
      await createUserProfileManually(authUser);
    }
  };

  const createUserProfileManually = async (authUser: SupabaseUser) => {
    try {
      console.log('🔧 Creating user profile manually for:', authUser.email);
      
      // Get token from user metadata if available
      const token = authUser.user_metadata?.token;
      console.log('🎫 Token from metadata:', token ? 'present' : 'none');
      
      // Use the manual profile creation function
      const { data: newProfile, error } = await supabase
        .rpc('create_user_profile_manual', {
          user_id: authUser.id,
          user_email: authUser.email || '',
          user_token: token || null
        });

      if (error) {
        console.error('❌ Error creating profile manually:', error);
        createFallbackUser(authUser);
        return;
      }

      console.log('✅ Profile created manually:', newProfile);
      setUserProfile(newProfile);
      setUser({
        id: newProfile.id,
        email: newProfile.email,
        role: newProfile.role,
        isAdmin: newProfile.role === 'admin',
        isSpecialized: newProfile.role === 'specialized',
        isRegular: newProfile.role === 'regular'
      });

    } catch (error) {
      console.error('❌ Error creating user profile manually:', error);
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
  };

  const validateToken = async (token: string): Promise<boolean> => {
    try {
      console.log('🔍 Validating token:', token.substring(0, 5) + '...');
      
      const { data, error } = await supabase
        .from('user_tokens')
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .limit(1);

      if (error) {
        console.error('❌ Error validating token:', error);
        return false;
      }

      const isValid = data && data.length > 0;
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
        console.error('❌ Login error:', error.message);
        return false;
      }

      if (data.user) {
        console.log('✅ Login successful, user:', data.user.email);
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
      console.log('🎫 Token provided:', !!token, token ? `(${token})` : '');
      
      // Validate token if provided
      if (token) {
        console.log('🎫 Validating provided token...');
        const isValidToken = await validateToken(token);
        if (!isValidToken) {
          console.error('❌ Invalid token provided:', token);
          throw new Error('Invalid or expired token');
        }
        console.log('✅ Token is valid');
      }

      const signUpData: any = {
        email,
        password,
        options: {
          emailRedirectTo: undefined, // Disable email confirmation
          data: token ? { token } : {} // Include token in metadata if provided
        }
      };

      console.log('📤 Sending signup request to Supabase with data:', {
        email,
        hasToken: !!token,
        tokenValue: token
      });
      
      const { data, error } = await supabase.auth.signUp(signUpData);

      if (error) {
        console.error('❌ Registration error:', error.message);
        return false;
      }

      if (data.user) {
        console.log('✅ Registration successful, user:', data.user.email);
        console.log('🔍 User metadata:', data.user.user_metadata);
        
        // Wait a moment for triggers to execute, then manually create profile if needed
        setTimeout(async () => {
          try {
            const { data: existingProfile } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', data.user!.id)
              .maybeSingle();
            
            if (!existingProfile) {
              console.log('⚠️ Profile not created by trigger, creating manually...');
              await createUserProfileManually(data.user!);
            } else {
              console.log('✅ Profile exists from trigger');
            }
          } catch (error) {
            console.error('❌ Error checking/creating profile after registration:', error);
          }
        }, 1000);
        
        return true;
      }

      console.log('⚠️ Registration returned no user');
      return false;
    } catch (error) {
      console.error('❌ Registration error (catch):', error);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      console.log('👋 Starting logout process...');
      
      // Clear local state immediately for better UX
      setUser(null);
      setUserProfile(null);
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Logout error:', error);
        throw error;
      }
      
      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Even if logout fails, clear local state
      setUser(null);
      setUserProfile(null);
      throw error;
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