import React from 'react';
import { Linkedin, Github } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const SocialIcons: React.FC = () => {
  const location = useLocation();
  const isBlogPage = location.pathname === '/blog';
  const isHoursPage = location.pathname === '/hours';
  
  // Don't show social icons on blog or hours pages
  if (isBlogPage || isHoursPage) {
    return null;
  }

  return (
    <div className="social-icons">
      <a 
        href="https://linkedin.com/in/rishi-biry" 
        target="_blank" 
        rel="noopener noreferrer"
        className="social-icon linkedin interactive"
        title="LinkedIn Profile"
      >
        <Linkedin size={20} />
      </a>
      <a 
        href="https://github.com/rishi-biry" 
        target="_blank" 
        rel="noopener noreferrer"
        className="social-icon github interactive"
        title="GitHub Profile"
      >
        <Github size={20} />
      </a>
      <a 
        href="https://kaggle.com/rishi-biry" 
        target="_blank" 
        rel="noopener noreferrer"
        className="social-icon kaggle interactive"
        title="Kaggle Profile"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.825 23.859c-.022.092-.117.141-.281.141h-3.139c-.187 0-.351-.082-.492-.248l-5.178-6.589-1.448 1.374v5.111c0 .235-.117.352-.351.352H5.505c-.236 0-.354-.117-.354-.352V.353c0-.233.118-.353.354-.353h2.431c.234 0 .351.12.351.353v14.343l6.203-6.272c.165-.165.33-.246.495-.246h3.239c.144 0 .236.06.285.18.046.149.034.255-.036.315l-6.555 6.344 6.836 8.507c.095.104.117.208.07.336"/>
        </svg>
      </a>
    </div>
  );
};

export default SocialIcons;