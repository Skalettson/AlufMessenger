import type { Config } from 'tailwindcss';

/** Без `content` Tailwind вырежет все utility-классы в production → «голый» HTML без стилей. */
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'media',
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
