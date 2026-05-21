/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#F5F5F5",
        ember: "#D4D4D4",
        mint: "#E5E5E5",
        cyan: "#D1D5DB",
        violet: "#A1A1AA",
        obsidian: "#000000",
        surface: "#0a0a0a",
        muted: "#A1A1AA",
        text: "#F5F5F5",
        neon: "#FFFFFF",
        danger: "#D4D4D4",
      },
      boxShadow: {
        card: "0 18px 42px rgba(2,6,23,0.6)",
        rim: "0 8px 30px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.02)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
      },
      keyframes: {
        float: {
          '0%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
          '100%': { transform: 'translateY(0)' },
        },
        rimGlow: {
          '0%': { boxShadow: '0 0 0 rgba(0,0,0,0)' },
          '100%': { boxShadow: '0 0 18px rgba(255,255,255,0.12)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'rim-glow': 'rimGlow 0.6s ease-in-out both',
      },
    },
  },
  plugins: [],
};
