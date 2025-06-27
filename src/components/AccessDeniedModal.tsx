import React from 'react';
import { Lock, Shield, Key } from 'lucide-react';

interface AccessDeniedModalProps {
  onClose: () => void;
  requiredRole?: 'specialized' | 'admin';
  feature?: string;
}

const AccessDeniedModal: React.FC<AccessDeniedModalProps> = ({ 
  onClose, 
  requiredRole = 'specialized',
  feature = 'this feature'
}) => {
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50" onClick={handleOverlayClick}>
      <div className="bg-white rounded-2xl p-8 w-full max-w-md mx-4 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            {requiredRole === 'admin' ? (
              <Shield className="w-8 h-8 text-red-600" />
            ) : (
              <Lock className="w-8 h-8 text-red-600" />
            )}
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Restricted</h2>
          
          <p className="text-gray-600 mb-6">
            {requiredRole === 'admin' 
              ? `You need administrator privileges to access ${feature}.`
              : `You need specialized access to use ${feature}. Please contact an administrator for a specialized access token.`
            }
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-700">
              <Key className="w-4 h-4" />
              <span>
                {requiredRole === 'admin' 
                  ? 'Admin access required'
                  : 'Specialized token required'
                }
              </span>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccessDeniedModal;