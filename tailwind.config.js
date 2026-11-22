/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Azul petróleo: confianza fiscal y respaldo corporativo.
        marca: {
          50: '#eef7fb',
          100: '#d5ecf5',
          200: '#aed9ea',
          300: '#7fbfd9',
          400: '#4a9cc0',
          500: '#1a7fa8',
          600: '#0e6b8f',
          700: '#0e4f6b',
          800: '#0b3a4f',
          900: '#062431',
        },
        // Verde esmeralda: comprobante aceptado, aviso al día.
        exito: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        // Cian eléctrico: acento de automatización.
        acento: {
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
        },
      },
    },
  },
  plugins: [],
};
