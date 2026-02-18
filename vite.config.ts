
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000, // Cambia este número al puerto que necesites
    strictPort: true,
    host: true
  },
  define: {
    // Esto inyecta la variable para que el código 'process.env.API_KEY' funcione en el navegador
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
    // Fallback para otros usos de process.env
    'process.env': {}
  }
});
