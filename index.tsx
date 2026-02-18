
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { runFullValidationProcess } from './utils/apiCore';
import { identifyTransactionType, parse11004, parse11008, parseSystemEvent } from './utils/parser';

/**
 * REGISTRO DE SERVICE WORKER PARA API VIRTUAL
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('SAVIA Service Worker registered');
    }).catch(err => {
      console.error('SW registration failed:', err);
    });
  });

  // Escuchar peticiones que vienen del Service Worker
  navigator.serviceWorker.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'API_VALIDATE_REQUEST') {
      try {
        const rawFiles = event.data.files;
        // Convertir los datos crudos de nuevo a objetos File simulados
        const files = rawFiles.map((f: any) => new File([f.content], f.name, { type: f.type }));
        
        const result = await runFullValidationProcess(files);
        
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage(result);
        }
      } catch (error: any) {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ error: error.message });
        }
      }
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
