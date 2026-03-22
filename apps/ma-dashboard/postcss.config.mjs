/** Нужен для обработки `@tailwind` в `globals.css` при `next build`. */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
