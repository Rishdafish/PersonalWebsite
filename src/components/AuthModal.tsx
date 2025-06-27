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
  
  const { login, register, validateToken, isSupabaseConfigured } = useAuth();

  const handleTokenValidation = async (tokenValue: string) => {
    if (!tokenValue.trim()) {
      setTokenValidated(null);
      return;
    }

    if (!isSupabaseConfigured) {
      setTokenValidated(false);
      return;
    }

    const isValid = await validateToken(tokenValue);
    setTokenValidated(isValid);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Check if Supabase is configured
      if (!isSupabaseConfigured) {
        setError('Authentication service is not configured. Please contact the administrator.');
        setLoading(false);
        return;
      }

      if (!isLogin) {
        // Registration validation
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        
        // Validate token if provided
        if (token && !tokenValidated) {
          setError('Please enter a valid token or leave empty for regular access');
          setLoading(false);
          return;
        }
      }

      let success = false;
      
      if (isLogin) {
        success = await login(email, password);
      } else {
        success = await register(email, password, token || undefined);
      }

      if (success) {
        onAuthSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.');
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

  return (
    <div className="auth-modal" onClick={handleOverlayClick}>
      <div className="auth-modal-content">
        <button className="close-button interactive" onClick={onClose}>
          ×
        </button>
        
        <h2>{isLogin ? 'Login' : 'Create Account'}</h2>
        
        {!isSupabaseConfigured && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">
              ⚠️ Authentication service is not configured. Please contact the administrator to set up the database connection.
            </p>
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
            disabled={!isSupabaseConfigured}
          />
          
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            required
            disabled={!isSupabaseConfigured}
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
                disabled={!isSupabaseConfigured}
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
                  disabled={!isSupabaseConfigured}
                />
                {token && isSupabaseConfigured && (
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
          
          {error && <div className="error-message">{error}</div>}
          
          <button 
            type="submit" 
            className="auth-button interactive"
            disabled={loading || !isSupabaseConfigured}
          >
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Create Account')}
          </button>
        </form>
        
        <div className="auth-toggle">
          <button 
            type="button"
            onClick={toggleMode}
            className="interactive"
            disabled={!isSupabaseConfigured}
          >
            {isLogin ? 'Need an account? Register' : 'Have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;