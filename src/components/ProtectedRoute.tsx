import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import AccessDeniedModal from './AccessDeniedModal';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: 'admin' | 'specialized' | 'authenticated';
  feature?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireRole = 'authenticated',
  feature = 'this page'
}) => {
  const { isAuthenticated, isAdmin, isSpecialized, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if user is authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="mb-8">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4 clean-font">
              Authentication Required
            </h2>
            <p className="text-gray-300 mb-6 clean-font">
              Please log in to access {feature}. Create an account if you don't have one yet.
            </p>
          </div>
          <button
            onClick={() => setShowAuthModal(true)}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Login / Register
          </button>
        </div>
        {showAuthModal && (
          <AuthModal 
            onClose={() => setShowAuthModal(false)}
            onAuthSuccess={() => setShowAuthModal(false)}
          />
        )}
      </div>
    );
  }

  // Check role-based access
  if (requireRole === 'admin' && !isAdmin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="mb-8">
            <div className="w-16 h-16 bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4 clean-font">
              Access Denied
            </h2>
            <p className="text-gray-300 mb-6 clean-font">
              Administrator privileges are required to access {feature}. Contact an administrator if you believe this is an error.
            </p>
          </div>
          <button
            onClick={() => setShowAccessDenied(true)}
            className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Learn More
          </button>
        </div>
        {showAccessDenied && (
          <AccessDeniedModal 
            onClose={() => setShowAccessDenied(false)}
            requiredRole="admin"
            feature={feature}
          />
        )}
      </div>
    );
  }

  if (requireRole === 'specialized' && !isSpecialized && !isAdmin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="mb-8">
            <div className="w-16 h-16 bg-orange-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-4 clean-font">
              Specialized Access Required
            </h2>
            <p className="text-gray-300 mb-6 clean-font">
              You need specialized access to use {feature}. Contact an administrator for a specialized access token, then create a new account with that token.
            </p>
          </div>
          <button
            onClick={() => setShowAccessDenied(true)}
            className="px-8 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
          >
            Learn More
          </button>
        </div>
        {showAccessDenied && (
          <AccessDeniedModal 
            onClose={() => setShowAccessDenied(false)}
            requiredRole="specialized"
            feature={feature}
          />
        )}
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;