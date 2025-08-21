import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx,js,jsx,mdx}",
    "./components/**/*.{ts,tsx,js,jsx,mdx}",
    "./lib/**/*.{ts,tsx,js,jsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // EqualShield brand colors
        'equalshield-primary': 'hsl(var(--equalshield-primary))',
        'equalshield-accent': 'hsl(var(--equalshield-accent))',
        'equalshield-light': 'hsl(var(--equalshield-light))',
        'equalshield-success': 'hsl(var(--equalshield-success))',
        'equalshield-warning': 'hsl(var(--equalshield-warning))',
        'equalshield-error': 'hsl(var(--equalshield-error))',
      },
    },
  },
  plugins: [],
} satisfies Config;