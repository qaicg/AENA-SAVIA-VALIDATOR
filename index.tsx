
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { runFullValidationProcess } from './utils/apiCore';

/**
 * VIRTUAL API INTERCEPTOR
 * Este interceptor permite que llamadas a 'fetch("/api/v1/validate")' 
 * sean procesadas por el motor de validación local del navegador.
 * Utilizamos un enfoque más robusto para evitar errores en entornos donde 'window.fetch' es de solo lectura.
 */
const setupVirtualApi = () => {
    const originalFetch = window.fetch.bind(window);

    const virtualFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

        // Detectar nuestra ruta de API virtual
        if (url.includes('/api/v1/validate') && init?.method === 'POST') {
            try {
                if (!(init.body instanceof FormData)) {
                    throw new Error("La petición debe ser de tipo multipart/form-data");
                }

                const formData = init.body as FormData;
                const files: File[] = [];
                
                // Extraer archivos del FormData
                formData.forEach((value) => {
                    if (value instanceof File) files.push(value);
                });

                if (files.length === 0) {
                    return new Response(JSON.stringify({ error: "No se proporcionaron archivos en la petición." }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }

                // Ejecutar el motor de validación central
                const result = await runFullValidationProcess(files);
                
                return new Response(JSON.stringify(result), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (e: any) {
                return new Response(JSON.stringify({ error: e.message || "Error interno procesando la validación" }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        // Delegar al fetch original para cualquier otra petición
        return originalFetch(input, init);
    };

    try {
        // Intentamos definir la propiedad para evitar el error "has only a getter"
        Object.defineProperty(window, 'fetch', {
            configurable: true,
            enumerable: true,
            writable: true,
            value: virtualFetch
        });
    } catch (e) {
        console.warn("No se pudo interceptar 'window.fetch' globalmente debido a restricciones del entorno. La API virtual solo estará disponible para llamadas internas que usen el motor directamente.", e);
        // Intento de asignación directa como último recurso
        try {
            (window as any).fetch = virtualFetch;
        } catch (err) {
            // Si falla, el Playground seguirá funcionando porque usa apiCore directamente
        }
    }
};

setupVirtualApi();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
