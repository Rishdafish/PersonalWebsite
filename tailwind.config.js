/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'space-black': '#0a0a0a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'twinkle': 'twinkle 3s ease-in-out infinite',
        'comet': 'comet 8s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'binary-flow': 'binaryFlow 4s infinite',
        'spaceship-float': 'spaceshipFloat 6s ease-in-out infinite',
        'integral-pulse': 'integralPulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};