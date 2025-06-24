// tailwind.config.js
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx,js,jsx}',
    './app/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
  ],  theme: { 
    extend: {      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'fade-in-down': 'fadeInDown 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInDown: {
          '0%': { 
            opacity: '0',
            transform: 'translateY(-10px)',
          },
          '100%': { 
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        scaleIn: {
          '0%': { 
            opacity: '0',
            transform: 'scale(0.9)',
          },
          '100%': { 
            opacity: '1',
            transform: 'scale(1)',
          },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        'card-bg': 'var(--card-bg)',
        'input-bg': 'var(--input-bg)',
        'input-border': 'var(--input-border)',
        'button-bg': 'var(--button-bg)',
        'button-text': 'var(--button-text)',
        'tab-bg': 'var(--tab-bg)',
        'tab-text': 'var(--tab-text)',
        'tab-text-active': 'var(--tab-text-active)',
        'tab-hover-bg': 'var(--tab-hover-bg)',
        'tab-hover-text': 'var(--tab-hover-text)',
        'badge-bg': 'var(--badge-bg)',
        'badge-text': 'var(--badge-text)',
      }
    } 
  },
  plugins: [],
}
