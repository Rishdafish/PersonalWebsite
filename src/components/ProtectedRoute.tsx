import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [showAuthModal, setShowAuthModal] = React.useState(!isAuthenticated);

  React.useEffect(() => {
    setShowAuthModal(!isAuthenticated);
  }, [isAuthenticated]);

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

  return <>{children}</>;
};

export default ProtectedRoute;