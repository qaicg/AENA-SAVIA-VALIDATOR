
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/**
 * La API ahora es gestionada de forma nativa por el servidor de desarrollo (vite.config.ts).
 * Se ha eliminado el Service Worker para evitar conflictos de seguridad de origen (CORS/Sandbox)
 * y asegurar la compatibilidad en todos los entornos de despliegue.
 */

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
