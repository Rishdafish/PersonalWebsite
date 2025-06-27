import React from 'react';
import InteractiveLogo from '../components/InteractiveLogo';

const Home: React.FC = () => {
  return (
    <div className="page-transition min-h-screen flex flex-col items-center justify-center px-6">
      <InteractiveLogo />
    </div>
  );
};

export default Home;