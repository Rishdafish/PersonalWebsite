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

// Console-only debugging functions
const authDebug = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const prefix = '🔐 [AUTH DEBUG]';
  
  if (data !== undefined) {
    console.log(`${prefix} ${timestamp}: ${message}`, data);
  } else {
    console.log(`${prefix} ${timestamp}: ${message}`);
  }
};

const authError = (message: string, error?: any) => {
  const timestamp = new Date().toISOString();
  console.error(`❌ [AUTH ERROR] ${timestamp}: ${message}`, error);
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let loadingTimeout: NodeJS.Timeout;

    authDebug('🚀 AuthProvider useEffect started');

    // Set a maximum loading time to prevent infinite loading
    loadingTimeout = setTimeout(() => {
      if (mounted) {
        authError('Auth loading timeout reached after 10 seconds');
        setLoading(false);
      }
    }, 10000);

    // Get initial session
    const getInitialSession = async () => {
      try {
        authDebug('🔍 Getting initial session...');
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          authError('Error getting session', error);
          await supabase.auth.signOut();
          if (mounted) {
            setUser(null);
            setUserProfile(null);
            setLoading(false);
          }
          return;
        }

        if (session?.user && mounted) {
          authDebug('✅ Found existing session', { 
            userEmail: session.user.email,
            userId: session.user.id 
          });
          await loadUserProfile(session.user);
        } else if (mounted) {
          authDebug('ℹ️ No existing session found');
          setUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        authError('Exception in getInitialSession', error);
        await supabase.auth.signOut();
        if (mounted) {
          setUser(null);
          setUserProfile(null);
        }
      } finally {
        if (mounted) {
          clearTimeout(loadingTimeout);
          setLoading(false);
          authDebug('✅ Initial session check complete');
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        authDebug('🔄 Auth state changed', { 
          event, 
          userEmail: session?.user?.email || 'no user',
          hasSession: !!session 
        });

        clearTimeout(loadingTimeout);

        if (event === 'SIGNED_OUT' || !session?.user) {
          authDebug('👋 User signed out or no user');
          setUser(null);
          setUserProfile(null);
          setLoading(false);
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          authDebug('🔑 User signed in or token refreshed');
          if (session?.user) {
            await loadUserProfile(session.user);
          }
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
      authDebug('🧹 AuthProvider cleanup completed');
    };
  }, []);

  const loadUserProfile = async (authUser: SupabaseUser) => {
    try {
      authDebug('👤 Loading profile for user', { 
        email: authUser.email, 
        id: authUser.id 
      });

      // Step 1: Test basic database connectivity
      authDebug('🔍 Step 1: Testing database connectivity...');
      try {
        const connectivityTest = await supabase
          .from('user_profiles')
          .select('count')
          .limit(1);
        
        if (connectivityTest.error) {
          throw connectivityTest.error;
        }
        
        authDebug('✅ Database connectivity test passed');
      } catch (connectError: any) {
        authError('Database connectivity test failed', connectError);
        
        // If connectivity fails, create fallback user immediately
        createFallbackUser(authUser);
        return;
      }

      // Step 2: Try to get existing profile
      authDebug('🔍 Step 2: Querying for existing profile...');
      try {
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        authDebug('📥 Profile query response', {
          hasData: !!profile,
          hasError: !!profileError,
          errorCode: profileError?.code,
          errorMessage: profileError?.message,
          profileData: profile
        });

        if (profileError && profileError.code !== 'PGRST116') {
          authError('Error loading user profile', profileError);
          authDebug('🛠️ Attempting manual profile creation due to query error...');
          await createUserProfileManually(authUser);
          return;
        }

        if (profile) {
          authDebug('✅ Profile loaded successfully', {
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
          
          authDebug('✅ User state updated successfully');
        } else {
          authDebug('⚠️ No profile found, creating manually...');
          await createUserProfileManually(authUser);
        }
      } catch (queryError: any) {
        authError('Profile query exception', queryError);
        authDebug('🛠️ Attempting manual profile creation due to exception...');
        await createUserProfileManually(authUser);
      }
    } catch (error) {
      authError('Exception in loadUserProfile', error);
      authDebug('🆘 Falling back to manual profile creation due to exception...');
      await createUserProfileManually(authUser);
    }
  };

  const createUserProfileManually = async (authUser: SupabaseUser) => {
    try {
      authDebug('🛠️ Creating user profile manually', { 
        email: authUser.email,
        userId: authUser.id 
      });
      
      const token = authUser.user_metadata?.token;
      authDebug('🎫 Token from metadata', { 
        hasToken: !!token, 
        token: token || 'none'
      });

      // Try manual creation with correct parameter names
      const { data: newProfile, error: createError } = await supabase
        .rpc('create_user_profile_manual', {
          p_user_id: authUser.id,
          p_user_email: authUser.email || '',
          p_user_token: token || null
        });

      authDebug('📥 Manual creation response', {
        hasData: !!newProfile,
        hasError: !!createError,
        errorCode: createError?.code,
        errorMessage: createError?.message,
        profileData: newProfile
      });

      if (createError) {
        authError('Error creating profile manually', createError);
        authDebug('🆘 Manual creation failed, using fallback...');
        createFallbackUser(authUser);
        return;
      }

      if (newProfile) {
        authDebug('✅ Profile created manually', newProfile);
        setUserProfile(newProfile);
        setUser({
          id: newProfile.id,
          email: newProfile.email,
          role: newProfile.role,
          isAdmin: newProfile.role === 'admin',
          isSpecialized: newProfile.role === 'specialized',
          isRegular: newProfile.role === 'regular'
        });
        
        authDebug('✅ User state updated after manual creation');
      } else {
        authError('Manual creation returned no data');
        createFallbackUser(authUser);
      }

    } catch (error: any) {
      authError('Exception creating user profile manually', error);
      authDebug('🆘 Manual creation exception, using fallback...');
      createFallbackUser(authUser);
    }
  };

  const createFallbackUser = (authUser: SupabaseUser) => {
    authDebug('🆘 Creating fallback user', { 
      email: authUser.email,
      userId: authUser.id 
    });
    
    let role: 'admin' | 'regular' | 'specialized' = 'regular';
    if (['rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com'].includes(authUser.email || '')) {
      role = 'admin';
      authDebug('👑 Admin role assigned to fallback user');
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
    authDebug('✅ Fallback user created successfully', newUser);
  };

  const validateToken = async (token: string): Promise<boolean> => {
    try {
      authDebug('🎫 Starting token validation', { 
        token, 
        length: token.length 
      });
      
      // Token validation without aggressive timeout
      const { data, error } = await supabase
        .from('user_tokens')
        .select('*')
        .eq('token', token)
        .eq('is_active', true);

      if (error) {
        authError('Error in token validation query', error);
        return false;
      }

      const isValid = data && data.length > 0;
      authDebug('🎫 Token validation result', { 
        isValid, 
        foundTokens: data?.length || 0 
      });
      
      return isValid;
    } catch (error) {
      authError('Exception in validateToken', error);
      return false;
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      authDebug('🔐 Starting login process', { email });
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        authError('Login failed', error);
        return false;
      }

      if (data.user) {
        authDebug('✅ Login successful', { userEmail: data.user.email });
        return true;
      }

      authError('Login returned no user');
      return false;
    } catch (error) {
      authError('Exception during login', error);
      return false;
    }
  };

  const register = async (email: string, password: string, token?: string): Promise<boolean> => {
    try {
      authDebug('📝 Starting registration process', { 
        email, 
        hasToken: !!token,
        token: token || 'none'
      });
      
      // Validate token if provided
      if (token) {
        authDebug('🎫 Validating token before registration...');
        const isValidToken = await validateToken(token);
        
        if (!isValidToken) {
          authError('Invalid token provided during registration', { token });
          return false;
        }
        authDebug('✅ Token validation passed');
      }

      const signUpData: any = {
        email,
        password,
        options: {
          emailRedirectTo: undefined,
          data: token ? { token } : {}
        }
      };

      authDebug('📤 Sending signup request to Supabase', {
        email: signUpData.email,
        hasPassword: !!signUpData.password,
        metadata: signUpData.options.data
      });
      
      const { data, error } = await supabase.auth.signUp(signUpData);

      authDebug('📥 Supabase signup response received', {
        hasData: !!data,
        hasUser: !!data?.user,
        hasSession: !!data?.session,
        hasError: !!error,
        userEmail: data?.user?.email
      });

      if (error) {
        authError('Registration failed', error);
        return false;
      }

      if (data.user) {
        authDebug('✅ Registration successful', { 
          userEmail: data.user.email,
          userId: data.user.id,
          emailConfirmed: !!data.user.email_confirmed_at
        });
        
        return true;
      }

      authError('Registration returned no user');
      return false;
    } catch (error) {
      authError('Exception during registration', error);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      authDebug('👋 Starting logout process...');
      
      setUser(null);
      setUserProfile(null);
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        authError('Logout error', error);
        throw error;
      }
      
      authDebug('✅ Logout successful');
    } catch (error) {
      authError('Exception during logout', error);
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