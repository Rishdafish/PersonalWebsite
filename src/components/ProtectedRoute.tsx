import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresHoursAccess?: boolean;
  requiresAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiresHoursAccess = false,
  requiresAdmin = false 
}) => {
  const { isAuthenticated, canAccessHours, isAdmin, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = React.useState(false);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
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
            Access Restricted
          </h2>
          <p className="text-gray-300 mb-6 clean-font">
            Please log in to access this page
          </p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors"
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

  // Check admin access
  if (requiresAdmin && !isAdmin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4 clean-font">
            Admin Access Required
          </h2>
          <p className="text-gray-300 mb-6 clean-font">
            You don't have permission to access this page
          </p>
        </div>
      </div>
    );
  }

  // Check hours access
  if (requiresHoursAccess && !canAccessHours) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4 clean-font">
            Enhanced Access Required
          </h2>
          <p className="text-gray-300 mb-6 clean-font">
            You need enhanced access (specialized or admin role) to view the hours tracking page.
            <br />
            Register with a valid token to get enhanced access.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;