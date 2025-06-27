import React from 'react';
import { X, Lock } from 'lucide-react';

interface AccessDeniedModalProps {
  onClose: () => void;
  title?: string;
  message?: string;
}

const AccessDeniedModal: React.FC<AccessDeniedModalProps> = ({ 
  onClose, 
  title = "Access Denied",
  message = "You do not have permission to view this page."
}) => {
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50" onClick={handleOverlayClick}>
      <div className="bg-white rounded-2xl p-8 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-red-100 rounded-full">
              <Lock className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-700 text-lg leading-relaxed">{message}</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">Access Levels:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li><strong>Regular:</strong> View blogs and projects</li>
            <li><strong>Enhanced:</strong> Access hours tracking + commenting (requires token)</li>
            <li><strong>Admin:</strong> Full access to all features</li>
          </ul>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccessDeniedModal;