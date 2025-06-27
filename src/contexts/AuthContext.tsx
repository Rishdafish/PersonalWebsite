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
          // Clear invalid session data when there's an error
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
        // Clear invalid session data when there's an exception
        await supabase.auth.signOut();
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
      console.log('🔍 Starting token validation for:', token);
      console.log('🔍 Token length:', token.length);
      console.log('🔍 Token characters:', token.split('').map(c => c.charCodeAt(0)));
      
      // First, let's check if we can connect to the database at all
      console.log('🔗 Testing database connection...');
      const { data: connectionTest, error: connectionError } = await supabase
        .from('user_tokens')
        .select('count')
        .limit(1);
      
      if (connectionError) {
        console.error('❌ Database connection failed:', connectionError);
        return false;
      }
      
      console.log('✅ Database connection successful');
      
      // Now let's get all tokens to see what's in the database
      console.log('📋 Fetching all tokens from database...');
      const { data: allTokens, error: allTokensError } = await supabase
        .from('user_tokens')
        .select('*');
      
      if (allTokensError) {
        console.error('❌ Error fetching all tokens:', allTokensError);
      } else {
        console.log('📋 All tokens in database:', allTokens);
        console.log('📋 Number of tokens:', allTokens?.length || 0);
        
        if (allTokens) {
          allTokens.forEach((tokenRow, index) => {
            console.log(`🎫 Token ${index + 1}:`, {
              token: tokenRow.token,
              isActive: tokenRow.is_active,
              description: tokenRow.description,
              matches: tokenRow.token === token
            });
          });
        }
      }
      
      // Now try the specific validation query
      console.log('🎯 Performing specific token validation...');
      const { data, error } = await supabase
        .from('user_tokens')
        .select('*')
        .eq('token', token)
        .eq('is_active', true);

      console.log('🎯 Validation query result:', { data, error });
      
      if (error) {
        console.error('❌ Error in token validation query:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error details:', error.details);
        return false;
      }

      const isValid = data && data.length > 0;
      console.log('🎫 Token validation result:', isValid);
      console.log('🎫 Data returned:', data);
      
      if (!isValid) {
        console.log('❌ Token not found or inactive');
        
        // Let's try a more basic query to see if the token exists at all
        console.log('🔍 Checking if token exists without active filter...');
        const { data: basicData, error: basicError } = await supabase
          .from('user_tokens')
          .select('*')
          .eq('token', token);
        
        console.log('🔍 Basic token check result:', { basicData, basicError });
        
        if (basicData && basicData.length > 0) {
          console.log('⚠️ Token exists but may not be active:', basicData[0]);
        } else {
          console.log('❌ Token does not exist in database at all');
        }
      }
      
      return isValid;
    } catch (error) {
      console.error('❌ Exception in validateToken:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
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
      console.log('📝 ========== STARTING REGISTRATION PROCESS ==========');
      console.log('📝 Email:', email);
      console.log('📝 Password length:', password.length);
      console.log('📝 Token provided:', !!token);
      console.log('📝 Token value:', token || 'none');
      console.log('📝 Current timestamp:', new Date().toISOString());
      
      // Check Supabase connection first
      console.log('🔗 Testing Supabase connection before registration...');
      try {
        const { data: connectionTest, error: connectionError } = await supabase
          .from('user_tokens')
          .select('count')
          .limit(1);
        
        if (connectionError) {
          console.error('❌ Supabase connection test failed:', connectionError);
          console.error('❌ Connection error code:', connectionError.code);
          console.error('❌ Connection error message:', connectionError.message);
          console.error('❌ Connection error details:', connectionError.details);
        } else {
          console.log('✅ Supabase connection test successful');
        }
      } catch (connError) {
        console.error('❌ Exception during connection test:', connError);
      }
      
      // Validate token if provided
      if (token) {
        console.log('🎫 ========== TOKEN VALIDATION PHASE ==========');
        console.log('🎫 Validating provided token before registration...');
        console.log('🎫 Token to validate:', token);
        console.log('🎫 Token type:', typeof token);
        console.log('🎫 Token length:', token.length);
        
        const isValidToken = await validateToken(token);
        console.log('🎫 Pre-registration token validation result:', isValidToken);
        
        if (!isValidToken) {
          console.error('❌ ========== TOKEN VALIDATION FAILED ==========');
          console.error('❌ Invalid token provided during registration:', token);
          console.error('❌ Registration will be aborted due to invalid token');
          throw new Error('Invalid or expired token');
        }
        console.log('✅ ========== TOKEN VALIDATION PASSED ==========');
        console.log('✅ Token is valid, proceeding with registration');
      } else {
        console.log('ℹ️ No token provided, proceeding with regular registration');
      }

      // Prepare signup data
      console.log('📤 ========== PREPARING SIGNUP DATA ==========');
      const signUpData: any = {
        email,
        password,
        options: {
          emailRedirectTo: undefined, // Disable email confirmation
          data: token ? { token } : {} // Include token in metadata if provided
        }
      };

      console.log('📤 Complete signUpData object being sent to Supabase:');
      console.log('📤 - email:', signUpData.email);
      console.log('📤 - password: [REDACTED - length:', signUpData.password.length, ']');
      console.log('📤 - options:', JSON.stringify(signUpData.options, null, 2));
      console.log('📤 - options.emailRedirectTo:', signUpData.options.emailRedirectTo);
      console.log('📤 - options.data:', JSON.stringify(signUpData.options.data, null, 2));
      console.log('📤 - metadata keys:', Object.keys(signUpData.options.data));
      console.log('📤 - metadata token value:', signUpData.options.data.token);
      
      // Check current auth state before signup
      console.log('🔍 ========== PRE-SIGNUP AUTH STATE CHECK ==========');
      try {
        const { data: currentSession, error: sessionError } = await supabase.auth.getSession();
        console.log('🔍 Current session before signup:', {
          hasSession: !!currentSession.session,
          hasUser: !!currentSession.session?.user,
          userEmail: currentSession.session?.user?.email,
          sessionError: sessionError
        });
      } catch (sessionCheckError) {
        console.error('❌ Error checking current session:', sessionCheckError);
      }
      
      // Perform the actual signup
      console.log('🚀 ========== EXECUTING SUPABASE SIGNUP ==========');
      console.log('🚀 Calling supabase.auth.signUp with prepared data...');
      console.log('🚀 Signup timestamp:', new Date().toISOString());
      
      const { data, error } = await supabase.auth.signUp(signUpData);

      console.log('📥 ========== SUPABASE SIGNUP RESPONSE ==========');
      console.log('📥 Response timestamp:', new Date().toISOString());
      console.log('📥 Raw data object:', data);
      console.log('📥 Raw error object:', error);
      
      if (data) {
        console.log('📥 Data breakdown:');
        console.log('📥 - data.user:', data.user);
        console.log('📥 - data.session:', data.session);
        
        if (data.user) {
          console.log('📥 User details:');
          console.log('📥 - user.id:', data.user.id);
          console.log('📥 - user.email:', data.user.email);
          console.log('📥 - user.email_confirmed_at:', data.user.email_confirmed_at);
          console.log('📥 - user.created_at:', data.user.created_at);
          console.log('📥 - user.user_metadata:', JSON.stringify(data.user.user_metadata, null, 2));
          console.log('📥 - user.app_metadata:', JSON.stringify(data.user.app_metadata, null, 2));
          console.log('📥 - user.aud:', data.user.aud);
          console.log('📥 - user.role:', data.user.role);
        }
        
        if (data.session) {
          console.log('📥 Session details:');
          console.log('📥 - session.access_token: [PRESENT]');
          console.log('📥 - session.refresh_token: [PRESENT]');
          console.log('📥 - session.expires_at:', data.session.expires_at);
          console.log('📥 - session.token_type:', data.session.token_type);
        }
      }

      if (error) {
        console.error('❌ ========== SUPABASE SIGNUP ERROR ==========');
        console.error('❌ Error object:', error);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error status:', error.status);
        
        // Log all error properties
        console.error('❌ All error properties:');
        Object.keys(error).forEach(key => {
          console.error(`❌ - error.${key}:`, (error as any)[key]);
        });
        
        // Check if it's a specific type of error
        if (error.message?.includes('Database error')) {
          console.error('❌ ========== DATABASE ERROR DETECTED ==========');
          console.error('❌ This appears to be a server-side database error');
          console.error('❌ Possible causes:');
          console.error('❌ 1. RLS policies blocking user creation');
          console.error('❌ 2. Database triggers failing');
          console.error('❌ 3. Foreign key constraints');
          console.error('❌ 4. Missing required columns');
          console.error('❌ 5. Database connection issues');
        }
        
        return false;
      }

      if (data.user) {
        console.log('✅ ========== REGISTRATION SUCCESSFUL ==========');
        console.log('✅ Registration successful, user:', data.user.email);
        console.log('✅ User ID:', data.user.id);
        console.log('✅ User metadata after registration:', JSON.stringify(data.user.user_metadata, null, 2));
        console.log('✅ Email confirmed:', !!data.user.email_confirmed_at);
        
        // Check if user was created in auth.users
        console.log('🔍 ========== POST-SIGNUP VERIFICATION ==========');
        try {
          const { data: authUser, error: authError } = await supabase.auth.getUser();
          console.log('🔍 Auth user check result:', { authUser, authError });
        } catch (authCheckError) {
          console.error('❌ Error checking auth user:', authCheckError);
        }
        
        // Wait a moment for triggers to execute, then manually create profile if needed
        console.log('⏳ ========== PROFILE CREATION PHASE ==========');
        console.log('⏳ Waiting for database triggers to execute...');
        
        setTimeout(async () => {
          try {
            console.log('🔍 Checking if profile was created by trigger...');
            console.log('🔍 Looking for profile with ID:', data.user!.id);
            
            const { data: existingProfile, error: profileError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', data.user!.id)
              .maybeSingle();
            
            console.log('🔍 Profile check result:');
            console.log('🔍 - existingProfile:', existingProfile);
            console.log('🔍 - profileError:', profileError);
            
            if (profileError) {
              console.error('❌ Error checking for existing profile:', profileError);
              console.error('❌ Profile error code:', profileError.code);
              console.error('❌ Profile error message:', profileError.message);
            }
            
            if (!existingProfile) {
              console.log('⚠️ ========== MANUAL PROFILE CREATION ==========');
              console.log('⚠️ Profile not created by trigger, creating manually...');
              await createUserProfileManually(data.user!);
            } else {
              console.log('✅ ========== PROFILE EXISTS FROM TRIGGER ==========');
              console.log('✅ Profile exists from trigger:', existingProfile);
              console.log('✅ Profile role:', existingProfile.role);
              console.log('✅ Profile email:', existingProfile.email);
            }
          } catch (error) {
            console.error('❌ ========== PROFILE CHECK/CREATION ERROR ==========');
            console.error('❌ Error checking/creating profile after registration:', error);
            console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
          }
        }, 1000);
        
        console.log('✅ ========== REGISTRATION PROCESS COMPLETE ==========');
        return true;
      }

      console.log('⚠️ ========== UNEXPECTED REGISTRATION STATE ==========');
      console.log('⚠️ Registration returned no user but no error either');
      console.log('⚠️ This is an unexpected state that should be investigated');
      return false;
    } catch (error) {
      console.error('❌ ========== REGISTRATION EXCEPTION ==========');
      console.error('❌ Registration error (catch):', error);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error constructor:', error?.constructor?.name);
      
      if (error instanceof Error) {
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
      }
      
      // Log all error properties if it's an object
      if (typeof error === 'object' && error !== null) {
        console.error('❌ All error properties:');
        Object.keys(error).forEach(key => {
          console.error(`❌ - error.${key}:`, (error as any)[key]);
        });
      }
      
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