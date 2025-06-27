import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenValidated, setTokenValidated] = useState<boolean | null>(null);
  
  const { login, register, validateToken, isSupabaseConfigured, connectionError } = useAuth();

  const handleTokenValidation = async (tokenValue: string) => {
    if (!tokenValue.trim()) {
      setTokenValidated(null);
      return;
    }

    if (!isSupabaseConfigured) {
      setTokenValidated(false);
      return;
    }

    try {
      const isValid = await validateToken(tokenValue);
      setTokenValidated(isValid);
    } catch (error) {
      console.error('Token validation error:', error);
      setTokenValidated(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Check if Supabase is configured
      if (!isSupabaseConfigured) {
        setError('Authentication service is not configured. Please contact the administrator to set up the database connection.');
        return;
      }

      // Check for connection errors
      if (connectionError) {
        setError(connectionError);
        return;
      }

      // Basic validation
      if (!email.trim()) {
        setError('Please enter your email address.');
        return;
      }

      if (!password.trim()) {
        setError('Please enter your password.');
        return;
      }

      if (!isLogin) {
        // Registration validation
        if (password !== confirmPassword) {
          setError('Passwords do not match. Please check and try again.');
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters long.');
          return;
        }
        
        // Validate token if provided
        if (token && tokenValidated === false) {
          setError('The access token you entered is invalid. Please check the token or leave it empty for regular access.');
          return;
        }
      }

      let success = false;
      
      if (isLogin) {
        success = await login(email.trim(), password);
      } else {
        success = await register(email.trim(), password, token.trim() || undefined);
      }

      if (success) {
        onAuthSuccess();
        onClose();
      } else {
        setError('Authentication failed. Please try again.');
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
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
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  // Show connection error if present
  const displayError = error || connectionError;
  const isDisabled = loading || !isSupabaseConfigured || !!connectionError;

  return (
    <div className="auth-modal" onClick={handleOverlayClick}>
      <div className="auth-modal-content">
        <button className="close-button interactive" onClick={onClose}>
          ×
        </button>
        
        <h2>{isLogin ? 'Login' : 'Create Account'}</h2>
        
        {(!isSupabaseConfigured || connectionError) && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-medium text-red-800">Service Unavailable</h3>
                <p className="text-red-700 text-sm mt-1">
                  {connectionError || 'The authentication service is not configured. Please contact the administrator to set up the database connection.'}
                </p>
              </div>
            </div>
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
            disabled={isDisabled}
          />
          
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            required
            disabled={isDisabled}
          />
          
          {!isLogin && (
            <>
              <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="auth-input"
                required
                disabled={isDisabled}
              />
              
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
                  disabled={isDisabled}
                />
                {token && isSupabaseConfigured && !connectionError && (
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
          
          {displayError && (
            <div className="error-message bg-red-50 border border-red-200 rounded p-3">
              <div className="flex items-start space-x-2">
                <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-red-800 text-sm">{displayError}</span>
              </div>
            </div>
          )}
          
          <button 
            type="submit" 
            className="auth-button interactive"
            disabled={isDisabled}
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
            disabled={isDisabled}
          >
            {isLogin ? 'Need an account? Register' : 'Have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;