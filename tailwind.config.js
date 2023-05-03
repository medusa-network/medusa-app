/** @type {import('tailwindcss/tailwind-config').TailwindConfig} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Open Sans',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Sans',
          'sans-serif',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
          'Noto Color Emoji',
        ],
      },
      blur: {
        DEFAULT: 'blur(4px)',
      },
      fillColor: {
        'telegram-brand': '#0088CC',
      },
      backgroundColor: {
        'light-primary': '#f5f5f5',
        'lighter-primary': '#1c224d',
        'light-secondary': '#0c113a',
        'dark-primary': '#0c113a',
        'dark-secondary': '#e74524',
        'off-white': '#f5f5f5',
      },
      textColor: {
        'light-primary': '#0c113a',
        'light-secondary': '#e74524',
        'dark-primary': '#0c113a',
        'dark-secondary': '#e74524',
        'off-white': '#f5f5f5',
      },
      borderColor: {
        'light-primary': '#0c113a',
        'light-secondary': '#e74524',
        'dark-primary': '#0c113a',
        'dark-secondary': '#e74524',
        'off-white': '#f5f5f5',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
