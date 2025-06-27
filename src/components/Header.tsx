import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User, Crown, Key, UserCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

const Header: React.FC = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { user, logout, isAuthenticated, isAdmin, isSpecialized, isRegular } = useAuth();

  const isProjectsPage = location.pathname === '/projects';
  const isBlogPage = location.pathname === '/blog';

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

  const handleUserIconClick = async () => {
    console.log('🖱️ User icon clicked, authenticated:', isAuthenticated);
    
    if (isAuthenticated && user) {
      console.log('👋 Attempting to logout user:', user.email);
      try {
        await logout();
        console.log('✅ Logout completed successfully');
        // Force page refresh to ensure clean state
        window.location.href = '/';
      } catch (error) {
        console.error('❌ Logout failed:', error);
      }
    } else {
      console.log('🔐 Opening auth modal for login');
      setShowAuthModal(true);
    }
  };

  const handleAuthSuccess = () => {
    console.log('🎉 Auth success, closing modal');
    setShowAuthModal(false);
  };

  const getRoleIcon = () => {
    if (isAdmin) return <Crown size={14} className="text-yellow-500" />;
    if (isSpecialized) return <Key size={14} className="text-blue-500" />;
    if (isRegular) return <UserCheck size={14} className="text-gray-500" />;
    return null;
  };

  const getRoleText = () => {
    if (isAdmin) return 'Admin';
    if (isSpecialized) return 'Specialized';
    if (isRegular) return 'Regular';
    return '';
  };

  return (
    <>
      <header className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50">
        <div className={`header-container ${isProjectsPage || isBlogPage ? 'inverse' : ''}`}>
          <Link to="/" className={`logo-text ${isProjectsPage || isBlogPage ? 'inverse' : ''}`}>
            RISHI
          </Link>
          
          <Link to="/projects" className={`projects-btn ${isProjectsPage || isBlogPage ? 'inverse' : ''} interactive`}>
            Projects
          </Link>
          
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={toggleDropdown}
              className={`nine-dot-menu ${isProjectsPage || isBlogPage ? 'inverse' : ''} interactive`}
            >
              <div className="nine-dots">
                <div className={`dot ${isProjectsPage || isBlogPage ? 'inverse' : ''}`}></div>
                <div className={`dot ${isProjectsPage || isBlogPage ? 'inverse' : ''}`}></div>
                <div className={`dot ${isProjectsPage || isBlogPage ? 'inverse' : ''}`}></div>
                <div className={`dot ${isProjectsPage || isBlogPage ? 'inverse' : ''}`}></div>
                <div className={`dot ${isProjectsPage || isBlogPage ? 'inverse' : ''}`}></div>
                <div className={`dot ${isProjectsPage || isBlogPage ? 'inverse' : ''}`}></div>
                <div className={`dot ${isProjectsPage || isBlogPage ? 'inverse' : ''}`}></div>
                <div className={`dot ${isProjectsPage || isBlogPage ? 'inverse' : ''}`}></div>
                <div className={`dot ${isProjectsPage || isBlogPage ? 'inverse' : ''}`}></div>
              </div>
            </button>
            
            {isDropdownOpen && (
              <div className={`dropdown-menu ${isProjectsPage || isBlogPage ? 'inverse' : ''}`}>
                <Link 
                  to="/blog" 
                  className={`dropdown-item ${isProjectsPage || isBlogPage ? 'inverse' : ''} interactive`}
                  onClick={() => setIsDropdownOpen(false)}
                >
                  Blog
                </Link>
                <Link 
                  to="/hours" 
                  className={`dropdown-item ${isProjectsPage || isBlogPage ? 'inverse' : ''} interactive`}
                  onClick={() => setIsDropdownOpen(false)}
                >
                  Hours
                </Link>
              </div>
            )}
          </div>
          
          <span className={`separator ${isProjectsPage || isBlogPage ? 'inverse' : ''}`}>||</span>
          
          <div className={`user-section ${isProjectsPage || isBlogPage ? 'inverse' : ''}`}>
            {user && (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1">
                  {getRoleIcon()}
                  <span className="text-xs font-medium">{getRoleText()}</span>
                </div>
                <span className="text-sm">{user.email}</span>
              </div>
            )}
            <button 
              onClick={handleUserIconClick}
              className={`user-icon ${isProjectsPage || isBlogPage ? 'inverse' : ''} interactive`}
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
    </>
  );
};

export default Header;