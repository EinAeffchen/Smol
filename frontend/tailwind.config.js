/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#212025",
        accent:     "#FF007F",
        accent2:    "#C8A2C8",
        text:       "#F8F8F8"
      }
    }
  },
  plugins: []
}
