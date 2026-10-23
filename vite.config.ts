import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({plugins:[react(),tailwindcss()],build:{rollupOptions:{output:{manualChunks(id){if(id.includes('node_modules')){if(/\/(react|react-dom|scheduler)\//.test(id))return 'react';if(id.includes('lucide-react'))return 'icons';if(/\/(recharts|recharts-scale|d3-[^/]+|react-smooth|decimal.js-light)\//.test(id))return 'charts';if(/\/(pdf-lib|@pdf-lib|fontkit)\//.test(id))return 'pdf';}}}}}});
