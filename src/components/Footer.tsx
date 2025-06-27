import React from 'react';
import { useLocation } from 'react-router-dom';

const Footer: React.FC = () => {
  const location = useLocation();
  const isProjectsPage = location.pathname === '/projects';
  const isBlogPage = location.pathname === '/blog';

  // Don't show footer on projects or blog pages
  if (isProjectsPage || isBlogPage) {
    return null;
  }

  return (
    <footer className="footer">
      © 2025 Rishi Biry All Rights Reserved
    </footer>
  );
};

export default Footer;