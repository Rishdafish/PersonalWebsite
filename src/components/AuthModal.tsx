import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
  onAuthSuccess: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [token, setToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenValidated, setTokenValidated] = useState<boolean | null>(null);
  
  const { login, register, validateToken } = useAuth();

  const handleTokenValidation = async (tokenValue: string) => {
    if (!tokenValue.trim()) {
      setTokenValidated(null);
      return;
    }

    console.log('🎫 Validating token in modal:', tokenValue.substring(0, 5) + '...');
    const isValid = await validateToken(tokenValue);
    setTokenValidated(isValid);
    console.log('🎫 Token validation result in modal:', isValid);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('📝 Form submitted:', { isLogin, email, hasToken: !!token });

    try {
      if (!isLogin) {
        // Registration validation
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          return;
        }
        
        // Validate token if provided
        if (token && !tokenValidated) {
          setError('Please enter a valid token or leave empty for regular access');
          return;
        }
      }

      let success = false;
      
      if (isLogin) {
        console.log('🔐 Attempting login...');
        success = await login(email, password);
        if (!success) {
          setError('Invalid email or password. Please check your credentials and try again.');
        }
      } else {
        console.log('📝 Attempting registration...');
        success = await register(email, password, token || undefined);
        if (!success) {
          setError('Registration failed. Please check your details and try again.');
        }
      }

      console.log('✅ Auth operation result:', success);

      if (success) {
        console.log('🎉 Auth successful, calling onAuthSuccess');
        // Add a small delay to allow auth state to update
        setTimeout(() => {
          onAuthSuccess();
        }, 1000);
      }
    } catch (err: any) {
      console.error('❌ Auth error in modal:', err);
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
      console.log('✅ Auth operation complete, loading set to false');
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setToken('');
    setError('');
    setTokenValidated(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  return (
    <div className="auth-modal" onClick={handleOverlayClick}>
      <div className="auth-modal-content">
        <button className="close-button interactive" onClick={onClose}>
          ×
        </button>
        
        <h2>{isLogin ? 'Login' : 'Create Account'}</h2>
        
        {!isLogin && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Account Types:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li><strong>Regular:</strong> Basic access to public content</li>
              <li><strong>Specialized:</strong> Full access with valid token</li>
              <li><strong>Admin:</strong> Full system control (automatic for admin emails)</li>
            </ul>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
            required
            disabled={loading}
          />
          
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input pr-10"
              required
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              disabled={loading}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          
          {!isLogin && (
            <>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="auth-input pr-10"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={loading}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="Specialized Access Token (Optional)"
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    handleTokenValidation(e.target.value);
                  }}
                  className={`auth-input ${
                    token ? (tokenValidated === true ? 'border-green-500' : tokenValidated === false ? 'border-red-500' : '') : ''
                  }`}
                  disabled={loading}
                />
                {token && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    {tokenValidated === true && (
                      <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                    {tokenValidated === false && (
                      <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✗</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {token && tokenValidated === true && (
                <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                  ✓ Valid token - You'll have specialized access
                </div>
              )}
              
              {token && tokenValidated === false && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  ✗ Invalid token - You'll have regular access
                </div>
              )}
            </>
          )}
          
          {error && (
            <div className="error-message">
              {error}
              <div className="text-xs mt-1 text-gray-600">
                Check the browser console (F12) for detailed error information.
              </div>
            </div>
          )}
          
          <button 
            type="submit" 
            className="auth-button interactive"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Processing...</span>
              </div>
            ) : (
              isLogin ? 'Login' : 'Create Account'
            )}
          </button>
        </form>
        
        <div className="auth-toggle">
          <button 
            type="button"
            onClick={toggleMode}
            className="interactive"
            disabled={loading}
          >
            {isLogin ? 'Need an account? Register' : 'Have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;