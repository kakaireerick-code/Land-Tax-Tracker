import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['date-fns', 'recharts', 'moment', 'lodash'],
  },
  build: {
    commonjsOptions: { transformMixedEsModules: true },
  },
});
