import { supabase } from '../lib/supabase';

interface DiagnosticResult {
  timestamp: string;
  authStatus: {
    isAuthenticated: boolean;
    userId?: string;
    userEmail?: string;
    sessionValid: boolean;
  };
  profileStatus: {
    profileExists: boolean;
    currentRole?: string;
    expectedRole?: string;
    profileData?: any;
  };
  permissionsStatus: {
    isAdmin: boolean;
    isSpecialized: boolean;
    isRegular: boolean;
    hasHoursAccess: boolean;
    canComment: boolean;
    canEditContent: boolean;
  };
  dataAccess: {
    canAccessProjects: boolean;
    canAccessBlogPosts: boolean;
    canAccessUserData: boolean;
    projectsCount: number;
    blogPostsCount: number;
  };
  databaseStatus: {
    userRoleEnumExists: boolean;
    triggersActive: boolean;
    policiesActive: boolean;
    rpcFunctionsAvailable: boolean;
  };
  issues: string[];
  recommendations: string[];
}

export class AdminDiagnostic {
  private static debugLog(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    console.log(`🔍 [ADMIN DIAGNOSTIC] ${timestamp}: ${message}`, data || '');
  }

  private static debugError(message: string, error?: any) {
    const timestamp = new Date().toISOString();
    console.error(`❌ [ADMIN DIAGNOSTIC] ${timestamp}: ${message}`, error);
  }

