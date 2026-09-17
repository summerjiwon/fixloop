import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#09131f",
        canvas: "#f6f8fa",
        mist: "#f2f5f7",
        brand: "#059e91",
        "brand-600": "#059e91",
        "brand-700": "#036b61",
        "navy-950": "#0a141f",
        "teal-100": "#dbf5f5",
      },
      boxShadow: { card: "0 1px 2px rgba(9,19,31,.05), 0 8px 24px rgba(9,19,31,.04)" },
    },
  },
  plugins: [],
};

export default config;
