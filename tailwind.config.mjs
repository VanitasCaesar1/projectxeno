/** @type {import('tailwindcss').Config} */
export default {
	darkMode: 'selector',
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			colors: {
				primary: {
					50: '#f0fdf4',
					100: '#dcfce7',
					200: '#bbf7d0',
					300: '#86efac',
					400: '#4ade80',
					500: '#22c55e',
					600: '#16a34a',
					700: '#15803d',
					800: '#166534',
					900: '#14532d',
				},
			},
			fontFamily: {
				'clash': ['ClashDisplay-Variable', 'ClashDisplay-Regular', 'system-ui', 'sans-serif'],
			},
			animation: {
				'fade-in': 'fadeIn 0.3s ease-out',
				'slide-in': 'slideIn 0.3s ease-out',
				'shimmer': 'shimmer 1.5s infinite',
			},
			keyframes: {
				fadeIn: {
					'0%': { opacity: '0', transform: 'translateY(10px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' },
				},
				slideIn: {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(0)' },
				},
				shimmer: {
					'0%': { backgroundPosition: '-200px 0' },
					'100%': { backgroundPosition: 'calc(200px + 100%) 0' },
				},
			},
			screens: {
				'xs': '475px',
			},
			spacing: {
				'18': '4.5rem',
				'88': '22rem',
			},
		},
	},
	plugins: [
		// Add line-clamp plugin functionality
		function({ addUtilities }) {
			const newUtilities = {
				'.line-clamp-1': {
					display: '-webkit-box',
					'-webkit-line-clamp': '1',
					'-webkit-box-orient': 'vertical',
					overflow: 'hidden',
				},
				'.line-clamp-2': {
					display: '-webkit-box',
					'-webkit-line-clamp': '2',
					'-webkit-box-orient': 'vertical',
					overflow: 'hidden',
				},
				'.line-clamp-3': {
					display: '-webkit-box',
					'-webkit-line-clamp': '3',
					'-webkit-box-orient': 'vertical',
					overflow: 'hidden',
				},
				'.line-clamp-4': {
					display: '-webkit-box',
					'-webkit-line-clamp': '4',
					'-webkit-box-orient': 'vertical',
					overflow: 'hidden',
				},
			}
			addUtilities(newUtilities)
		}
	],
}
