/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#4B91F1',
          DEFAULT: '#1677ff',
          dark: '#0958d9',
        },
        success: {
          light: '#52c41a',
          DEFAULT: '#52c41a',
          dark: '#389e0d',
        },
        warning: {
          light: '#faad14',
          DEFAULT: '#faad14',
          dark: '#d48806',
        },
        danger: {
          light: '#ff4d4f',
          DEFAULT: '#ff4d4f',
          dark: '#cf1322',
        },
        gray: {
          lightest: '#f5f5f5',
          light: '#d9d9d9',
          DEFAULT: '#8c8c8c',
          dark: '#595959',
          darkest: '#262626',
        }
      },
    },
  },
  plugins: [],
  // 防止与Ant Design样式冲突
  corePlugins: {
    preflight: false,
  },
}