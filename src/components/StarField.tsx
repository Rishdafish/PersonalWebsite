import React, { useEffect, useState } from 'react';

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  animationDelay: number;
}

const StarField: React.FC = () => {
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    // Generate dimly lit twinkling stars
    const newStars: Star[] = [];
    for (let i = 0; i < 200; i++) {
      newStars.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 1.5 + 0.5,
        animationDelay: Math.random() * 4,
      });
    }
    setStars(newStars);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none">
      {stars.map((star) => (
        <div
          key={star.id}
          className="star"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animationDelay: `${star.animationDelay}s`,
          }}
        />
      ))}
    </div>
  );
};

export default StarField;