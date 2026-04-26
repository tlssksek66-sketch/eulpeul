/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Shokz brand tokens
        shokz: {
          blue: "#0099E5",
          "blue-deep": "#0077B6",
          "blue-ink": "#003B73",
          ink: "#111111",
          sub: "#5B6470",
          line: "#E5E7EB",
          surface: "#FFFFFF",
          "feed-bg": "#F2F3F5",
        },
      },
      fontFamily: {
        kr: [
          "Pretendard Variable",
          "Pretendard",
          "Noto Sans KR",
          "Apple SD Gothic Neo",
          "Malgun Gothic",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      letterSpacing: {
        kr: "-0.02em",
        "kr-tight": "-0.025em",
      },
      boxShadow: {
        "gfa-card": "0 1px 2px rgba(0,0,0,0.04)",
      },
      width: {
        "gfa-card": "360px",
        "gfa-feed": "392px",
      },
      height: {
        "gfa-creative": "360px",
        "gfa-header": "48px",
        "gfa-cta": "40px",
      },
    },
  },
  plugins: [],
};
