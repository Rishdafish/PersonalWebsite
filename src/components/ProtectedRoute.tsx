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
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4 clean-font">
            Authentication Required
          </h2>
          <p className="text-gray-300 mb-6 clean-font">
            Please log in to access {feature}
          </p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4 clean-font">
            Access Denied
          </h2>
          <p className="text-gray-300 mb-6 clean-font">
            Administrator privileges required to access {feature}
          </p>
          <button
            onClick={() => setShowAccessDenied(true)}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
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
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4 clean-font">
            Access Denied
          </h2>
          <p className="text-gray-300 mb-6 clean-font">
            Specialized access required to use {feature}
          </p>
          <button
            onClick={() => setShowAccessDenied(true)}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
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