/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        incense: {
          50: '#FFF8EC',
          100: '#FDE9BF',
          200: '#F9D892',
          300: '#F2C46A',
          400: '#E6A83D',
          500: '#D88E1F',
          600: '#A86A12',
          700: '#7A4B0B',
          800: '#4F3007',
          900: '#3E2604',
        },
        nile: {
          50: '#E8F1F2',
          100: '#C2D9DC',
          200: '#9ABFC4',
          300: '#6FA0A8',
          400: '#47828C',
          500: '#2F6C78',
          600: '#1F5561',
          700: '#14404A',
          800: '#0C2E36',
          900: '#061A1F',
        },
        parchment: {
          50: '#FBF6EC',
          100: '#F3EBDA',
          200: '#E6D9BD',
          300: '#D4C29A',
          400: '#C2A980',
          500: '#B89C67',
          600: '#8C7548',
          700: '#5F4F30',
          800: '#3D321A',
          900: '#261F0F',
        },
        ember: {
          300: '#E57A6C',
          500: '#B23A2C',
          700: '#7A1F16',
        },
        olive: {
          400: '#8FAD3E',
          500: '#6B8E23',
          600: '#536E1B',
        },
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};
