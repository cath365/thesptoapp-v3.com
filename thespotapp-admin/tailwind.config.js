/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Match The Spot App brand colors exactly
        primary: {
          50:  "#F5EEF8",
          100: "#E8D5F0",
          200: "#D4B8E6",
          300: "#C69FD5", // App primary (wisteria)
          400: "#B888C9",
          500: "#9B6DAE", // App deepPink
          600: "#8A5A9E",
          700: "#6D3F82",
          800: "#4A2463",
          900: "#321549",
          950: "#1E0A30",
        },
        spot: {
          primary:       "#C69FD5",
          background:    "#FDFDC9",
          rose:          "#E8879C",
          deepPink:      "#9B6DAE",
          blush:         "#F2C4CE",
          peach:         "#F5B895",
          lavender:      "#B8A9D1",
          softPink:      "#F0D0D9",
          surface:       "#FFFFFF",
          gradientLight: "#F5EEF8",
          gradientMid:   "#E8D5F0",
          border:        "#EFEFEF",
          textPrimary:   "#2E2E2E",
          textSecondary: "#6B6B6B",
          error:         "#FF5252",
          errorLight:    "#FFEBEE",
          success:       "#4CAF50",
          successLight:  "#E8F5E9",
          successBorder: "#81C784",
          warning:       "#FF9800",
          warningLight:  "#FFF3E0",
          warningDark:   "#E65100",
          warningBorder: "#FFB74D",
          info:          "#2196F3",
          infoLight:     "#E3F2FD",
        },
      },
      animation: {
        "fade-in":  "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.5" },
        },
      },
    },
  },
  plugins: [],
};
