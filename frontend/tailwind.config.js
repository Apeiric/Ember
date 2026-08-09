/**
 * EMBER — design system.
 * OWNER: FRONTEND
 *
 * Design + presentation is 45% of the score (CONTEXT.md §11). The palette is
 * built for one job: make a verdict card look like an emergency, not a webapp.
 * Dark base, ember oranges, a single alarm red that appears nowhere except when
 * someone needs to leave right now.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral soft-black base — no blue cast, no vibe. Color is reserved
        // for meaning: ember/alarm = danger, safe = safety, caution = caution.
        // Chrome is monochrome; the emergency is what gets to be loud.
        ash: {
          950: '#0a0a0b',
          900: '#121214',
          850: '#161618',
          800: '#1d1d20',
          700: '#27272b',
          600: '#35353a',
          500: '#4b4b52',
          400: '#6f6f78',
          300: '#9c9ca4',
          200: '#c9c9ce',
          100: '#ececef',
          50: '#f7f7f8',
        },
        ember: {
          50: '#fff5ed',
          100: '#ffe8d4',
          300: '#ffb267',
          400: '#ff8f33',
          500: '#ff6b0a',
          600: '#f04e00',
          700: '#c73a00',
        },
        // Reserved for EVACUATE NOW. Do not use this for anything decorative.
        alarm: {
          400: '#ff4d4d',
          500: '#f01e1e',
          600: '#c60d0d',
          700: '#8f0606',
        },
        safe: {
          400: '#3ddc84',
          500: '#16b866',
          600: '#0d8f4e',
        },
        caution: {
          400: '#ffd23f',
          500: '#f5b800',
        },
      },
      fontFamily: {
        sans: ['"Inter Tight"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // The one instruction. Should be readable across a room.
        // Sized against the 27rem control rail, NOT the viewport — a 9vw
        // headline overflows the card on a wide screen.
        verdict: ['clamp(2rem, 5vw, 3.5rem)', { lineHeight: '0.92', letterSpacing: '-0.035em' }],
        countdown: ['clamp(2.25rem, 5.5vw, 4rem)', { lineHeight: '0.9', letterSpacing: '-0.04em' }],
      },
      animation: {
        'pulse-alarm': 'pulse-alarm 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slam-in': 'slam-in 340ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'sweep': 'sweep 2.4s ease-in-out infinite',
        'rise': 'rise 500ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      keyframes: {
        'pulse-alarm': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(240, 30, 30, 0.55)' },
          '50%': { opacity: '0.92', boxShadow: '0 0 0 22px rgba(240, 30, 30, 0)' },
        },
        // The verdict does not fade in politely. It arrives.
        'slam-in': {
          '0%': { transform: 'scale(1.08) translateY(-8px)', opacity: '0' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        rise: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
