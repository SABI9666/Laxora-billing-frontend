import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#4f46e5",
          dark: "#4338ca",
          light: "#eef2ff",
        },
      },
    },
  },
  plugins: [],
};

export default config;
