import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  important: '#root',   // 关键！防止与 AntD 样式冲突
  theme: {
    extend: {
      colors: {
        primary: '#C41D2E',
      },
    },
  },
  plugins: [],
}

export default config
