import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{html,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [...defaultTheme.fontFamily.sans],
      },
      colors: {
        primary: {
          50: "hsl(36deg 100% 97%)",
          100: "hsl(36deg 100% 94%)",
          300: "hsl(36deg 100% 77%)",
          500: "hsl(36deg 100% 50%)",
          700: "hsl(36deg 100% 39%)",
          900: "hsl(36deg 100% 24%)"
        }
      },
      textColor: {
        secondary: "#e0e0e0",
        tertiary: "#a8a8a8",
      },
      backgroundColor: {
        dark: "hsl(0, 0%, 7%)",
      },
      backgroundImage: {
        "vivid-red": "linear-gradient(45deg, #ff0000 -15%, #ff00bf)",
        "vivid-green": "linear-gradient(45deg, #44ffcd 0%, #00d6a3)",
        "vivid-indigo": "linear-gradient(45deg, #002aff -15%, #f877ff)",
        "vivid-lavender": "linear-gradient(45deg, #ff50ff 0%, #3affff)",
        "vivid-pink": "linear-gradient(45deg, #f343a3 0%, #ff90e8)",
        "vivid-purple": "linear-gradient(164deg, #e02cf4 0%, #6e00ff)",
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
