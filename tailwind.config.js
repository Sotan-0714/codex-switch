const { theme } = require("./src/renderer-react/theme.cjs");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/renderer-react/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: theme.colors,
      fontFamily: theme.fontFamily,
      borderRadius: theme.borderRadius,
      boxShadow: theme.boxShadow
    }
  },
  plugins: []
};
