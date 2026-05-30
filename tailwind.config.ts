import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        rail: {
          black: "#080A0D",
          graphite: "#11151B",
          panel: "#171D25",
          border: "#26303B",
          green: "#35E58C",
          blue: "#5B8CFF",
          amber: "#F5B84B",
          red: "#FF5A66",
          text: "#F4F7FA",
          secondary: "#9BA7B4",
          muted: "#5F6B78",
        },
      },
      boxShadow: {
        glow: "0 0 48px rgba(53, 229, 140, 0.16)",
        "blue-glow": "0 0 42px rgba(91, 140, 255, 0.16)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
