/** @type {import('tailwindcss').Config} */
module.exports = {
  // Add this line to enable class-based dark mode
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // These now refer to the CSS variables set by MUI
        background: "var(--tw-bg-background)",
        text: "var(--tw-text-text)",
        accent: "var(--tw-color-accent)",
        // Remove accent2 or add it to the theme.ts file
      },
    },
  },
  plugins: [require("@tailwindcss/aspect-ratio")],
};
