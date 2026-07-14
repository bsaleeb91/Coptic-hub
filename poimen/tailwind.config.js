/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        navy: '#0f1f3d',
        'navy-mid': '#162847',
        gold: '#c9a84c',
        'gold-light': '#e2c97e',
        cream: '#f5f0e8',
        's-green': '#5dca87',
        's-yellow': '#f5c842',
        's-red': '#e07070',
        's-blue': '#7fc4e8',
        's-purple': '#c9a0dc',
      },
      fontFamily: {
        cormorant: ['CormorantGaramond_400Regular'],
        'cormorant-medium': ['CormorantGaramond_500Medium'],
        'cormorant-light': ['CormorantGaramond_300Light'],
        lato: ['Lato_400Regular'],
        'lato-light': ['Lato_300Light'],
        'lato-bold': ['Lato_700Bold'],
      },
    },
  },
  plugins: [],
};
