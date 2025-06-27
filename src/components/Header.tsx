import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, Shield, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import AccessDeniedModal from './AccessDeniedModal';

const Header: React.FC = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin, isSpecialized, canAccessHours } = useAuth();

  const isProjectsPage = location.pathname === '/projects';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleUserIconClick = () => {
    if (user) {
      logout();
    } else {
      setShowAuthModal(true);
    }
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
  };

  const handleHoursClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDropdownOpen(false);
    
    if (!canAccessHours) {
      setShowAccessDenied(true);
    } else {
      navigate('/hours');
    }
  };

  const getRoleIcon = () => {
    if (isAdmin) return <Shield size={12} className="text-red-500" />;
    if (isSpecialized) return <Star size={12} className="text-yellow-500" />;
    return null;
  };

  const getRoleText = () => {
    if (isAdmin) return 'Admin';
    if (isSpecialized) return 'Enhanced';
    return 'Regular';
  };

  return (
    <>
      <header className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50">
        <div className={`header-container ${isProjectsPage ? 'inverse' : ''}`}>
          <Link to="/" className={`logo-text ${isProjectsPage ? 'inverse' : ''}`}>
            RISHI
          </Link>
          
          <Link to="/projects" className={`projects-btn ${isProjectsPage ? 'inverse' : ''} interactive`}>
            Projects
          </Link>
          
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={toggleDropdown}
              className={`nine-dot-menu ${isProjectsPage ? 'inverse' : ''} interactive`}
            >
              <div className="nine-dots">
                <div className={`dot ${isProjectsPage ? 'inverse' : ''}`}></div>
                <div className={`dot ${isProjectsPage ? 'inverse' : ''}`}></div>
                <div className={`dot ${isProjectsPage ? 'inverse' : ''}`}></div>
                <div className={`dot ${isProjectsPage ? 'inverse' : ''}`}></div>
                <div className={`dot ${isProjectsPage ? 'inverse' : ''}`}></div>
                <div className={`dot ${isProjectsPage ? 'inverse' : ''}`}></div>
                <div className={`dot ${isProjectsPage ? 'inverse' : ''}`}></div>
                <div className={`dot ${isProjectsPage ? 'inverse' : ''}`}></div>
                <div className={`dot ${isProjectsPage ? 'inverse' : ''}`}></div>
              </div>
            </button>
            
            {isDropdownOpen && (
              <div className={`dropdown-menu ${isProjectsPage ? 'inverse' : ''}`}>
                <Link 
                  to="/blog" 
                  className={`dropdown-item ${isProjectsPage ? 'inverse' : ''} interactive`}
                  onClick={() => setIsDropdownOpen(false)}
                >
                  Blog
                </Link>
                <button
                  onClick={handleHoursClick}
                  className={`dropdown-item ${isProjectsPage ? 'inverse' : ''} interactive w-full text-left`}
                >
                  Hours {!canAccessHours && <span className="text-xs opacity-60">(Enhanced)</span>}
                </button>
              </div>
            )}
          </div>
          
          <span className={`separator ${isProjectsPage ? 'inverse' : ''}`}>||</span>
          
          <div className={`user-section ${isProjectsPage ? 'inverse' : ''}`}>
            {user && (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  {getRoleIcon()}
                  <span className="text-xs">{getRoleText()}</span>
                </div>
                <span className="text-sm">{user.email}</span>
              </div>
            )}
            <button 
              onClick={handleUserIconClick}
              className={`user-icon ${isProjectsPage ? 'inverse' : ''} interactive`}
              title={user ? 'Logout' : 'Login / Register'}
            >
              <User size={16} />
            </button>
          </div>
        </div>
      </header>

      {showAuthModal && (
        <AuthModal 
          onClose={() => setShowAuthModal(false)}
          onAuthSuccess={handleAuthSuccess}
        />
      )}

      {showAccessDenied && (
        <AccessDeniedModal
          onClose={() => setShowAccessDenied(false)}
          title="Hours Access Restricted"
          message="You need enhanced access to view the hours tracking page. Register with a valid token to get enhanced access, or contact an administrator."
        />
      )}
    </>
  );
};

export default Header;