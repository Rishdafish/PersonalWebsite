import React, { useEffect, useState } from 'react';
import { Linkedin, Github } from 'lucide-react';

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  animationDelay: number;
  animationDuration: number;
}

const ModernLandingPage: React.FC = () => {
  const [stars, setStars] = useState<Star[]>([]);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    // Generate animated starfield
    const newStars: Star[] = [];
    for (let i = 0; i < 150; i++) {
      newStars.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.8 + 0.2,
        animationDelay: Math.random() * 4,
        animationDuration: Math.random() * 3 + 2,
      });
    }
    setStars(newStars);
  }, []);

  const handleSocialHover = (hovered: boolean) => {
    setIsHovered(hovered);
  };

  return (
    <div className="modern-landing-container">
      {/* Animated Starfield Background */}
      <div className={`starfield ${isHovered ? 'hovered' : ''}`}>
        {stars.map((star) => (
          <div
            key={star.id}
            className="animated-star"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              animationDelay: `${star.animationDelay}s`,
              animationDuration: `${star.animationDuration}s`,
            }}
          />
        ))}
      </div>

      {/* Central Zeta Symbol */}
      <div className="zeta-container">
        <div className="modern-zeta-symbol">
          ζ
        </div>
      </div>

      {/* Side Navigation */}
      <div className="side-navigation">
        <a 
          href="https://linkedin.com/in/rishi-biry" 
          target="_blank" 
          rel="noopener noreferrer"
          className="nav-button linkedin"
          onMouseEnter={() => handleSocialHover(true)}
          onMouseLeave={() => handleSocialHover(false)}
          title="LinkedIn Profile"
        >
          <Linkedin size={24} />
        </a>
        
        <a 
          href="https://github.com/Rishdafish" 
          target="_blank" 
          rel="noopener noreferrer"
          className="nav-button github"
          onMouseEnter={() => handleSocialHover(true)}
          onMouseLeave={() => handleSocialHover(false)}
          title="GitHub Profile"
        >
          <Github size={24} />
        </a>
        
        <a 
          href="https://www.kaggle.com/rishidafish" 
          target="_blank" 
          rel="noopener noreferrer"
          className="nav-button kaggle"
          onMouseEnter={() => handleSocialHover(true)}
          onMouseLeave={() => handleSocialHover(false)}
          title="Kaggle Profile"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.825 23.859c-.022.092-.117.141-.281.141h-3.139c-.187 0-.351-.082-.492-.248l-5.178-6.589-1.448 1.374v5.111c0 .235-.117.352-.351.352H5.505c-.236 0-.354-.117-.354-.352V.353c0-.233.118-.353.354-.353h2.431c.234 0 .351.12.351.353v14.343l6.203-6.272c.165-.165.33-.246.495-.246h3.239c.144 0 .236.06.285.18.046.149.034.255-.036.315l-6.555 6.344 6.836 8.507c.095.104.117.208.07.336"/>
          </svg>
        </a>
      </div>

      {/* Footer */}
      <footer className="modern-footer">
        <div className="footer-content">
          <span className="name">Rishi Biry</span>
          <span className="copyright">© All rights reserved</span>
        </div>
      </footer>
    </div>
  );
};

export default ModernLandingPage;