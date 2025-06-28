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
  const [debugInfo, setDebugInfo] = useState<string>('');
  
  const { login, register, validateToken } = useAuth();

  // Debug function for modal
  const modalDebug = (message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const debugMessage = `[${timestamp}] ${message}`;
    console.log('🔐 [AUTH MODAL]', debugMessage, data || '');
    setDebugInfo(prev => `${prev}\n${debugMessage}`);
  };

  const handleTokenValidation = async (tokenValue: string) => {
    if (!tokenValue.trim()) {
      modalDebug('Empty token, resetting validation state');
      setTokenValidated(null);
      return;
    }

    modalDebug('Starting token validation', { token: tokenValue, length: tokenValue.length });
    
    try {
      const isValid = await validateToken(tokenValue);
      setTokenValidated(isValid);
      modalDebug('Token validation result', { isValid });
      
      if (isValid) {
        alert('✅ Token is valid! You will have specialized access.');
      } else {
        alert('❌ Token is invalid. You will have regular access.');
      }
    } catch (error) {
      modalDebug('Token validation error', error);
      setTokenValidated(false);
      alert('❌ Error validating token. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    modalDebug('Form submitted', { 
      isLogin, 
      email, 
      hasToken: !!token,
      tokenValidated
    });

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
        if (token && tokenValidated !== true) {
          modalDebug('Token validation failed before submission', {
            token,
            tokenValidated
          });
          setError('Please enter a valid token or leave empty for regular access');
          return;
        }
      }

      let success = false;
      
      if (isLogin) {
        modalDebug('Attempting login');
        success = await login(email, password);
        if (!success) {
          setError('Invalid email or password. Please check your credentials and try again.');
          alert('❌ Login failed. Please check your credentials.');
        }
      } else {
        modalDebug('Attempting registration', { hasToken: !!token });
        success = await register(email, password, token || undefined);
        if (!success) {
          setError('Registration failed. Please check your details and try again.');
          alert('❌ Registration failed. Please try again.');
        }
      }

      modalDebug('Auth operation result', { success });

      if (success) {
        modalDebug('Auth successful, calling onAuthSuccess');
        alert('✅ Authentication successful!');
        resetForm();
        onAuthSuccess();
      }
    } catch (err: any) {
      modalDebug('Auth error in modal', err);
      setError(err.message || 'An error occurred. Please try again.');
      alert(`❌ Authentication error: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      resetForm();
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
    setLoading(false);
    setDebugInfo('');
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newToken = e.target.value;
    modalDebug('Token input changed', { newValue: newToken, length: newToken.length });
    
    setToken(newToken);
    handleTokenValidation(newToken);
  };

  return (
    <div className="auth-modal" onClick={handleOverlayClick}>
      <div className="auth-modal-content">
        <button className="close-button interactive" onClick={handleClose} disabled={loading}>
          ×
        </button>
        
        <h2>{isLogin ? 'Login' : 'Create Account'}</h2>
        
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
              className="auth-input"
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
                  className="auth-input"
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
                  onChange={handleTokenChange}
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
            </div>
          )}

          {/* Debug Information */}
          {debugInfo && (
            <details className="text-xs bg-gray-100 p-2 rounded">
              <summary className="cursor-pointer font-medium">Debug Information</summary>
              <pre className="mt-2 whitespace-pre-wrap">{debugInfo}</pre>
            </details>
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