  static async runComprehensiveDiagnostic(): Promise<DiagnosticResult> {
    this.debugLog('🚀 Starting comprehensive admin diagnostic...');
    
    const result: DiagnosticResult = {
      timestamp: new Date().toISOString(),
      authStatus: {
        isAuthenticated: false,
        sessionValid: false
      },
      profileStatus: {
        profileExists: false
      },
      permissionsStatus: {
        isAdmin: false,
        isSpecialized: false,
        isRegular: false,
        hasHoursAccess: false,
        canComment: false,
        canEditContent: false
      },
      dataAccess: {
        canAccessProjects: false,
        canAccessBlogPosts: false,
        canAccessUserData: false,
        projectsCount: 0,
        blogPostsCount: 0
      },
      databaseStatus: {
        userRoleEnumExists: false,
        triggersActive: false,
        policiesActive: false,
        rpcFunctionsAvailable: false
      },
      issues: [],
      recommendations: []
    };

    try {
      // Step 1: Check authentication status
      this.debugLog('Step 1: Checking authentication status...');
      await this.checkAuthStatus(result);

      // Step 2: Check user profile
      this.debugLog('Step 2: Checking user profile...');
      await this.checkUserProfile(result);

      // Step 3: Check database schema
      this.debugLog('Step 3: Checking database schema...');
      await this.checkDatabaseSchema(result);

      // Step 4: Check data access
      this.debugLog('Step 4: Checking data access...');
      await this.checkDataAccess(result);

      // Step 5: Analyze issues and provide recommendations
      this.debugLog('Step 5: Analyzing issues...');
      this.analyzeIssues(result);

      this.debugLog('✅ Diagnostic complete', result);
      return result;

    } catch (error) {
      this.debugError('Exception during diagnostic', error);
      result.issues.push(`Diagnostic failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return result;
    }
  }

  private static async checkAuthStatus(result: DiagnosticResult) {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        this.debugError('Auth session error', error);
        result.issues.push(`Authentication error: ${error.message}`);
        return;
      }

      if (session?.user) {
        result.authStatus = {
          isAuthenticated: true,
          userId: session.user.id,
          userEmail: session.user.email || undefined,
          sessionValid: true
        };
        this.debugLog('✅ User is authenticated', {
          userId: session.user.id,
          email: session.user.email
        });
      } else {
        result.authStatus = {
          isAuthenticated: false,
          sessionValid: false
        };
        result.issues.push('User is not authenticated');
      }
    } catch (error) {
      this.debugError('Exception checking auth status', error);
      result.issues.push(`Auth check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async checkUserProfile(result: DiagnosticResult) {
    if (!result.authStatus.userId) {
      result.issues.push('Cannot check profile - no user ID');
      return;
    }

    try {
      // Check if profile exists
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', result.authStatus.userId)
        .maybeSingle();

      if (profileError) {
        this.debugError('Profile query error', profileError);
        result.issues.push(`Profile query error: ${profileError.message}`);
        return;
      }

      if (profile) {
        result.profileStatus = {
          profileExists: true,
          currentRole: profile.role,
          expectedRole: this.getExpectedRole(result.authStatus.userEmail),
          profileData: profile
        };

        // Set permissions based on role
        result.permissionsStatus = {
          isAdmin: profile.role === 'admin',
          isSpecialized: profile.role === 'specialized',
          isRegular: profile.role === 'regular',
          hasHoursAccess: profile.role === 'admin' || profile.role === 'specialized',
          canComment: profile.role === 'admin' || profile.role === 'specialized',
          canEditContent: profile.role === 'admin'
        };

        this.debugLog('✅ Profile found', {
          role: profile.role,
          email: profile.email,
          tokenUsed: profile.token_used
        });

        // Check if role matches expected
        const expectedRole = this.getExpectedRole(result.authStatus.userEmail);
        if (profile.role !== expectedRole) {
          result.issues.push(`Role mismatch: current=${profile.role}, expected=${expectedRole}`);
        }
      } else {
        result.profileStatus.profileExists = false;
        result.issues.push('User profile does not exist');
      }
    } catch (error) {
      this.debugError('Exception checking user profile', error);
      result.issues.push(`Profile check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async checkDatabaseSchema(result: DiagnosticResult) {
    try {
      // Check if user_role enum exists
      const { data: enumData, error: enumError } = await supabase
        .rpc('verify_signup_setup');

      if (enumError) {
        this.debugError('Schema verification error', enumError);
        result.issues.push(`Schema verification failed: ${enumError.message}`);
      } else if (enumData) {
        result.databaseStatus = {
          userRoleEnumExists: enumData.enum_exists || false,
          triggersActive: enumData.trigger_exists || false,
          policiesActive: (enumData.policies_count || 0) >= 4,
          rpcFunctionsAvailable: enumData.function_exists || false
        };

        this.debugLog('✅ Database schema status', result.databaseStatus);

        if (!result.databaseStatus.userRoleEnumExists) {
          result.issues.push('user_role enum type is missing');
        }
        if (!result.databaseStatus.triggersActive) {
          result.issues.push('Signup triggers are not active');
        }
        if (!result.databaseStatus.policiesActive) {
          result.issues.push('Required RLS policies are missing');
        }
        if (!result.databaseStatus.rpcFunctionsAvailable) {
          result.issues.push('Required RPC functions are missing');
        }
      }
    } catch (error) {
      this.debugError('Exception checking database schema', error);
      result.issues.push(`Schema check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static async checkDataAccess(result: DiagnosticResult) {
    if (!result.authStatus.userId) {
      result.issues.push('Cannot check data access - no user ID');
      return;
    }

    try {
      // Test projects access
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('count')
        .eq('user_id', result.authStatus.userId);

      if (projectsError) {
        this.debugError('Projects access error', projectsError);
        result.issues.push(`Projects access error: ${projectsError.message}`);
      } else {
        result.dataAccess.canAccessProjects = true;
        result.dataAccess.projectsCount = projects?.length || 0;
        this.debugLog('✅ Projects access working', { count: result.dataAccess.projectsCount });
      }

      // Test blog posts access
      const { data: blogPosts, error: blogError } = await supabase
        .from('blog_posts')
        .select('count')
        .eq('user_id', result.authStatus.userId);

      if (blogError) {
        this.debugError('Blog posts access error', blogError);
        result.issues.push(`Blog posts access error: ${blogError.message}`);
      } else {
        result.dataAccess.canAccessBlogPosts = true;
        result.dataAccess.blogPostsCount = blogPosts?.length || 0;
        this.debugLog('✅ Blog posts access working', { count: result.dataAccess.blogPostsCount });
      }

      // Test user data access
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', result.authStatus.userId)
        .maybeSingle();

      if (userError) {
        this.debugError('User data access error', userError);
        result.issues.push(`User data access error: ${userError.message}`);
      } else {
        result.dataAccess.canAccessUserData = !!userData;
        this.debugLog('✅ User data access working', { hasData: !!userData });
      }

    } catch (error) {
      this.debugError('Exception checking data access', error);
      result.issues.push(`Data access check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static getExpectedRole(email?: string): 'admin' | 'regular' | 'specialized' {
    if (!email) return 'regular';
    
    const adminEmails = ['rishabh.biry@gmail.com', 'biryrishabh01@gmail.com', 'biryrishabh@gmail.com'];
    return adminEmails.includes(email) ? 'admin' : 'regular';
  }

  private static analyzeIssues(result: DiagnosticResult) {
    // Analyze issues and provide recommendations
    if (!result.authStatus.isAuthenticated) {
      result.recommendations.push('Please log in to your account');
      return;
    }

    if (!result.profileStatus.profileExists) {
      result.recommendations.push('Create user profile using manual creation function');
    }

    if (result.profileStatus.currentRole !== result.profileStatus.expectedRole) {
      result.recommendations.push(`Update user role from ${result.profileStatus.currentRole} to ${result.profileStatus.expectedRole}`);
    }

    if (!result.databaseStatus.userRoleEnumExists) {
      result.recommendations.push('Run database migration to create user_role enum');
    }

    if (!result.databaseStatus.triggersActive || !result.databaseStatus.rpcFunctionsAvailable) {
      result.recommendations.push('Run database migration to create required functions and triggers');
    }

    if (!result.dataAccess.canAccessProjects || !result.dataAccess.canAccessBlogPosts) {
      result.recommendations.push('Check RLS policies for data access');
    }

    if (result.issues.length === 0) {
      result.recommendations.push('All systems appear to be working correctly');
    }
  }

  static async fixAdminPermissions(userId: string, userEmail: string): Promise<{ success: boolean; message: string }> {
    this.debugLog('🔧 Starting admin permissions fix...', { userId, userEmail });

    try {
      // Step 1: Try to create/update profile using manual function
      const { data: profileData, error: profileError } = await supabase
        .rpc('create_user_profile_manual', {
          p_user_id: userId,
          p_user_email: userEmail,
          p_user_token: null
        });

      if (profileError) {
        this.debugError('Manual profile creation failed', profileError);
        return {
          success: false,
          message: `Failed to create/update profile: ${profileError.message}`
        };
      }

      this.debugLog('✅ Profile created/updated successfully', profileData);

      // Step 2: Verify the fix worked
      const diagnostic = await this.runComprehensiveDiagnostic();
      
      if (diagnostic.issues.length === 0) {
        return {
          success: true,
          message: 'Admin permissions restored successfully'
        };
      } else {
        return {
          success: false,
          message: `Partial fix applied. Remaining issues: ${diagnostic.issues.join(', ')}`
        };
      }

    } catch (error) {
      this.debugError('Exception during admin fix', error);
      return {
        success: false,
        message: `Fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}