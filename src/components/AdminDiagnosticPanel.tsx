import React, { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, RefreshCw, Settings, User, Database, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AdminDiagnostic } from '../utils/adminDiagnostic';

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

const AdminDiagnosticPanel: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [fixResult, setFixResult] = useState<{ success: boolean; message: string } | null>(null);

  const runDiagnostic = async () => {
    setIsRunning(true);
    setFixResult(null);
    
    try {
      const result = await AdminDiagnostic.runComprehensiveDiagnostic();
      setDiagnosticResult(result);
    } catch (error) {
      console.error('Diagnostic failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const fixPermissions = async () => {
    if (!user?.id || !user?.email) {
      setFixResult({
        success: false,
        message: 'Cannot fix permissions - user information missing'
      });
      return;
    }

    setIsFixing(true);
    
    try {
      const result = await AdminDiagnostic.fixAdminPermissions(user.id, user.email);
      setFixResult(result);
      
      if (result.success) {
        // Re-run diagnostic to show updated status
        setTimeout(() => {
          runDiagnostic();
        }, 1000);
      }
    } catch (error) {
      setFixResult({
        success: false,
        message: `Fix failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsFixing(false);
    }
  };

  const getStatusIcon = (isGood: boolean) => {
    return isGood ? (
      <CheckCircle className="w-5 h-5 text-green-500" />
    ) : (
      <AlertTriangle className="w-5 h-5 text-red-500" />
    );
  };

  const getStatusColor = (isGood: boolean) => {
    return isGood ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200';
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Lock className="w-5 h-5 text-yellow-600" />
            <span className="text-yellow-800">Please log in to access the diagnostic panel</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Diagnostic Panel</h1>
              <p className="text-gray-600">Diagnose and fix admin permission issues</p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={runDiagnostic}
              disabled={isRunning}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
              <span>{isRunning ? 'Running...' : 'Run Diagnostic'}</span>
            </button>
            
            {diagnosticResult && diagnosticResult.issues.length > 0 && (
              <button
                onClick={fixPermissions}
                disabled={isFixing}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <Settings className={`w-4 h-4 ${isFixing ? 'animate-spin' : ''}`} />
                <span>{isFixing ? 'Fixing...' : 'Fix Issues'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fix Result */}
      {fixResult && (
        <div className={`rounded-lg p-4 border ${getStatusColor(fixResult.success)}`}>
          <div className="flex items-center space-x-2">
            {getStatusIcon(fixResult.success)}
            <span className="font-medium">
              {fixResult.success ? 'Fix Applied Successfully' : 'Fix Failed'}
            </span>
          </div>
          <p className="mt-2">{fixResult.message}</p>
        </div>
      )}

      {/* Diagnostic Results */}
      {diagnosticResult && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Authentication Status */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <User className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold">Authentication Status</h2>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Authenticated</span>
                {getStatusIcon(diagnosticResult.authStatus.isAuthenticated)}
              </div>
              <div className="flex items-center justify-between">
                <span>Session Valid</span>
                {getStatusIcon(diagnosticResult.authStatus.sessionValid)}
              </div>
              {diagnosticResult.authStatus.userEmail && (
                <div className="text-sm text-gray-600">
                  <strong>Email:</strong> {diagnosticResult.authStatus.userEmail}
                </div>
              )}
              {diagnosticResult.authStatus.userId && (
                <div className="text-sm text-gray-600">
                  <strong>User ID:</strong> {diagnosticResult.authStatus.userId.substring(0, 8)}...
                </div>
              )}
            </div>
          </div>

          {/* Profile Status */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Shield className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-semibold">Profile Status</h2>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Profile Exists</span>
                {getStatusIcon(diagnosticResult.profileStatus.profileExists)}
              </div>
              {diagnosticResult.profileStatus.currentRole && (
                <div className="text-sm text-gray-600">
                  <strong>Current Role:</strong> {diagnosticResult.profileStatus.currentRole}
                </div>
              )}
              {diagnosticResult.profileStatus.expectedRole && (
                <div className="text-sm text-gray-600">
                  <strong>Expected Role:</strong> {diagnosticResult.profileStatus.expectedRole}
                </div>
              )}
              {diagnosticResult.profileStatus.currentRole !== diagnosticResult.profileStatus.expectedRole && (
                <div className="text-sm text-red-600 font-medium">
                  ⚠️ Role mismatch detected
                </div>
              )}
            </div>
          </div>

          {/* Permissions Status */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Lock className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-semibold">Permissions</h2>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Admin Access</span>
                {getStatusIcon(diagnosticResult.permissionsStatus.isAdmin)}
              </div>
              <div className="flex items-center justify-between">
                <span>Hours Access</span>
                {getStatusIcon(diagnosticResult.permissionsStatus.hasHoursAccess)}
              </div>
              <div className="flex items-center justify-between">
                <span>Can Comment</span>
                {getStatusIcon(diagnosticResult.permissionsStatus.canComment)}
              </div>
              <div className="flex items-center justify-between">
                <span>Can Edit Content</span>
                {getStatusIcon(diagnosticResult.permissionsStatus.canEditContent)}
              </div>
            </div>
          </div>

          {/* Database Status */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Database className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-semibold">Database Status</h2>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span>Enum Types</span>
                {getStatusIcon(diagnosticResult.databaseStatus.userRoleEnumExists)}
              </div>
              <div className="flex items-center justify-between">
                <span>Triggers Active</span>
                {getStatusIcon(diagnosticResult.databaseStatus.triggersActive)}
              </div>
              <div className="flex items-center justify-between">
                <span>Policies Active</span>
                {getStatusIcon(diagnosticResult.databaseStatus.policiesActive)}
              </div>
              <div className="flex items-center justify-between">
                <span>RPC Functions</span>
                {getStatusIcon(diagnosticResult.databaseStatus.rpcFunctionsAvailable)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Access Status */}
      {diagnosticResult && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Data Access Status</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                {getStatusIcon(diagnosticResult.dataAccess.canAccessProjects)}
              </div>
              <h3 className="font-medium">Projects</h3>
              <p className="text-sm text-gray-600">
                {diagnosticResult.dataAccess.canAccessProjects 
                  ? `${diagnosticResult.dataAccess.projectsCount} projects found`
                  : 'Access denied'
                }
              </p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                {getStatusIcon(diagnosticResult.dataAccess.canAccessBlogPosts)}
              </div>
              <h3 className="font-medium">Blog Posts</h3>
              <p className="text-sm text-gray-600">
                {diagnosticResult.dataAccess.canAccessBlogPosts 
                  ? `${diagnosticResult.dataAccess.blogPostsCount} posts found`
                  : 'Access denied'
                }
              </p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                {getStatusIcon(diagnosticResult.dataAccess.canAccessUserData)}
              </div>
              <h3 className="font-medium">User Data</h3>
              <p className="text-sm text-gray-600">
                {diagnosticResult.dataAccess.canAccessUserData 
                  ? 'Access granted'
                  : 'Access denied'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Issues and Recommendations */}
      {diagnosticResult && (diagnosticResult.issues.length > 0 || diagnosticResult.recommendations.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Issues */}
          {diagnosticResult.issues.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-red-800 mb-4">Issues Found</h2>
              <ul className="space-y-2">
                {diagnosticResult.issues.map((issue, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-red-700">{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {diagnosticResult.recommendations.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-blue-800 mb-4">Recommendations</h2>
              <ul className="space-y-2">
                {diagnosticResult.recommendations.map((recommendation, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span className="text-blue-700">{recommendation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Success Message */}
      {diagnosticResult && diagnosticResult.issues.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <h2 className="text-xl font-semibold text-green-800">All Systems Operational</h2>
              <p className="text-green-700">Your admin account is working correctly with full permissions and data access.</p>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostic Timestamp */}
      {diagnosticResult && (
        <div className="text-center text-sm text-gray-500">
          Last diagnostic run: {new Date(diagnosticResult.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default AdminDiagnosticPanel;