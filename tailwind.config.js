// tailwind.config.js
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx,js,jsx}',
    './app/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
  ],
  theme: { 
    extend: {
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
