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

// Terminal logging function that prints to server console
const terminalLog = (message: string, data?: any) => {
  // Use console.log for terminal output
  if (data !== undefined) {
    console.log(`🔍 [AUTH] ${message}`, data);
  } else {
    console.log(`🔍 [AUTH] ${message}`);
  }
  
  // Also send to browser console for debugging
  if (data !== undefined) {
    console.log(`🔍 [AUTH] ${message}`, data);
  } else {
    console.log(`🔍 [AUTH] ${message}`);
  }
};

const terminalError = (message: string, error?: any) => {
  console.log('SIGN-UP FAILED 🚨');
  console.log('status  :', error.status);
  console.log('message :', error.message);
  console.log('details :', error.details);
  console.log('hint    :', error.hint);
  console.error(`❌ [AUTH ERROR] ${message}`, error);
  console.error(`❌ [AUTH ERROR] ${message}`, error);
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let loadingTimeout: NodeJS.Timeout;

    terminalLog('AuthProvider useEffect started');

    // Set a maximum loading time to prevent infinite loading
    loadingTimeout = setTimeout(() => {
      if (mounted) {
        terminalLog('Auth loading timeout reached, setting loading to false');
        setLoading(false);
      }
    }, 3000);

    // Get initial session
    const getInitialSession = async () => {
      try {
        terminalLog('Getting initial session...');
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          terminalError('Error getting session:', error);
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
          terminalLog('Found existing session for:', session.user.email);
          await loadUserProfile(session.user);
        } else if (mounted) {
          terminalLog('No existing session found');
          setUser(null);
          setUserProfile(null);
        }
      } catch (error) {
        terminalError('Error in getInitialSession:', error);
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
          terminalLog('Initial session check complete, loading set to false');
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        terminalLog('Auth state changed:', { event, userEmail: session?.user?.email || 'no user' });

        // Clear loading timeout when auth state changes
        clearTimeout(loadingTimeout);

        if (event === 'SIGNED_OUT' || !session?.user) {
          terminalLog('User signed out or no user');
          setUser(null);
          setUserProfile(null);
          setLoading(false);
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          terminalLog('User signed in or token refreshed');
          if (session?.user) {
            await loadUserProfile(session.user);
          }
        }

        setLoading(false);
        terminalLog('Auth state change handled, loading set to false');
      }
    );

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
      terminalLog('AuthProvider cleanup completed');
    };
  }, []);

  const loadUserProfile = async (authUser: SupabaseUser) => {
    try {
      terminalLog('Loading profile for user:', { email: authUser.email, id: authUser.id });
      
      // First try to get existing profile
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        terminalError('Error loading user profile:', error);
        await createUserProfileManually(authUser);
        return;
      }

      if (profile) {
        terminalLog('Profile loaded successfully:', {
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
        terminalLog('No profile found, creating one manually...');
        await createUserProfileManually(authUser);
      }
    } catch (error) {
      terminalError('Error in loadUserProfile:', error);
      await createUserProfileManually(authUser);
    }
  };

  const createUserProfileManually = async (authUser: SupabaseUser) => {
    try {
      terminalLog('Creating user profile manually for:', authUser.email);
      
      // Get token from user metadata if available
      const token = authUser.user_metadata?.token;
      terminalLog('Token from metadata:', token ? 'present' : 'none');
      
      // Use the manual profile creation function
      const { data: newProfile, error } = await supabase
        .rpc('create_user_profile_manual', {
          user_id: authUser.id,
          user_email: authUser.email || '',
          user_token: token || null
        });

      if (error) {
        terminalError('Error creating profile manually:', error);
        createFallbackUser(authUser);
        return;
      }

      terminalLog('Profile created manually:', newProfile);
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
      terminalError('Error creating user profile manually:', error);
      createFallbackUser(authUser);
    }
  };

  const createFallbackUser = (authUser: SupabaseUser) => {
    terminalLog('Creating fallback user for:', authUser.email);
    
    // Determine role based on email
    let role: 'admin' | 'regular' | 'specialized' = 'regular';
    if (['rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com'].includes(authUser.email || '')) {
      role = 'admin';
      terminalLog('Admin role assigned to fallback user');
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
    terminalLog('Fallback user created successfully:', newUser);
  };

  const validateToken = async (token: string): Promise<boolean> => {
    try {
      terminalLog('Starting token validation for:', token);
      terminalLog('Token length:', token.length);
      
      // First, let's check if we can connect to the database at all
      terminalLog('Testing database connection...');
      const { data: connectionTest, error: connectionError } = await supabase
        .from('user_tokens')
        .select('count')
        .limit(1);
      
      if (connectionError) {
        terminalError('Database connection failed:', connectionError);
        return false;
      }
      
      terminalLog('Database connection successful');
      
      // Now let's get all tokens to see what's in the database
      terminalLog('Fetching all tokens from database...');
      const { data: allTokens, error: allTokensError } = await supabase
        .from('user_tokens')
        .select('*');
      
      if (allTokensError) {
        terminalError('Error fetching all tokens:', allTokensError);
      } else {
        terminalLog('All tokens in database:', allTokens);
        terminalLog('Number of tokens:', allTokens?.length || 0);
        
        if (allTokens) {
          allTokens.forEach((tokenRow, index) => {
            terminalLog(`Token ${index + 1}:`, {
              token: tokenRow.token,
              isActive: tokenRow.is_active,
              description: tokenRow.description,
              matches: tokenRow.token === token
            });
          });
        }
      }
      
      // Now try the specific validation query
      terminalLog('Performing specific token validation...');
      const { data, error } = await supabase
        .from('user_tokens')
        .select('*')
        .eq('token', token)
        .eq('is_active', true);

      terminalLog('Validation query result:', { data, error });
      
      if (error) {
        terminalError('Error in token validation query:', error);
        return false;
      }

      const isValid = data && data.length > 0;
      terminalLog('Token validation result:', isValid);
      
      if (!isValid) {
        terminalLog('Token not found or inactive');
        
        // Let's try a more basic query to see if the token exists at all
        terminalLog('Checking if token exists without active filter...');
        const { data: basicData, error: basicError } = await supabase
          .from('user_tokens')
          .select('*')
          .eq('token', token);
        
        terminalLog('Basic token check result:', { basicData, basicError });
        
        if (basicData && basicData.length > 0) {
          terminalLog('Token exists but may not be active:', basicData[0]);
        } else {
          terminalLog('Token does not exist in database at all');
        }
      }
      
      return isValid;
    } catch (error) {
      terminalError('Exception in validateToken:', error);
      return false;
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      terminalLog('Starting login process for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        terminalError('Login error:', error);
        return false;
      }

      if (data.user) {
        terminalLog('Login successful, user:', data.user.email);
        return true;
      }

      terminalLog('Login returned no user');
      return false;
    } catch (error) {
      terminalError('Login error (catch):', error);
      return false;
    }
  };

  const register = async (email: string, password: string, token?: string): Promise<boolean> => {
    try {
      terminalLog('========== STARTING REGISTRATION PROCESS ==========');
      terminalLog('Email:', email);
      terminalLog('Password length:', password.length);
      terminalLog('Token provided:', !!token);
      terminalLog('Token value:', token || 'none');
      terminalLog('Current timestamp:', new Date().toISOString());
      
      // Check Supabase connection first
      terminalLog('Testing Supabase connection before registration...');
      try {
        const { data: connectionTest, error: connectionError } = await supabase
          .from('user_tokens')
          .select('count')
          .limit(1);
        
        if (connectionError) {
          terminalError('Supabase connection test failed:', connectionError);
        } else {
          terminalLog('Supabase connection test successful');
        }
      } catch (connError) {
        terminalError('Exception during connection test:', connError);
      }
      
      // Validate token if provided
      if (token) {
        terminalLog('========== TOKEN VALIDATION PHASE ==========');
        terminalLog('Validating provided token before registration...');
        terminalLog('Token to validate:', token);
        
        const isValidToken = await validateToken(token);
        terminalLog('Pre-registration token validation result:', isValidToken);
        
        if (!isValidToken) {
          terminalError('========== TOKEN VALIDATION FAILED ==========');
          terminalError('Invalid token provided during registration:', token);
          throw new Error('Invalid or expired token');
        }
        terminalLog('========== TOKEN VALIDATION PASSED ==========');
      } else {
        terminalLog('No token provided, proceeding with regular registration');
      }

      // Prepare signup data
      terminalLog('========== PREPARING SIGNUP DATA ==========');
      const signUpData: any = {
        email,
        password,
        options: {
          emailRedirectTo: undefined, // Disable email confirmation
          data: token ? { token } : {} // Include token in metadata if provided
        }
      };

      terminalLog('Complete signUpData object being sent to Supabase:');
      terminalLog('- email:', signUpData.email);
      terminalLog('- password: [REDACTED - length:', signUpData.password.length, ']');
      terminalLog('- options:', JSON.stringify(signUpData.options, null, 2));
      terminalLog('- metadata keys:', Object.keys(signUpData.options.data));
      terminalLog('- metadata token value:', signUpData.options.data.token);
      
      // Check current auth state before signup
      terminalLog('========== PRE-SIGNUP AUTH STATE CHECK ==========');
      try {
        const { data: currentSession, error: sessionError } = await supabase.auth.getSession();
        terminalLog('Current session before signup:', {
          hasSession: !!currentSession.session,
          hasUser: !!currentSession.session?.user,
          userEmail: currentSession.session?.user?.email,
          sessionError: sessionError
        });
      } catch (sessionCheckError) {
        terminalError('Error checking current session:', sessionCheckError);
      }
      
      // Perform the actual signup
      terminalLog('========== EXECUTING SUPABASE SIGNUP ==========');
      terminalLog('Calling supabase.auth.signUp with prepared data...');
      terminalLog('Signup timestamp:', new Date().toISOString());
      
      const { data, error } = await supabase.auth.signUp(signUpData);

      terminalLog('========== SUPABASE SIGNUP RESPONSE ==========');
      terminalLog('Response timestamp:', new Date().toISOString());
      terminalLog('Raw data object:', data);
      terminalLog('Raw error object:', error);
      
      if (data) {
        terminalLog('Data breakdown:');
        terminalLog('- data.user:', data.user);
        terminalLog('- data.session:', data.session);
        
        if (data.user) {
          terminalLog('User details:');
          terminalLog('- user.id:', data.user.id);
          terminalLog('- user.email:', data.user.email);
          terminalLog('- user.email_confirmed_at:', data.user.email_confirmed_at);
          terminalLog('- user.created_at:', data.user.created_at);
          terminalLog('- user.user_metadata:', JSON.stringify(data.user.user_metadata, null, 2));
          terminalLog('- user.app_metadata:', JSON.stringify(data.user.app_metadata, null, 2));
          terminalLog('- user.aud:', data.user.aud);
          terminalLog('- user.role:', data.user.role);
        }
        
        if (data.session) {
          terminalLog('Session details:');
          terminalLog('- session.access_token: [PRESENT]');
          terminalLog('- session.refresh_token: [PRESENT]');
          terminalLog('- session.expires_at:', data.session.expires_at);
          terminalLog('- session.token_type:', data.session.token_type);
        }
      }

      if (error) {
        terminalError('========== SUPABASE SIGNUP ERROR ==========');
        terminalError('Error object:', error);
        terminalError('Error message:', error.message);
        terminalError('Error code:', error.code);
        terminalError('Error status:', error.status);
        
        // Log all error properties
        terminalError('All error properties:');
        Object.keys(error).forEach(key => {
          terminalError(`- error.${key}:`, (error as any)[key]);
        });
        
        // Check if it's a specific type of error
        if (error.message?.includes('Database error')) {
          terminalError('========== DATABASE ERROR DETECTED ==========');
          terminalError('This appears to be a server-side database error');
          terminalError('Possible causes:');
          terminalError('1. RLS policies blocking user creation');
          terminalError('2. Database triggers failing');
          terminalError('3. Foreign key constraints');
          terminalError('4. Missing required columns');
          terminalError('5. Database connection issues');
          
          // Try to get more specific error information
          try {
            terminalLog('========== ATTEMPTING MANUAL PROFILE CREATION ==========');
            const { data: manualProfile, error: manualError } = await supabase
              .rpc('create_user_profile_manual', {
                user_id: data?.user?.id || 'test-id',
                user_email: email,
                user_token: token || null
              });
            
            if (manualError) {
              terminalError('Manual profile creation also failed:', manualError);
            } else {
              terminalLog('Manual profile creation succeeded:', manualProfile);
            }
          } catch (manualTestError) {
            terminalError('Exception during manual profile test:', manualTestError);
          }
        }
        
        return false;
      }

      if (data.user) {
        terminalLog('========== REGISTRATION SUCCESSFUL ==========');
        terminalLog('Registration successful, user:', data.user.email);
        terminalLog('User ID:', data.user.id);
        terminalLog('User metadata after registration:', JSON.stringify(data.user.user_metadata, null, 2));
        terminalLog('Email confirmed:', !!data.user.email_confirmed_at);
        
        // Check if user was created in auth.users
        terminalLog('========== POST-SIGNUP VERIFICATION ==========');
        try {
          const { data: authUser, error: authError } = await supabase.auth.getUser();
          terminalLog('Auth user check result:', { authUser, authError });
        } catch (authCheckError) {
          terminalError('Error checking auth user:', authCheckError);
        }
        
        // Wait a moment for triggers to execute, then manually create profile if needed
        terminalLog('========== PROFILE CREATION PHASE ==========');
        terminalLog('Waiting for database triggers to execute...');
        
        setTimeout(async () => {
          try {
            terminalLog('Checking if profile was created by trigger...');
            terminalLog('Looking for profile with ID:', data.user!.id);
            
            const { data: existingProfile, error: profileError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', data.user!.id)
              .maybeSingle();
            
            terminalLog('Profile check result:');
            terminalLog('- existingProfile:', existingProfile);
            terminalLog('- profileError:', profileError);
            
            if (profileError) {
              terminalError('Error checking for existing profile:', profileError);
            }
            
            if (!existingProfile) {
              terminalLog('========== MANUAL PROFILE CREATION ==========');
              terminalLog('Profile not created by trigger, creating manually...');
              await createUserProfileManually(data.user!);
            } else {
              terminalLog('========== PROFILE EXISTS FROM TRIGGER ==========');
              terminalLog('Profile exists from trigger:', existingProfile);
              terminalLog('Profile role:', existingProfile.role);
              terminalLog('Profile email:', existingProfile.email);
            }
          } catch (error) {
            terminalError('========== PROFILE CHECK/CREATION ERROR ==========');
            terminalError('Error checking/creating profile after registration:', error);
          }
        }, 1000);
        
        terminalLog('========== REGISTRATION PROCESS COMPLETE ==========');
        return true;
      }

      terminalLog('========== UNEXPECTED REGISTRATION STATE ==========');
      terminalLog('Registration returned no user but no error either');
      return false;
    } catch (error) {
      terminalError('========== REGISTRATION EXCEPTION ==========');
      terminalError('Registration error (catch):', error);
      
      if (error instanceof Error) {
        terminalError('Error message:', error.message);
        terminalError('Error stack:', error.stack);
      }
      
      // Log all error properties if it's an object
      if (typeof error === 'object' && error !== null) {
        terminalError('All error properties:');
        Object.keys(error).forEach(key => {
          terminalError(`- error.${key}:`, (error as any)[key]);
        });
      }
      
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      terminalLog('Starting logout process...');
      
      // Clear local state immediately for better UX
      setUser(null);
      setUserProfile(null);
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        terminalError('Logout error:', error);
        throw error;
      }
      
      terminalLog('Logout successful');
    } catch (error) {
      terminalError('Logout error:', error);
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

  terminalLog('Current auth state:', {
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