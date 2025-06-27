import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

const Header: React.FC = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { user, logout } = useAuth();

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
                <Link 
                  to="/hours" 
                  className={`dropdown-item ${isProjectsPage ? 'inverse' : ''} interactive`}
                  onClick={() => setIsDropdownOpen(false)}
                >
                  Hours
                </Link>
              </div>
            )}
          </div>
          
          <span className={`separator ${isProjectsPage ? 'inverse' : ''}`}>||</span>
          
          <div className={`user-section ${isProjectsPage ? 'inverse' : ''}`}>
            {user && <span>{user.email}</span>}
            <button 
              onClick={handleUserIconClick}
              className={`user-icon ${isProjectsPage ? 'inverse' : ''} interactive`}
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