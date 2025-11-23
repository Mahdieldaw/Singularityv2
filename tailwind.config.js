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
                // Primary brand (Indigo based on current UI usage)
                brand: {
                    50: '#eef2ff',
                    100: '#e0e7ff',
                    200: '#c7d2fe',
                    300: '#a5b4fc',
                    400: '#818cf8',
                    500: '#6366f1', // Indigo-500 (Current active state)
                    600: '#4f46e5',
                    700: '#4338ca',
                },
                // Dark layered surfaces
                surface: {
                    DEFAULT: '#0f0f23', // App bg start
                    soft: '#1a1a3a',    // App bg end
                    raised: 'rgba(255, 255, 255, 0.08)', // Glass effect (Tray)
                    highest: 'rgba(3, 7, 18, 0.72)',     // Dropdowns / Popovers
                    highlight: 'rgba(255, 255, 255, 0.1)', // Hover state
                    overlay: 'rgba(0, 0, 0, 0.2)', // Dark overlay for content areas
                },
                // Inputs / bars
                input: {
                    DEFAULT: 'rgba(255, 255, 255, 0.08)', // Matches tray
                    subtle: 'rgba(0, 0, 0, 0.2)',
                },
                // Overlays and modals
                overlay: {
                    backdrop: 'rgba(0, 0, 0, 0.85)', // Modal backdrop
                },
                // Text system
                text: {
                    primary: '#f1f5f9',   // Slate-100
                    secondary: '#e2e8f0', // Slate-200
                    muted: '#94a3b8',     // Slate-400
                    brand: '#a5b4fc',     // Indigo-300
                },
                // Borders
                border: {
                    subtle: 'rgba(255, 255, 255, 0.1)',
                    strong: 'rgba(255, 255, 255, 0.2)',
                    brand: '#6366f1',
                },
                // Chips / model pills / badges
                chip: {
                    DEFAULT: 'rgba(255, 255, 255, 0.05)',
                    active: 'rgba(99, 102, 241, 0.3)', // Indigo-500 with opacity
                    soft: 'rgba(148, 163, 184, 0.18)',
                },
                // Overlay / backdrop
                overlay: {
                    backdrop: 'rgba(15, 23, 42, 0.5)', // Dark semi-transparent overlay
                },
                // Status / intent colors
                intent: {
                    success: '#22c55e',
                    warning: '#fbbf24',
                    danger: '#ef4444',
                    info: '#3498db',
                },
            },
            borderRadius: {
                '2xl': '12px',
                '3xl': '1.5rem',
                'pill': '9999px',
            },
            boxShadow: {
                elevated: '0 8px 24px rgba(2,6,23,0.6)',
                'card-sm': '0 2px 8px rgba(0, 0, 0, 0.2)', // Small card shadow
                'glow-brand': '0 0 0 2px rgba(99, 102, 241, 0.6), 0 10px 30px rgba(59, 130, 246, 0.25)', // Brand highlight glow
                'glow-brand-soft': '0 4px 12px rgba(99, 102, 241, 0.4)', // Softer brand glow
            },
            backgroundImage: {
                'app-gradient': 'linear-gradient(135deg, #0f0f23 0%, #1a1a3a 100%)',
            }
        },
    },
    plugins: [],
}
