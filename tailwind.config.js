/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        "./ui/**/*.{js,jsx,ts,tsx}",
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/**/*.html"
    ],
    theme: {
        extend: {
            colors: {
                // Keep brand as your purple/indigo accent
                brand: {
                    50: '#eef2ff',
                    100: '#e0e7ff',
                    200: '#c7d2fe',
                    300: '#a5b4fc',
                    400: '#818cf8',
                    500: '#6366f1',
                    600: '#4f46e5',
                    700: '#4338ca',
                },

                // Futuristic black surfaces
                surface: {
                    DEFAULT: '#020617',                  // main app background (near black)
                    soft: '#020617',                  // chat area
                    raised: '#020819',                  // cards / panels
                    highest: '#020617',                  // trays / header / popovers
                    highlight: 'rgba(148,163,184,0.16)', // subtle grey hover
                    overlay: 'rgba(0,0,0,0.75)',        // dark overlay for content areas
                    code: '#020617',                 // code blocks
                    modal: '#020617',                 // modal panels
                },

                // Inputs / bars
                input: {
                    DEFAULT: '#020617',                  // chat input bg
                    subtle: '#020617',                  // compact tray / small bars
                },

                // Single overlay base color; use /70,/80 in classes for opacity
                overlay: {
                    backdrop: '#020617',                 // use bg-overlay-backdrop/70 etc.
                },

                // Text system (cool greys)
                text: {
                    primary: '#e5e7eb',                // light grey
                    secondary: '#9ca3af',                // mid grey
                    muted: '#6b7280',                // dimmer labels
                    brand: '#a5b4fc',                // purple-tinted headings / highlights
                },

                // Borders (grey on black)
                border: {
                    subtle: 'rgba(148,163,184,0.28)',    // soft outlines
                    strong: 'rgba(148,163,184,0.45)',    // dividers / emphasis
                    brand: '#6366f1',
                },

                // Chips / model pills / badges
                chip: {
                    DEFAULT: 'rgba(15,23,42,0.85)',      // inactive pill
                    active: 'rgba(99,102,241,0.45)',    // purple‑tinted active pill
                    soft: 'rgba(15,23,42,0.6)',       // subtle labels / controls
                },

                // Status / intent colors (keep as-is)
                intent: {
                    success: '#22c55e',
                    warning: '#fbbf24',
                    danger: '#ef4444',
                    info: '#3498db',
                },
            },

            fontFamily: {
                sans: ['Inter', 'Inter Fallback', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                mono: ['DM Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
            },

            borderRadius: {
                '2xl': '12px',
                '3xl': '1.5rem',
                pill: '9999px',
            },

            boxShadow: {
                elevated: '0 20px 40px rgba(0,0,0,0.85)',           // deep modal/tray
                'card-sm': '0 2px 8px rgba(0,0,0,0.3)',              // small cards
                'glow-brand': '0 0 30px rgba(129,140,248,0.75)',        // strong brand glow
                'glow-brand-soft': '0 0 18px rgba(129,140,248,0.5)',         // softer glow
                overlay: '0 20px 25px -5px rgba(0,0,0,0.7), 0 10px 10px -5px rgba(0,0,0,0.6)',
            },

            backgroundImage: {
                // Main app background: mostly flat black with a very subtle top glow
                'app-gradient':
                    'radial-gradient(circle at top, rgba(129,140,248,0.22), transparent 55%), linear-gradient(180deg, #020617, #020617)',

                // Icon gradient for welcome screen (kept, now sits on black)
                'gradient-brand-icon':
                    'radial-gradient(circle at top, rgba(129,140,248,0.4), transparent 60%), linear-gradient(135deg, #0b1120, #020617)',

                // Optional: header gradient, see below
                'header-gradient':
                    'linear-gradient(90deg, #020617 0%, #111827 50%, #020617 100%)',
            },

            keyframes: {
                'slide-up': {
                    '0%': { opacity: '0', transform: 'translateY(12px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
            animation: {
                'slide-up': 'slide-up 0.3s ease-out',
            },
        },
    },
    plugins: [],
}
