import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172033",
        mist: "#eef4f7",
        brand: "#176b87",
      },
    },
  },
  plugins: [],
};

export default config;
